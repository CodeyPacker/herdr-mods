---
id: course:networking/module/latency
title: Latency and where time goes
requires: []
outcomes: []
tasks: []
drills: []
---

A request can be slow while every part of the system works. This module covers what network delay is made of, why round trips matter more than connection speed for most requests, and the standard ways to remove them.

## Latency and bandwidth

Two numbers describe a connection, and they are often confused.

- **Latency** is delay: how long one packet takes to arrive. It is measured in milliseconds. **Round-trip time** (RTT) is the time there and back.
- **Bandwidth** is capacity: how much data can pass each second. It is measured in megabits per second.

Think of what each one limits. A large download is limited by bandwidth. A small API call is limited by latency, because the data fits in a few packets and the time is spent waiting for them to travel.

Buying a faster connection raises bandwidth. It does nothing for latency, which comes mostly from distance.

## Where latency comes from

A signal in a cable travels at about two thirds of the speed of light, roughly 200 km per millisecond. Distance therefore sets a floor that no hardware can beat.

| Path | Typical round trip |
| --- | --- |
| Same data centre | under 1 ms |
| Same city | 1 to 5 ms |
| Across a continent | 40 to 80 ms |
| Between continents | 100 to 300 ms |
| Mobile network, added | 20 to 100 ms |

Routers, queues and wireless links add to this. The numbers vary, and the ordering holds. A call to a server on the other side of the world costs a few hundred milliseconds before any work is done.

```text example distance readonly
   client in Europe  -------------------------  server in Australia
                       about 16,000 km of cable

   one way:     16,000 km / 200 km per ms  =  80 ms at the very least
   round trip:  at least 160 ms, in practice about 250 to 300 ms
```

## Count the round trips

For a small request, the total time is close to the number of round trips multiplied by the round-trip time. A first HTTPS request to a new server needs several.

1. DNS lookup: one round trip to the resolver, if the name is not cached.
2. TCP handshake: one round trip.
3. TLS handshake: one round trip with TLS 1.3.
4. The request and the response: one round trip, plus the server's work.

That is three round trips to the server before the first byte of the page arrives. At 100 ms each, the user waits over 300 ms when the server needs 5 ms to produce the answer.

```text example round-trips readonly
   round-trip time to the server: 100 ms      server work: 5 ms

   new connection                       reused connection

   DNS             20 ms                -
   TCP handshake  100 ms                -
   TLS handshake  100 ms                -
   request        105 ms                request   105 ms
   -----------------------              ----------------
   total          325 ms                total     105 ms
```

## Which change helps {prediction}

An API call from a mobile app takes 400 ms. The server's own work takes 10 ms. The app opens a new HTTPS connection for every call. The round-trip time is 120 ms.

:::question round-trip-fix
Which change saves the most time?
- [ ] Make the server's work twice as fast :: That saves 5 ms out of 400.
- [ ] Double the bandwidth of the connection :: The request and response are small. They are waiting on distance, not on capacity.
- [x] Keep the connection open and reuse it for later calls :: Later calls skip the TCP and TLS handshakes, which saves about 240 ms each time.
:::

## Fewer round trips

Since round trips dominate, the main techniques all remove some.

- **Reuse connections.** Keep-alive and connection pools remove the handshakes from every call after the first.
- **Batch.** One request that asks for 50 records beats 50 requests for one record each.
- **Run calls in parallel.** Three independent calls of 100 ms take 100 ms side by side and 300 ms one after another.
- **Avoid chatty designs.** A loop that makes one database query per item is the most common cause of a slow page. Ten items cost ten round trips. It is called the N+1 problem: one query for the list, then one more for each of its N items.

```text example chatty readonly
   one query per item (N + 1)            one query for all

   get order list        1 ms            get orders with their
   get customer of #1    1 ms            customers             2 ms
   get customer of #2    1 ms
   ...
   get customer of #200  1 ms
   -------------------------             -----------------------
   201 round trips     201 ms            1 round trip          2 ms
```

## Move the data closer

When the round trips cannot be removed, shorten them.

- **A cache** keeps a copy of an answer near the place it is needed, so no trip is made at all. Browsers do this, and so do servers.
- **A CDN** (content delivery network) is a set of caches in many cities. A user is sent to the nearest one, which holds copies of images, scripts and other files that are the same for everyone. The TCP and TLS handshakes also happen with the nearby cache, so even uncached requests gain a little.
- **Regions.** Running the application in more than one part of the world puts the whole service nearer to users. It is the most work, since the data then has to be in several places as well.

## Size still matters sometimes

For large responses, bandwidth and size take over. Two points are worth knowing.

- **Compression.** Text such as JSON, HTML and scripts shrinks to a fraction of its size with gzip or a similar method. It costs a little processing and saves transfer time.
- **A new connection starts slowly.** TCP begins by sending only a few packets, about 14 KB, and raises the rate as acknowledgements arrive. A response that fits in that first group arrives in one round trip. A larger one needs more. This is called **slow start**, and it is one more reason reused connections are faster.

## Averages hide the slow cases

Latency is not one number. Most requests are fast and some are much slower, because of a lost packet, a busy server or a cold cache. An average hides those.

Use **percentiles**. The 50th percentile (p50) is the time that half of all requests beat. The p99 is the time that 99 out of 100 beat. If p50 is 80 ms and p99 is 2 seconds, one request in a hundred is very slow, and a user who makes 100 requests in a visit will probably meet one.

## The far-away database {prediction}

An application server is moved to a region close to its users. Its database stays in the old region, 80 ms away. A typical page runs 30 database queries, one after another.

:::question far-database
What happens to page load time?
- [ ] It improves, since the server is now close to the users :: The user saves one round trip of distance. The server now pays for 30.
- [ ] It stays about the same :: The queries used to cost under 1 ms each inside one data centre.
- [x] It gets much worse, by more than 2 seconds :: 30 queries at 80 ms each add 2.4 seconds. An application and its database belong close together.
:::

## Exercise: find the time {independent}

A dashboard page takes 3.2 seconds for users in Asia. The server is in Europe, with a round-trip time of 250 ms. The browser makes 8 API calls for the page, one after another, each on a new connection. Each call takes 15 ms of server work. Responses are about 4 KB each.

Estimate where the 3.2 seconds go. Then list three changes in order of how much each saves, with a rough figure for each.

## One possible answer {walkthrough}

Each call on a new connection costs a TCP handshake, a TLS handshake and the request: three round trips, or 750 ms, plus 15 ms of work. That would give 6 seconds for 8 calls, so the browser is already reusing some connections. With one new connection and 8 requests one after another, the estimate is 500 ms of handshakes plus 8 times 265 ms, which is about 2.6 seconds. Add DNS and the page itself, and 3.2 seconds is explained. Server work is 120 ms of it.

1. **Run the 8 calls in parallel**, or replace them with one call that returns everything. The requests then cost one round trip together, not eight. Saves about 1.8 seconds.
2. **Serve the API from a region in Asia**, or put a cache close to those users for the parts that are the same for everyone. Cuts each remaining round trip from 250 ms to perhaps 30 ms. Saves most of what is left.
3. **Make sure connections are reused** and HTTP/2 is on, so no call pays for a handshake twice. Saves up to 500 ms on later visits.

Speeding up the server's own code is last on the list. It accounts for less than 4% of the time.
