---
id: course:networking/module/timeouts
title: Timeouts, retries and backoff
requires: []
outcomes: []
tasks: []
drills: []
---

A network call can fail in a way a local call cannot: it can give no answer at all. This module covers how long to wait, when asking again is safe, and how well-meant retries can take a system down.

## Why a call needs a time limit

When a remote call gets no reply, the caller cannot tell which of these happened.

- The request never arrived.
- The request arrived and the server is still working on it.
- The server finished and the response was lost on the way back.

All three look the same from the caller's side: silence. The only tool against silence is a **timeout**: a limit after which the caller stops waiting and treats the call as failed.

Many libraries have no timeout by default, or one measured in minutes. A caller without a limit waits for as long as the other side stays silent. Each waiting call holds a thread, a connection and memory. One slow dependency can use up all of them, and then the caller cannot serve requests that have nothing to do with it.

## Two timeouts, not one

Set two limits for every call.

- A **connect timeout**: how long to wait for the connection to open. Inside one network a handshake takes a few milliseconds, so 1 to 3 seconds is generous. A longer wait rarely succeeds.
- A **read timeout** (or request timeout): how long to wait for the response once the request is sent. This depends on the work. A lookup may deserve 2 seconds and a report 60.

Choose the read timeout from measurements. If 99 out of 100 calls finish within 300 ms, a limit of 1 second lets normal calls through and cuts off the stuck ones. A limit of 30 seconds protects almost nothing.

```text example two-timeouts readonly
   |<-- connect timeout -->|<---------- read timeout --------->|
   |                       |                                   |
   SYN ......... connected  request sent ......... response done

   connect timeout: is anything there at all?        (short)
   read timeout:    is it answering in useful time?  (depends on the work)
```

## Timeouts along a chain

A request often passes through several services. Each has its own limit, and they must fit inside each other. An outer limit shorter than an inner one produces wasted work: the outer caller gives up, and the inner services keep working on a result nobody will read.

Give each layer less time than the layer in front of it. Better still, pass a **deadline** along with the request: the moment by which the whole request must be done. Each service checks how much time is left and stops when there is none.

```text example chain readonly
   BAD:  inner limits are longer than the outer one

   browser 10 s --> gateway 30 s --> orders 60 s --> database 120 s
   The browser gives up at 10 s. Everything behind it keeps working.

   GOOD: each layer has less time than the one in front

   browser 10 s --> gateway 8 s --> orders 5 s --> database 3 s
```

## What the caller knows after a timeout {prediction}

A service sends "charge the card 40.00" to a payment provider. After 5 seconds with no response, it times out.

:::question unknown
What does the service know?
- [ ] The charge did not happen :: The request may have arrived and been carried out, with only the response lost.
- [ ] The charge happened :: The request may never have arrived.
- [x] Nothing about the charge. It may or may not have happened :: A timeout reports that no answer came in time. It says nothing about what the other side did.
:::

## When a retry is safe

Trying again fixes many failures, since most are brief. It is safe only if doing the operation twice has the same effect as doing it once. Such an operation is called **idempotent**.

| Operation | Safe to repeat? |
| --- | --- |
| Read a record | Yes |
| Set a value to 5 | Yes |
| Delete record 12 | Yes, the second time it is already gone |
| Add 5 to a value | No |
| Create an order | No, unless the request carries a key |
| Charge a card | No, unless the request carries a key |

An operation that is not idempotent can be made so with an **idempotency key**. The caller makes up a unique value for the operation and sends it with every attempt. The server remembers which keys it has completed and returns the stored result for a repeat without doing the work again.

Not every failure should be retried either. Retry a timeout, a refused connection, a `502`, `503` or `504`, and a `429` after the wait it names. Do not retry a `400`, `401`, `403` or `404`. The same request will fail the same way.

## How retries make an outage worse

Imagine a service that is slow because it is overloaded. Its callers time out and retry. Each original request is now two or three requests. The overloaded service receives more traffic at the moment it can handle the least, and recovers more slowly or not at all. This is a **retry storm**.

It multiplies through layers. If three layers each retry three times, one request from a user can become 27 requests at the bottom.

```text example storm readonly
   normal:      100 requests/s  -->  service  (capacity 120/s)   fine

   service slows down, callers time out and retry 3 times each:

                100 + 100 + 100 = 300 requests/s  -->  service
                                                       capacity 120/s
                                                       cannot recover
```

## Backoff, jitter and a budget

Three rules keep retries from doing harm.

- **Exponential backoff.** Wait before each retry, and double the wait each time: 200 ms, 400 ms, 800 ms. A struggling service gets room to recover.
- **Jitter.** Add a random amount to each wait. Without it, a thousand clients that failed at the same moment all retry at the same moment, again and again.
- **A limit.** Retry a small number of times, such as two or three. Also retry at one layer only, usually the one closest to the failure. A **retry budget** caps retries at a share of all traffic, for example 10%, so retries can never multiply the load.

```text example backoff readonly
   attempt 1   fails
   wait 200 ms + random 0 to 200 ms
   attempt 2   fails
   wait 400 ms + random 0 to 400 ms
   attempt 3   fails
   give up and report the error
```

## Stop calling what is down

When a dependency fails again and again, waiting for a timeout on every call is a waste. A **circuit breaker** watches the recent results. After enough failures it "opens": calls fail at once without being sent. After a pause it lets a few test calls through, and closes again if they succeed.

The caller gets a fast error it can handle, for example by showing the page without the optional part. The failing service gets no traffic while it recovers.

## The synchronized clients {prediction}

A cache server restarts. 5,000 clients lose their connections in the same second. Each retries after exactly 1 second, then 2, then 4.

:::question jitter
What does the cache server see?
- [ ] A steady, light flow of reconnections :: The waits are identical for every client, so they stay in step.
- [x] Bursts of 5,000 connections at 1 s, 3 s and 7 s :: Backoff alone spaces the attempts out in time and keeps the clients synchronized. Jitter is what spreads them.
- [ ] No connections until the backoff has finished :: Each client tries again after each wait.
:::

## Exercise: set the limits {independent}

A web page calls a `profile` service, which calls a `recommendations` service, which queries a database. Measured times for normal calls: database 40 ms, recommendations 120 ms, profile 200 ms. Today no call has a timeout, every layer retries three times at once, and last week a slow database took the whole site down.

Choose a timeout for each layer, say which layer retries and how, and say what the page should do when recommendations are unavailable.

## One possible answer {walkthrough}

| Call | Timeout | Reason |
| --- | --- | --- |
| recommendations to database | 300 ms | Several times the normal 40 ms |
| profile to recommendations | 500 ms | Covers one database call plus the service's own work |
| page to profile | 1 s | The outer limit, longer than everything inside it |

**Retries.** Only one layer retries: recommendations retries its database read once, after a backoff of about 50 ms with jitter. That fits inside the 500 ms that its caller allows. The read is idempotent, so the retry is safe. The other layers do not retry. Before, one page view could become 27 database queries.

**Degrading.** Recommendations are optional. When the call fails or times out, the profile service returns the profile with an empty recommendation list, and the page is shown without that section. A circuit breaker on that call means that during an outage the page does not wait 500 ms every time.

Last week's outage needed all three faults: no time limits, retries at every layer, and an optional feature treated as required.
