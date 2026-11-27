---
id: course:system-design/module/overload
title: Protect the system from overload
requires: []
outcomes: []
tasks: []
drills: []
---

Every system has a limit. What matters is how it behaves when more work arrives than it can do. This module covers what overload looks like, and the tools for refusing work early so that the work you accept still gets done.

## What happens past the limit

Below its limit, a server finishes work as fast as it arrives. Past the limit you might expect it to keep working at full capacity and leave the extra waiting. In practice, an unprotected system does much worse than that.

- Requests queue up, so each one waits longer.
- Clients time out and give up, and the server still does the work for an answer nobody will read.
- Clients retry, which adds load.
- Memory fills with waiting requests, and the process slows down or crashes.

The useful output can fall close to zero while the server is busier than ever. This is **congestion collapse**. A system that could serve 1,000 requests per second serves almost none when offered 1,500.

The goal of everything in this module is to make the curve flat: at 1,500 offered, serve 1,000 well and refuse 500 quickly.

```text example collapse readonly
   useful work done
        ^
   1000 |          .------------------   protected: serves its
        |        .'                      capacity, refuses the rest
        |      .'  `.
        |    .'      `.
        |  .'          `._               unprotected: collapses
        |.'               `-.__
        +-------------------------------> offered load
        0       1000      1500     2000
```

## Rate limiting

A **rate limit** caps how many requests one client may make in a period: 100 per minute per API key, 5 login attempts per minute per account. A request over the limit gets `429 Too Many Requests` at once, with a `Retry-After` header that says when to try again.

Rate limits protect against one client using up capacity that everyone shares, whether through a bug, a runaway script or an attack. They also keep usage fair.

The most common method is the **token bucket**.

- Each client has a bucket that holds a maximum number of tokens.
- Tokens are added at a steady rate, up to the maximum.
- Each request takes one token. With no token left, the request is refused.

The refill rate sets the long-run average. The bucket size sets how large a short burst may be. A client that has been quiet has a full bucket and can send a burst. A client that sends constantly is held to the refill rate.

```text example bucket readonly
   bucket size 10, refill 2 tokens per second

   time    tokens   event
   0.0 s   10       client sends 10 requests at once -> all allowed
   0.0 s    0       11th request                      -> 429
   0.5 s    1       one token refilled, 1 request     -> allowed
   1.0 s    1       refilled again
   ...
   long-run average: 2 requests per second, bursts of up to 10
```

## Where to count

Two decisions shape a rate limit.

**What to count by.** By API key or user ID is the most accurate. By client address is the fallback for requests with no identity, and it is rough: many users behind one office share an address, and an attacker can use many. For logins, count by the account being tried as well as by address.

**Where to count.** With several application copies, a count kept in each copy's memory lets a client have the limit once per copy. The count belongs in a shared store, or at the gateway or load balancer in front of all the copies.

## The limit that was not {prediction}

A service limits each API key to 100 requests per minute. Each of its 8 copies keeps the count in its own memory. The load balancer spreads requests evenly.

:::question per-copy
How many requests per minute can one key actually make?
- [ ] 100 :: Each copy sees only an eighth of the client's requests.
- [x] About 800 :: Every copy allows 100 before it refuses. The real limit is the configured one multiplied by the number of copies, and it changes whenever copies are added.
- [ ] About 12 :: That would be the result if the limit were divided among the copies. Each copy applies the full 100.
:::

## Load shedding

A rate limit acts on one client. **Load shedding** acts on the whole system. When the server is over capacity, it refuses some requests on purpose, quickly and with a `503`, so that the ones it accepts finish in good time.

It works because refusing is cheap. Rejecting a request at the door costs a fraction of a millisecond. Accepting it, queueing it for 20 seconds and timing out costs real resources and helps nobody.

How to decide when to shed:

- **A limit on requests in progress.** Accept at most N at once and refuse beyond that.
- **A limit on queue length or queue time.** If a request has already waited longer than its caller's timeout, drop it. The caller has gone.
- **By priority.** Refuse the least important work first.

## Not all requests are equal

When something must be refused, choose what. Sort requests into classes before the overload comes.

| Class | Examples | Under overload |
| --- | --- | --- |
| Critical | Checkout, login, health checks | Refused last |
| Normal | Browsing, search | Shed when needed |
| Background | Reports, exports, recomputation | Shed first, or paused |

Two details matter. Health checks must keep answering, or the load balancer removes the overloaded copies and pushes their load onto the rest. And a user who is halfway through a checkout is worth more than a new visitor, so work already in progress is protected before new work.

## Backpressure

Shedding refuses work at the door. **Backpressure** tells the sender to slow down, so the work is not produced in the first place.

Inside a system it takes several forms.

- A bounded queue that makes the producer wait or fail when it is full.
- A worker that takes new work only when it has room.
- A `429` or `503` with `Retry-After`, which a well-behaved client obeys.

The alternative is an unbounded buffer somewhere in the chain. It accepts everything, grows quietly, and turns a brief overload into a long delay and then into a crash. Every queue and buffer in a design should have a size limit, and the design should say what happens when the limit is reached.

## Clients must cooperate

Protection on the server works far better when clients behave well. The rules are the ones from the networking course, seen from the other side.

- Honour `Retry-After`.
- Back off exponentially with jitter. Never retry at once in a loop.
- Limit retries, and retry only what is safe to repeat.
- Use a circuit breaker, so a failing service stops receiving calls.

If you write both the client and the server, build these in from the start. A million mobile apps that all retry every second can keep a recovering service down indefinitely.

## Planned surges

Some overloads are known in advance: a sale, a ticket release, a product launch. Three techniques shape such a surge.

- **Scale before the event.** Autoscaling reacts in minutes. Add the capacity an hour ahead.
- **A waiting room.** Admit users at a rate the system can serve, and show the rest their place in line. An honest queue is a far better experience than a page that fails.
- **Do less per request.** Turn off optional features for the duration: recommendations, live counts, anything not needed to complete the purchase.

## Which to refuse {prediction}

A service is at 130% of its capacity. In its queue are health checks from the load balancer, checkout requests, product page views and requests for a monthly report export.

:::question shed
What should it shed first?
- [ ] Health checks, since they do no useful work :: If health checks fail, the load balancer takes this copy out and sends its traffic to the others, which are overloaded too.
- [ ] The oldest requests, whatever they are :: Age matters once a request has outlived its caller's timeout. Before that, importance is the better guide.
- [x] The report exports, then page views if needed :: Exports can run later with no harm. Checkout is the work the business exists for and is refused last.
:::

## Exercise: design the protection {independent}

A public API for a mapping service has free and paid customers. Its 10 copies can serve 5,000 requests per second in total. Last month a free customer's script went into a loop and sent 4,000 requests per second for 20 minutes. Paid customers saw timeouts. There are no limits of any kind today.

Design the protection: rate limits, where they are counted, what is shed under overload and in which order, and what a refused client receives. Say what would have happened last month with your design.

## One possible answer {walkthrough}

**Rate limits, per API key, as token buckets**

| Plan | Refill | Burst |
| --- | --- | --- |
| Free | 10 per second | 50 |
| Paid | 200 per second | 1,000 |

They are counted at the API gateway in front of the copies, with the counters in a shared in-memory store, so the limit is the same however many copies run. Requests with no key are limited by address, strictly.

**Shedding.** Each copy accepts at most a fixed number of requests in progress and refuses beyond it. Under overload, shed in this order: free-plan requests, then batch endpoints for paid plans, then the rest. Health checks are never shed.

**What a refused client gets.** `429` with `Retry-After` for a rate limit. `503` with `Retry-After` for shedding. Both arrive in under a millisecond and are documented, with advice to back off with jitter.

**Capacity.** Alert when total traffic passes 70% of capacity, and autoscale on requests per copy.

**Last month, with this design.** The looping script would have had 50 requests answered and then received `429` for the other 3,990 or so each second. Refusing them costs almost nothing. Paid customers would have noticed nothing. The free customer would have seen a clear error that pointed to the bug in their script.

The 20-minute incident becomes a line in a log. That is the difference between a system with limits and one without.
