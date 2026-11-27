---
id: course:system-design/module/review
title: Review a design and make one
requires: []
outcomes: []
tasks: []
drills: []
---

This module has no new ideas. You review a design with faults in it and then make a design of your own. Do each exercise on paper before you read its answer.

## How to use this module

Each exercise has a step where you work alone and a step with one possible answer. The answers are not the only good ones. Compare your reasoning with them, and pay most attention to anything you did not consider at all.

When you review a design, ask the same questions each time.

1. What are the numbers, and does each part fit them?
2. Where is the single point of failure?
3. What happens when each dependency is slow?
4. Which data can be stale, and which must not be?
5. Which part has no stated reason to exist?

The fifth question is as useful as the others. A design can be wrong by having too much in it.

## Review 1: an event ticket system {independent}

A team presents this design for selling concert tickets. Sales open at a fixed time, and popular events sell out within minutes. Read it and list every problem you find. Rank them.

```text example flawed readonly
   browsers --> one app server --> one database
                     |
                     +--> email provider (called in the request,
                          no timeout, to send the ticket)

   - seats left are kept in the app server's memory and written
     to the database every 30 seconds
   - buying a ticket: read seats left, if above 0 then subtract 1
     and charge the card
   - the event page is built from 12 database queries on every view
   - if the charge fails, the request is retried at once, 5 times
   - logins are stored in the app server's memory
   - backups: a copy of the database is taken every Sunday
   - expected load: 80,000 people at the moment sales open
```

## The most urgent one {prediction}

Before you read the full list, choose from three of the faults.

:::question ticket-urgent
Which fault causes the most harm on the day sales open?
- [ ] The weekly backup :: It matters after a disaster. It does not affect the sale itself.
- [x] Checking and subtracting the seat count as two separate steps :: Thousands of buyers read "1 seat left" at the same instant and all proceed. Seats are sold many times over, and each of those customers has been charged.
- [ ] The 12 queries per page view :: They make the site slow under load. Overselling is worse, since it takes real money for seats that do not exist.
:::

## Review 1: what is wrong {walkthrough}

**Correctness**

1. **Overselling.** "Read, then subtract" is not atomic. Make it one step in the database: decrease the count only if it is above zero, inside a transaction, and sell only when that succeeds.
2. **Seat counts in memory.** A crash loses up to 30 seconds of sales. Tickets that were sold become available again. The database must be the source of truth for every sale.
3. **Five immediate retries of a charge.** Without an idempotency key, a customer can be charged several times. With one, the retries still hit a struggling payment provider all at once. Send a key, back off, and limit the retries.

**Capacity**

4. **One server for 80,000 people at once.** The estimate takes one line: 80,000 arrivals in the first minute is over 1,300 requests per second before anyone refreshes. Run many stateless copies, scaled up before the sale starts.
5. **12 queries per event page.** The page is the same for every visitor. Cache it at the CDN for a few seconds, and nearly all of that load disappears.
6. **Logins in memory.** They prevent running more than one copy. Move them to a shared store.

**Failure**

7. **Email in the request, with no timeout.** A slow provider stops ticket sales. Queue the email and respond as soon as the sale is recorded.
8. **Single points of failure.** One server, one database. Add copies and a database follower with failover.
9. **Weekly backups.** Up to a week of sales could be lost. Keep the change log continuously, and test a restore.

**Missing altogether**

10. **Nothing for the surge.** Use a waiting room that admits buyers at the rate the purchase path can serve, and rate limits per account.
11. **No seat hold.** A buyer needs a short reservation, such as five minutes, while they pay. Otherwise the seat is sold to someone else during payment.

Items 1 to 3 come first because they produce wrong outcomes that involve money. The others produce a slow or unavailable system, which is bad and can be recovered from.

## Design: a notification service {independent}

Design a service that other teams call to notify users. A caller says "tell user 17 that their order shipped", and the service delivers it by push notification, email or SMS according to the user's settings.

Assume 5 million users, 20 million notifications a day, and bursts of 2 million within a few minutes when marketing sends a campaign. Order updates should arrive within about 10 seconds. Campaign messages may take up to an hour. A user must not receive the same notification twice. Each external provider (push, email, SMS) has its own rate limit and fails from time to time.

Work through the five steps. Write the requirements you would confirm, the numbers, the interface, a simple design, and what you add under pressure with the reason for each addition.

## Design: one possible answer {walkthrough}

**Requirements to confirm.** Are there quiet hours? Can a user opt out per kind of message? Is delivery status needed by callers? This answer assumes yes to opt-out, and that status is stored for 30 days.

**Numbers.** 20 million a day is 200 per second on average. A campaign of 2 million in 5 minutes is about 7,000 per second. A status record of 300 bytes for 30 days is about 180 GB. So the average is modest, the burst is 35 times larger, and the burst is made of messages that may wait.

**Interface.** One call: `POST /notifications` with a user ID, a kind, the content, a priority and an idempotency key chosen by the caller. It answers `202 Accepted` with an ID. `202` is honest: the service accepted the work and has not done it yet.

**Simple design.** The API validates the request and writes it to a queue. Workers take a message, look up the user's settings, call the right provider and record the result. That is the whole shape, and each addition below has a reason.

```text example notify-design readonly
   callers --> API --+--> queue: transactional --> workers --+
                     |                                       |
                     +--> queue: campaign ------> workers ---+
                                                             |
                 user settings (cached)  <-------------------+
                                                             |
                        +---------------+--------------------+
                        v               v                    v
                   push provider   email provider       SMS provider
                   (own limit,     (own limit,          (own limit,
                    own breaker)    own breaker)         own breaker)

                 status and idempotency keys --> database
```

**Under pressure**

| Addition | Reason |
| --- | --- |
| Two queues, by priority | A campaign of 2 million must not delay an order update. With one queue, the 10-second target fails during every campaign |
| Idempotency key stored on acceptance | Callers retry, and the queue delivers at least once. The key is checked on acceptance and again before sending |
| A rate limit per provider, in the workers | Each provider has a limit. Going over it gets the service blocked |
| A circuit breaker and a separate worker pool per provider | A slow SMS provider must not stop push and email. This is a bulkhead |
| Retries with backoff, then a dead-letter queue with an alert | Providers fail briefly. A message that never succeeds must not block the others |
| A cache for user settings | Every message needs them, and they change rarely. Opt-outs must take effect fast, so delete the entry on change and use a short TTL |
| Autoscaling of workers on queue age | The load is bursty. The age of the oldest message is the signal that matters to users |
| A rate limit per caller on the API | One team's bug must not flood every user |

**The hard part: never twice.** At-least-once delivery, plus a worker that can crash between "provider accepted" and "recorded as sent", means a duplicate is possible. Pass the notification ID to the provider as its own idempotency key where the provider supports one. Where it does not, record "sending" before the call. After a crash, a message found in "sending" is not sent again without a check. That favours a rare missed notification over a duplicate, which matches the requirement. Say so in the design.

**Left out on purpose.** No partitioning: 180 GB fits. No second region: nothing in the requirements asks for it. No strict ordering: notifications to one user may arrive slightly out of order.

## Which signal to scale on {prediction}

The notification service's workers are autoscaled. Three signals are proposed: the workers' processor use, the number of messages in the queue, and the age of the oldest message in the transactional queue.

:::question scale-signal
Which signal best matches the 10-second requirement?
- [ ] Processor use :: Workers spend most of their time waiting for providers. They can be far behind with idle processors.
- [ ] Queue length :: Length says how much is waiting, and how long that takes depends on how fast it drains. It is a fair second choice.
- [x] The age of the oldest transactional message :: It measures the thing that was promised. If the oldest message has waited 8 seconds, the target is about to be missed, whatever the other numbers say.
:::

## Where to go next {explanation}

You can now take a vague request, turn it into requirements and numbers, start from a simple design, and add parts for stated reasons. You can also read someone else's design and find what it cannot survive.

Four habits are worth keeping.

- **Estimate first.** A few minutes of rounded arithmetic settles most arguments about what is needed.
- **Start simple and name the reason for every part you add.**
- **Ask what happens when each part is slow**, not only when it is down.
- **Write down what you gave up.** Every design does give things up, and the next person needs to know which ones were chosen.

The way to improve from here is practice on real systems. Read how the systems you use are built. When something fails, find out which part failed and why the failure spread or did not. Review designs with other people, since they will see what you missed, and you will see what they missed.
