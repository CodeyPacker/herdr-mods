---
id: course:system-design/module/caching
title: Caches
requires: []
outcomes: []
tasks: []
drills: []
---

A cache keeps a copy of an answer so that the work of producing it is not repeated. It is the most common way to make a system faster, and the most common source of out-of-date data. This module covers how a cache is used, how entries leave it, and how caches fail.

## What a cache is

A **cache** is a store of results, kept somewhere fast, usually in memory. When the same question is asked again, the answer comes from the cache and the slow source is not touched.

Two terms describe what happens on a lookup.

- A **hit**: the answer was in the cache.
- A **miss**: it was not, so the source is asked and the result is usually stored for next time.

The **hit rate** is the share of lookups that are hits. A cache with a 95% hit rate removes 95% of the load from whatever is behind it. A cache with a 20% hit rate adds a lookup to most requests and saves little.

A cache pays off when data is read much more often than it changes, and when a small part of the data gets most of the requests.

## Where caches sit

Caches exist at every level between the user and the data, and a request may pass several.

```text example levels readonly
   browser cache          on the user's device
        |
   CDN                    in a city near the user
        |
   reverse proxy cache    in front of the application
        |
   application cache      a shared in-memory store, such as Redis
        |
   database               the source of truth
```

The closer to the user a hit happens, the more work is saved. A hit in the browser costs no network traffic at all. This module is mostly about the application cache, since it is the one you design. The same rules apply at every level.

## Cache-aside

The usual way to use an application cache is called **cache-aside**. The application talks to both the cache and the database.

To read:

1. Look in the cache.
2. On a hit, return the value.
3. On a miss, read the database, store the value in the cache, and return it.

To write:

1. Update the database.
2. Delete the entry from the cache.

The next read misses and loads the new value. Deleting is safer than writing the new value into the cache. If two updates happen at almost the same time, writing can leave the older value in the cache. A delete cannot leave a wrong value behind.

```text example aside readonly
   READ                                    WRITE

   app --> cache: get product:42           app --> database: update 42
           hit?  --> return it             app --> cache: delete product:42
           miss? --> database: read 42
                 --> cache: set product:42
                 --> return it
```

## Entries have to leave

A cache has limited memory, and its copies go out of date. Two mechanisms remove entries.

**Expiry.** Each entry gets a **TTL** (time to live), such as 5 minutes. After that it is dropped, and the next read fetches a fresh value. The TTL is a direct trade: a longer one means more hits and older data.

**Eviction.** When memory is full, something must go to make room. The usual policy is **LRU** (least recently used): drop the entry that has gone longest without being read.

A TTL is also a safety net. If a delete is missed because of a bug or a crash, the wrong value does not stay for ever. Give every entry a TTL, even when you also delete on write.

## How stale can it be {prediction}

Product prices are cached with a TTL of 10 minutes. The cache entry is not deleted when a price changes. A price is corrected from 5.00 to 50.00 at 12:00.

:::question stale
What do customers see?
- [ ] 50.00 from 12:00 :: Nothing tells the cache about the change.
- [x] 5.00 for up to 10 minutes, depending on when the entry was stored :: Each entry lives until its TTL ends. An entry stored at 11:59 is served until 12:09.
- [ ] 5.00 until the cache is restarted :: The TTL removes the entry within 10 minutes without any restart.
:::

## Deciding what may be stale

"The cache may be out of date" is acceptable for some data and not for other data. Decide for each kind.

| Data | Stale for a minute? |
| --- | --- |
| A product description | Fine |
| The number of likes on a post | Fine |
| A list of search results | Fine |
| The stock count shown on a product page | Usually fine, if checkout checks the real value |
| An account balance used to approve a payment | No |
| Whether a user's access was revoked | No, or only for a very short time |

The pattern in the fourth row is common. Show a cached value where a small error does no harm, and read the real value at the moment a decision is made.

## The stampede

A popular entry expires. In the next instant, 500 requests arrive, all miss, and all run the same slow query at once. The database, which the cache was protecting, receives 500 copies of its most expensive query. This is a **cache stampede**.

Three defences are common.

- **One loader.** On a miss, the first request takes a short lock and fetches the value. The others wait briefly for it or are given the old value.
- **Refresh before expiry.** A background job reloads popular entries before their TTL runs out, so users never see a miss.
- **Spread the expiry times.** Add a random amount to each TTL. Entries that were all stored at once, after a restart for example, then do not all expire in the same second.

```text example stampede readonly
   12:00:00   entry "front-page" expires

   12:00:00.1   request 1    miss -> slow query (2 s)
   12:00:00.1   request 2    miss -> slow query (2 s)
   12:00:00.2   request 3    miss -> slow query (2 s)
   ...
   12:00:01.9   request 500  miss -> slow query (2 s)

   500 copies of the same query. With one loader: 1 query, 499 wait.
```

## When the cache is empty or gone

A cache also changes how the system fails.

A **cold cache** is an empty one, after a restart or a deploy. Every request is a miss until it fills. If the database can only cope because the cache normally absorbs 95% of the reads, a cold cache means twenty times the usual database load, at once.

So test one thing on purpose: can the system survive with an empty cache? If not, the cache is no longer an optimisation. It is a required part of the system, and it needs the same care as the database: more than one copy, monitoring, and a plan for filling it gradually.

Two more rules follow from this.

- **A cache failure should not be an outage.** If the cache cannot be reached, fall back to the database, with a limit on how much load is let through.
- **Never make the cache the only copy.** Anything in it must be recoverable from the source of truth.

## Keys and what goes in them

A cache entry is found by its key, so the key must contain everything the answer depends on. If a page differs by user language, the language belongs in the key. If it differs by user, the user ID does.

Leaving something out is a serious bug. A key of `account-page` with no user ID serves one person's account page to the next visitor. When a cached response contains anything personal, check the key first.

## A cold start {prediction}

A system serves 10,000 reads per second. Its cache has a 98% hit rate. The database handles up to 1,000 reads per second. The cache servers are restarted during the evening peak.

:::question cold
What happens next?
- [ ] Nothing. The cache refills from the database :: It does refill, and while it does every read reaches the database.
- [x] The database receives about 10,000 reads per second, ten times what it can handle :: Normally it sees 2% of the reads, which is 200 per second. With an empty cache it sees all of them, and may fail before the cache can fill.
- [ ] Reads fail because the cached data is gone :: The data is still in the database. The problem is the load.
:::

## Exercise: design the caching {independent}

A news site has 5,000 articles. An article page shows the article text, a comment count, and a "most read today" list of ten links. Articles are edited rarely, though a correction must be visible within one minute. Comment counts change constantly. The site gets 3,000 page views per second at peak, and one front-page article can take half of them.

Decide what to cache, with which key and TTL, and what happens on an edit. Say how you would protect against a stampede on the front-page article.

## One possible answer {walkthrough}

| Entry | Key | TTL | On change |
| --- | --- | --- | --- |
| Article text | `article:{id}` | 10 minutes | Delete on edit |
| Comment count | `comments:count:{id}` | 30 seconds | Nothing. Let it expire |
| Most read today | `most-read` | 60 seconds | Nothing. Recomputed on expiry |

**Edits.** Deleting the entry on edit makes a correction visible on the next request, well within one minute. The 10-minute TTL is the safety net for a missed delete, and it bounds the delay at 10 minutes in that rare case. If one minute must hold even then, lower the TTL to 60 seconds. At this traffic the hit rate stays above 99%.

**Comment counts.** A count that is 30 seconds old is harmless, and deleting the entry on every comment would defeat the cache for a busy article.

**Stampede.** The front-page article gets 1,500 requests per second. When its entry expires, use one loader: the first request reloads it and the rest are served the previous copy for the moment that takes. Refreshing it in the background before expiry works as well.

The whole page could also be cached at the CDN for 30 to 60 seconds. For a news site where every reader sees the same page, that removes most requests before they reach the application at all.
