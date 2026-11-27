---
id: course:system-design/module/queues
title: Queues and background work
requires: []
outcomes: []
tasks: []
drills: []
---

Not every piece of work has to finish before the user gets an answer. A queue lets one part of a system hand work to another and move on. This module covers what a queue gives you, what delivery guarantees mean, and how queues fail.

## Work now or work later

When a user places an order, some work must finish before the response: check the stock, take the payment, save the order. Other work can happen a moment later: send the confirmation email, update the recommendation data, notify the warehouse.

Doing everything in the request makes it slow and fragile. If the email provider is down, the order fails, although the order itself was fine.

The alternative is to do the required work, put a **message** describing the rest on a **queue**, and respond. Separate programs called **workers** (or consumers) take messages from the queue and do the work. The program that adds messages is the **producer**.

```text example queue readonly
   IN THE REQUEST                         LATER

   save order      50 ms
   take payment   300 ms
   add message      2 ms  --> [ queue ] --> worker: send email
   respond                                  worker: notify warehouse
   -------------------
   user waits     352 ms                    the user is not waiting
```

## What a queue gives you

- **Faster responses.** The user waits only for the work that matters to the answer.
- **Decoupling.** The producer does not need the worker to be running. If the email worker is down for ten minutes, messages wait and are handled when it returns. Nothing is lost and no user sees an error.
- **Levelling the load.** A burst of 10,000 orders in a minute becomes a queue that workers empty at their own steady pace. The queue absorbs the peak.
- **Independent scaling.** Add workers when the queue grows, without touching the web servers.
- **Retries.** A message that fails can be tried again later.

The price is that the work is no longer finished when the user is told "done". The design has to make that honest: "your order is confirmed, an email is on its way".

## Delivery guarantees

A queue has to deal with a worker that crashes halfway through a message. There are two possible promises.

**At most once.** The message is removed from the queue when it is handed to a worker. If the worker crashes, the message is gone. Nothing is ever done twice, and some things are never done.

**At least once.** The message stays until the worker confirms that it finished. This confirmation is called an **acknowledgement**. If none arrives within a time limit, the queue hands the message to another worker. Nothing is lost, and some messages are processed twice. That happens whenever a worker finishes the work and crashes before it acknowledges.

Nearly all systems choose at least once, because losing work is usually worse than repeating it.

"Exactly once" is what everyone wants. In general it cannot be had from delivery alone. It is built from at-least-once delivery plus workers that can tolerate repeats.

```text example at-least-once readonly
   queue: [ msg 7 ]

   worker A takes msg 7              (still held by the queue, hidden)
   worker A sends the email
   worker A crashes before it acknowledges

   time limit passes, msg 7 becomes visible again

   worker B takes msg 7
   worker B sends the email again    <-- the customer gets two emails
   worker B acknowledges, msg 7 is removed
```

## Make the worker safe to repeat

Since a message can arrive twice, a worker must be **idempotent**: handling the same message twice has the same effect as handling it once.

- **Use an ID.** Give every message a unique ID. Before doing the work, the worker checks whether that ID is already recorded as done. It records the ID in the same transaction as the work.
- **Write results that are naturally repeatable.** "Set the order's status to shipped" can be repeated. "Add 1 to the shipped count" cannot.
- **Pass the ID on.** When the work calls another service, such as a payment provider, send the message ID as the idempotency key, so that service can ignore repeats too.

## The repeated message {prediction}

A worker handles "add 50 loyalty points to customer 17" by running `points = points + 50`. Delivery is at least once. The worker crashes after the update and before the acknowledgement.

:::question repeat
What does the customer end up with?
- [ ] 50 points, since the message was handled once :: It was handled once and never acknowledged, so the queue delivers it again.
- [x] 100 points :: The message is redelivered and the addition runs again. The worker needs to record the message ID and skip a repeat.
- [ ] No points, because the crash rolled the update back :: The update was already saved when the worker crashed.
:::

## Messages that never succeed

Some messages fail every time: the data is malformed, or it refers to a record that no longer exists. With unlimited retries, such a message is tried for ever. It is called a **poison message**.

The standard answer is a retry limit and a **dead-letter queue**. After a set number of failed attempts, such as five, the message is moved to a separate queue. There it stops blocking the others, and a person can inspect it.

A dead-letter queue needs an alert. Messages collecting there unseen are lost work that nobody knows about.

Retries should wait between attempts, with backoff. A message that failed because a dependency is down will fail again one millisecond later.

## Order is not guaranteed by default

With several workers, messages are finished in an unpredictable order. Worker A may take message 1 and be slow, while worker B takes message 2 and finishes first. Retries shuffle the order further.

Usually this does not matter. Where it does, as with "create account" before "update account", there are two approaches.

- **Order per key.** Many queue systems can keep order for messages that share a key, such as the account ID, while still handling different keys side by side.
- **Design for any order.** Put a version or a timestamp in each message, and have the worker ignore one that is older than what it has already applied.

Strict order across everything means one worker at a time, which gives up most of the benefit of a queue.

## When the queue keeps growing

A queue absorbs a burst. It cannot absorb a permanent gap. If messages arrive faster than the workers finish them hour after hour, the queue grows without end, the delay grows with it, and in time something runs out of space.

Two measures tell you the state of a queue: its **length**, and the **age of the oldest message**. A rising age means the workers are falling behind.

When that happens, the choices are:

- **Add workers**, if whatever they call can take the extra load.
- **Slow the producers.** Signalling "slow down" back up the chain is called **backpressure**. It can mean refusing new work with a clear error.
- **Drop or defer** work that has lost its value, such as a notification that is now an hour late.

A queue with no size limit hides an overload until it becomes a crisis. Give queues a limit and decide in advance what happens when it is reached.

## Scheduled and long-running work

The same pattern covers work that takes minutes, such as building an export or processing a video. The request creates a job record with the status "queued" and returns its ID at once. A worker does the job and updates the status. The client asks for the status from time to time, or is notified at the end.

This keeps long work out of request time limits, lets it survive a restart, and gives the user something to look at while they wait.

## Falling behind {prediction}

A queue receives 500 messages per second during the day. Its workers finish 400 per second in total. This goes on for one hour.

:::question backlog
What is the state after the hour?
- [ ] The queue is empty, since queues level out the load :: Levelling works for a short burst. Here the gap lasts the whole hour.
- [x] 360,000 messages wait, and a new message waits 15 minutes before a worker reaches it :: The backlog grows by 100 per second. At 400 per second, clearing 360,000 takes 15 minutes, and that delay keeps growing.
- [ ] The workers speed up to match :: Workers run at their own pace. Capacity has to be added or the input reduced.
:::

## Exercise: move work to a queue {independent}

A photo-sharing app handles an upload in one request. It saves the original file, creates three resized versions, scans the image for prohibited content, updates the user's storage total, and sends a push notification to the user's followers. The request takes 9 seconds and fails whenever the notification service is slow.

Decide what stays in the request and what moves to a queue. For each queued step, say how it is made safe to repeat and what the user sees while it is pending.

## One possible answer {walkthrough}

**In the request**

- Save the original file to object storage.
- Create the photo record with the status "processing".
- Put one message on the queue with the photo ID, and respond.

The request now takes well under a second and depends on nothing optional.

**On the queue**

| Step | Safe to repeat because | The user sees |
| --- | --- | --- |
| Resize | The output files have fixed names derived from the photo ID. A repeat overwrites them with the same result. | A placeholder, then the photo |
| Content scan | It sets a status on the photo. Setting it twice is harmless. | "Processing" until it passes |
| Storage total | Recompute it from the user's files, or record the photo ID as counted. Never plain `total + size`. | A total that updates after a moment |
| Notification | Record "notified" per photo ID, and pass the photo ID to the push service as a key. | Nothing |

**Order.** The photo must not be shown to followers before the scan passes. So the scan sets the status to "visible", and only then is the notification message produced. Steps that depend on each other are chained, each producing the next message when it succeeds.

**Failure.** Each step retries with backoff, five times, and then goes to a dead-letter queue with an alert. A photo stuck in "processing" for more than a few minutes should be shown as failed with a way to try again.
