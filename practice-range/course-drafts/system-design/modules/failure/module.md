---
id: course:system-design/module/failure
title: Design for failure
requires: []
outcomes: []
tasks: []
drills: []
---

In a system with many parts, something is broken most of the time. This module covers how failures spread, the patterns that stop them from spreading, and how to keep serving users when a part is down.

## Failure is the normal state

A single machine fails rarely, perhaps once every few years. A system of 1,000 machines therefore sees a failure most days. Add network faults, full disks, bad deploys, expired certificates and slow dependencies, and something is always wrong somewhere.

So the question for a design is not how to avoid failure. It is what happens when each part fails. Go through the drawing one box and one arrow at a time and ask:

- What does the user see if this stops?
- What does this part do if the thing it calls is slow?
- Does the failure stay here, or does it spread?

A design is good when the answers are "a small feature is missing" and "it stays here".

## Slow is worse than down

A dependency that is down fails fast. The caller gets an error in milliseconds and moves on.

A dependency that is slow is far more dangerous. Each call to it holds a thread, a connection and memory in the caller while it waits. As waiting calls pile up, the caller runs out of those resources and can no longer serve anything, including requests that never touch the slow dependency. Now the caller is slow, its own callers start piling up, and the failure climbs up the chain.

This is a **cascading failure**: one slow part takes down parts that were healthy.

```text example cascade readonly
   web --> orders --> recommendations (slow: 30 s per call)

   1. calls to recommendations pile up inside orders
   2. orders runs out of threads, and all its endpoints hang
   3. calls to orders pile up inside web
   4. web runs out of threads, and the whole site is down

   An optional feature took down everything, without ever failing.
```

## Timeouts, again

The first defence is the one from the networking course: every call has a timeout, and it is short. A timeout turns "slow" back into "failed fast", which the caller can handle.

Set it from the measured normal time, not from a guess. If a call normally takes 50 ms, a 30-second timeout offers no protection. A limit of a few hundred milliseconds does.

Retries need the same care as before: only for idempotent operations, with backoff and jitter, a small maximum, and at one layer only. A retry storm is the standard way a small failure becomes a large one.

## Circuit breakers

When a dependency keeps failing, even a short timeout on every call adds up. A **circuit breaker** stops the calls. It has three states.

- **Closed.** Calls pass through. The breaker counts failures.
- **Open.** After too many failures, calls fail at once without being sent. The dependency gets rest, and the caller wastes no time.
- **Half-open.** After a pause, a few test calls are let through. If they succeed, the breaker closes. If they fail, it opens again.

```text example breaker readonly
              too many failures
   CLOSED  ----------------------->  OPEN
   (calls pass)                      (calls fail at once)
      ^                                |
      | test calls succeed             | after a pause
      |                                v
      +---------------------------  HALF-OPEN
            test calls fail:        (a few test calls)
            back to OPEN
```

## Bulkheads

A ship's hull is divided into sealed compartments, so one leak floods one section and not the whole ship. A **bulkhead** in software does the same thing with resources.

Do not let all work share one pool. Give each dependency its own limited pool of connections or threads. If the recommendation service hangs, it can use up its own 20 connections and no more. The other 180 remain for everything else.

The same idea applies at larger scales: separate worker groups for slow reports and fast lookups, separate copies for a large customer, separate clusters per region.

## Where the limit helps {prediction}

A service has 200 worker threads. It calls a payment service and a recommendation service. Calls to recommendations start taking 60 seconds, with no timeout and no separate pools.

:::question bulkhead
What happens to payment requests?
- [ ] Nothing. The payment service is healthy :: The payment service is healthy. The calling service is the part that runs out of resources.
- [x] They stop being served once all 200 threads are stuck waiting on recommendations :: Every request that touches recommendations holds a thread for a minute. Soon none are left for anything else. A limit of 20 threads for recommendations would keep 180 free.
- [ ] They are served more slowly, and all of them still complete :: With no free thread, a new request is not served at all until one frees up.
:::

## Degrade, do not die

Most pages are built from several parts, and only some are essential. A product page needs the product and the price. Reviews, recommendations and "recently viewed" are extras.

**Graceful degradation** means serving the essential part when an extra fails. Each optional call gets a **fallback**: what to use in its place.

| Optional part | Fallback |
| --- | --- |
| Recommendations | Leave the section out, or show a fixed list of popular items |
| Review count | Show the last cached value, or nothing |
| Personalised greeting | Show a generic one |
| Search suggestions | Let the user type without them |

To design this, sort every dependency into required or optional. Be strict about the first group. Each required dependency is one more thing whose failure takes the feature down. A feature with five required dependencies that each work 99.9% of the time works only 99.5% of the time.

## Redundancy

A **single point of failure** is any one thing whose failure stops the system: one server, one database, one load balancer, one network link, one data centre. It can also be one person who knows how something works.

The remedy is **redundancy**: more than one of each, set up so the others take over.

- Several application copies behind a load balancer.
- A database leader with a follower that can be promoted.
- Copies spread across independent locations, called zones.

Redundancy helps only if the copies fail independently. Two servers in the same rack share a power supply. Two copies running the same faulty release fail together. A bad configuration pushed to all copies at once is the classic way a redundant system goes down entirely.

That is why changes are rolled out gradually: to one copy or a small share of traffic first, with a check before going further.

## Failing well at the edges

Three smaller habits make failures cheaper.

- **Fail fast.** Check inputs and required conditions at the start of a request. Rejecting a bad request after 5 seconds of work wastes the work.
- **Shed load.** A server that is over capacity should refuse some requests quickly with a `503`, not accept all of them and serve none. Serving 80% well beats serving 100% badly.
- **Make start-up independent.** A service that cannot start unless every dependency is up cannot be restarted during an outage, which is when restarts are needed most.

## Test the failure

A fallback that has never run probably does not work. Failure paths are the least exercised code in any system, and they are needed at the worst moment.

So failures are caused on purpose, under control: stop a copy, block a dependency, add delay to a call, fail over the database. Doing this as a regular practice is called **chaos engineering**. Start in a test environment and with small experiments, and state beforehand what you expect to happen.

A failover that is exercised every month is one you can trust. One that was set up two years ago and never tried is a guess.

## Which is required {prediction}

A checkout page calls four services: cart, payment, a fraud check, and a "customers also bought" service. Each is available 99.9% of the time, and all four are treated as required.

:::question required
What changes if "customers also bought" is made optional, with an empty fallback?
- [ ] Nothing measurable. 99.9% is already very high :: Four required dependencies multiply to about 99.6%. Each one removed gives a tenth of a percent back.
- [x] Checkout no longer fails when that service does, and its availability rises from about 99.6% to 99.7% :: Three required dependencies fail less often than four, and the one removed was never needed to take an order.
- [ ] Checkout becomes less reliable, since a fallback is extra code :: The fallback is an empty list. The risk it removes is far larger than the risk it adds.
:::

## Exercise: find the failure paths {independent}

A food delivery app's "place order" request does this, in order, with direct calls and no timeouts:

1. Reads the cart from a cache.
2. Calls the restaurant service to check that it is open.
3. Calls the payment service to charge the card.
4. Saves the order to the database.
5. Calls the notification service to alert the restaurant.
6. Calls a loyalty service to add points.
7. Calls an analytics service to record the sale.

For each step, say whether it is required for the order to be placed, what happens today if it is slow, and what you would change. Point out the step where a failure is most dangerous.

## One possible answer {walkthrough}

| Step | Required? | Change |
| --- | --- | --- |
| 1. Cart from cache | Yes | Short timeout. Fall back to the database copy of the cart |
| 2. Restaurant open | Yes | Timeout of a few hundred ms. Circuit breaker. A cached "open" status may be good enough |
| 3. Payment | Yes | Timeout. Idempotency key, so a retry cannot charge twice |
| 4. Save order | Yes | Must succeed, see below |
| 5. Notify restaurant | Yes, soon after | Queue it, with retries and an alert if it is not delivered within a minute |
| 6. Loyalty points | No | Event or queue |
| 7. Analytics | No | Event or queue |

**Today.** With no timeouts, a slow analytics service holds every order request open. Orders stop because a reporting system is slow, which is the cascade described earlier.

**The dangerous step.** Between 3 and 4. If the payment succeeds and the save then fails, the customer has paid for an order that does not exist. Reverse the order of work: save the order as "pending payment" first, then charge with the order ID as the idempotency key, then mark it "paid". A crash at any point now leaves a record that a background job can finish or refund.

**After the change.** The request needs only the cache or database, the restaurant check and the payment. Steps 5 to 7 react to an "order placed" event. Step 5 differs from 6 and 7: it is not needed for the response, and it is essential to the business, so it needs its own alert when it falls behind.
