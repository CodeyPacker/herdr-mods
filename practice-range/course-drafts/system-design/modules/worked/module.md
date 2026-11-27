---
id: course:system-design/module/worked
title: Worked design: a link shortener
requires: []
outcomes: []
tasks: []
drills: []
---

This module walks through one complete design using the five steps from the first module. Nothing in it is new. The aim is to see the earlier ideas used together, in order, with each addition justified by a number.

## The request

"Design a service that turns a long web address into a short one. Opening the short one takes the visitor to the long one."

It sounds like a weekend project, and at a small size it is. It is used here because every design step shows up in a problem you can hold in your head.

Follow the five steps: requirements, numbers, interface and data, a simple design, then pressure.

## Step 1: requirements

**What it must do**

- Create a short link for a long address.
- Redirect anyone who opens the short link.
- Count how often each link is opened.

**Out of scope for now:** custom names, expiry dates, user accounts beyond an API key, and editing a link after it is made.

**How well**

| Question | Answer assumed |
| --- | --- |
| How many new links? | 10 million per month |
| How many opens? | 100 opens for every link created |
| How fast must a redirect be? | Under 100 ms for nearly all visitors |
| May a link ever stop working? | No. Links are kept for years |
| How fresh must the open count be? | A few minutes old is fine |
| What if the service is down? | Every link everywhere is dead, so redirects need high availability |

Two things stand out already. The system is very read-heavy. And the two operations differ in importance: a failed redirect breaks other people's pages, while a failed creation only annoys one person, who can try again.

## Step 2: numbers

Round hard, as in the estimates module.

```text example numbers readonly
   WRITES
   10,000,000 links per month / 2,500,000 s per month  =  4 per second
   peak (x 5)                                           = 20 per second

   READS  (100 per link)
   1,000,000,000 opens per month                        = 400 per second
   peak (x 5)                                           = 2,000 per second

   STORAGE
   one record: short code, long address, date, owner    = about 500 bytes
   10,000,000 per month x 500 bytes                     = 5 GB per month
   over 5 years (600,000,000 links)                     = 300 GB
```

These numbers are small. Twenty writes per second is nothing for a database. 300 GB after five years fits on one machine. Two thousand reads per second is within reach of a single database, though worth easing.

The estimate has already made a decision: this system does not need partitioning. It would have been easy to assume otherwise.

## Sizing check {prediction}

Based on the numbers above, which part of the design needs the most care?

:::question worked-focus
Where should the effort go?
- [ ] Storing the data, since links are kept for years :: 300 GB in five years fits on one ordinary database server.
- [ ] Handling the write load :: 20 writes per second at peak is far below what one database can take.
- [x] Making redirects fast and always available :: Reads are 100 times the writes, every one has a visitor waiting, and an outage breaks every link at once.
:::

## Step 3: interface and data

Two operations.

```http example api readonly
POST /links
Content-Type: application/json

{"url": "https://example.com/a/very/long/path?with=parameters"}

HTTP/1.1 201 Created
{"code": "k3Xp9a", "short": "https://sho.example/k3Xp9a"}


GET /k3Xp9a

HTTP/1.1 302 Found
Location: https://example.com/a/very/long/path?with=parameters
```

One table.

| Column | Type | Note |
| --- | --- | --- |
| `code` | text, primary key | The short code |
| `url` | text | The long address |
| `created_at` | timestamp | |
| `owner` | text | The API key that created it |

The only question the system asks at volume is "give me the row with this code". That is a lookup by one key, the simplest access pattern there is. A relational database serves it well, and so would a key-value store. A relational database is chosen here because it is the default and nothing argues against it.

A choice hides in the status code. `301` means moved for good, and browsers remember it and skip the service next time. That is fast, and those opens are never counted. `302` means temporary, so every open comes back to the service. Counting opens is a requirement, so the design uses `302`.

## How long is a code, and how is it made

A code uses 62 characters: a to z, A to Z and 0 to 9. Six characters give 62 to the power 6, about 57 billion codes. The system needs 600 million in five years, so six is plenty, with room to spare. Seven would give 3.5 trillion.

There are two ways to produce a code.

**From a counter.** Keep a number that goes up by one for each link, and write it in base 62. Codes never collide. They are also guessable: after `k3Xp9a` comes `k3Xp9b`, so anyone can walk through every link. A single counter is also one more thing shared between all copies.

**At random.** Pick six random characters and insert the row. The primary key refuses a duplicate, in which case pick again. With 600 million of 57 billion codes in use, about one attempt in a hundred collides, and a second try settles it. Codes cannot be guessed in sequence.

The design uses random codes. Links often point at things that are private by obscurity, and a retry on one write in a hundred, at 20 writes per second, is no cost at all.

## Step 4: the simple design

```text example simple-design readonly
                        +--> app copy --+
   visitors --> load ---+               +--> database
               balancer +--> app copy --+    (one leader)

   POST /links   insert a row with a random code, retry on a duplicate
   GET /{code}   select the row by code, answer 302 with its address
```

Two application copies, since one would be a single point of failure. They are stateless, so any copy answers any request.

Check it against the numbers. The peak of 2,000 reads per second by primary key is possible for one database and close to the range where it deserves help. Writes are trivial. Storage is fine.

Now check it against the requirements. Two are not met.

1. Redirects need high availability, and the single database is a single point of failure.
2. Open counts are not recorded anywhere yet.

Those two, and only those, drive step 5.

## Step 5: apply pressure

**Availability of redirects.** Add a database follower in a second zone, with automatic failover. A confirmed link must not be lost, so that follower is synchronous. Spread the application copies over the zones.

**Read load and speed.** Add a cache in front of the database. A link never changes after it is made, which makes it the ideal thing to cache: there is no invalidation problem. Use cache-aside with a long TTL. Popular links are opened again and again, so the hit rate will be high, and most redirects never reach the database.

That also helps availability. If the database is briefly unreachable, links that are in the cache still work.

**Counting opens.** Writing to the database on every redirect would turn 2,000 reads per second into 2,000 writes per second, on the path where speed matters most. The count may be a few minutes old, so take it off that path. On each redirect the application publishes a small "link opened" event and answers at once. A consumer adds the events up and writes totals to the database every minute.

If the event system is down, redirects must still work. So publishing is best effort: a failure to publish is logged and the redirect goes ahead. That is a stated trade-off. In a rare failure, some opens go uncounted.

```text example final-design readonly
                         +--> app copy --+--> cache
   visitors --> load ----+               |
               balancer  +--> app copy --+--> database leader
                              |               |  (synchronous)
                              |               v
                              |             follower, second zone
                              v
                        "link opened" events
                              |
                              v
                        counting consumer --> totals, once a minute
```

## What was decided against

A design is also the list of things left out, with reasons.

- **No partitioning.** 300 GB in five years fits on one machine. Revisit at ten times the volume.
- **No second region.** Zones cover the availability requirement. Visitors far away pay one extra round trip of distance. If the latency requirement tightens, serve redirects from several regions with read-only copies of the data, which is easy here because links never change.
- **No strong consistency for counts.** They are eventual, and losing a few in a failure is accepted.
- **No protection designed yet.** A real service needs rate limits on creation per API key, and a check that refuses links to known harmful sites. Both sit at the front and change nothing behind it.

## The cached link {prediction}

A link is created and cached with a TTL of 24 hours. The requirements say links cannot be edited.

:::question never-changes
Why is this cache much simpler than the ones in the caching module?
- [ ] Because the TTL is long :: A long TTL on data that changes would make things worse, not simpler.
- [x] Because the data never changes, so a cached copy can never be out of date :: There is no invalidation on write and no staleness to reason about. If editing or deleting links is added later, that changes, and the cache design must be revisited.
- [ ] Because links are small :: Size affects how many fit in memory. It has nothing to do with correctness.
:::

## Exercise: extend the design {independent}

The product team adds two requirements.

1. A link's owner can delete it. A deleted link must stop working within one minute.
2. Links can be given an expiry time, after which they stop working.

Say what changes in the data, in the cache and in the redirect path. Then say which earlier statement in this module is no longer true.

## One possible answer {walkthrough}

**Data.** Add two columns: `deleted_at` and `expires_at`, both empty by default.

**Redirect path.** Fetch the row, or its cached copy. If it is deleted, or its expiry time has passed, answer `410 Gone`. That status tells the visitor the link existed and has been removed, which is more accurate than `404`.

**Expiry and the cache.** Store `expires_at` inside the cached value and compare it with the clock on every request. A cached copy then stays correct however long it is kept. No invalidation is needed for expiry.

**Deletion and the cache.** This is the real change. A deleted link may sit in the cache for up to 24 hours. Two measures together meet the one-minute rule.

- On delete, update the database and delete the cache entry, as in cache-aside.
- Lower the TTL to 60 seconds, as the safety net for a missed delete.

At 2,000 reads per second, a 60-second TTL still gives a hit rate well above 90% for popular links.

**What is no longer true.** "A link never changes after it is made, so there is no invalidation problem." That sentence carried the cache design. One small feature removed it. This is why a design should write its assumptions down: when a requirement changes, you can find every decision that rested on it.
