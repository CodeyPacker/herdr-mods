---
id: course:system-design/module/estimates
title: Estimate load and size
requires: []
outcomes: []
tasks: []
drills: []
---

Before choosing parts, you need rough numbers: how many requests arrive each second, and how much data piles up. This module shows how to get them in a few minutes with rounded arithmetic.

## Why rough numbers are enough

An estimate does not need to be right. It needs to be right within a factor of about ten, because design decisions change at those jumps. One server or ten. A database on one disk or data spread over many machines.

So round hard. Use 100,000 seconds in a day, not 86,400. Use powers of ten. An estimate you can do in your head is more useful than a precise one that takes an hour, since its inputs are guesses anyway.

Write the assumptions down next to the result. When the real numbers arrive, you can swap them in and see whether any decision changes.

## Requests per second

Start from users and work down.

1. **Daily active users**: how many people use the system on a normal day.
2. **Actions per user per day**: how often each one does the thing.
3. Multiply to get requests per day.
4. Divide by 100,000 to get the average **requests per second** (often written RPS or QPS, for queries per second).

Traffic is not even. Most systems have a daily peak of two to five times the average, and some have rare spikes far above that. Design for the peak. The average is what you pay for and the peak is what breaks you.

```text example rps readonly
   daily active users            1,000,000
   page views per user per day          20
   --------------------------------------------
   views per day                20,000,000
   seconds per day (rounded)       100,000
   --------------------------------------------
   average                             200 requests per second
   peak (x 3)                          600 requests per second
```

## Reads and writes

Split the number into reads and writes, because they stress different parts. Reads can be served from copies and caches. Writes must reach the one place that holds the truth.

Most systems are **read-heavy**. A social feed might be read a hundred times for every post written. A few are **write-heavy**, such as systems that collect measurements from sensors or record every click.

The ratio tells you where to spend effort. With 100 reads per write, anything that makes reads cheaper pays off 100 times over.

## Storage

Estimate storage the same way.

1. How many new records per day?
2. How large is one record?
3. Multiply, then multiply by the number of days you keep them.

Sizes to remember, rounded:

| Thing | Size |
| --- | --- |
| A short text record (a comment, an order line) | about 1 KB |
| A row with a few numbers and IDs | about 100 bytes |
| A compressed photo | about 1 MB |
| One minute of compressed video | about 10 to 50 MB |

And the units: 1,000 KB is 1 MB, 1,000 MB is 1 GB, 1,000 GB is 1 TB.

Copies multiply the result. If the data is kept three times for safety, plus backups, the disk needed is several times the raw figure.

```text example storage readonly
   new comments per day           2,000,000
   size of one comment                 1 KB
   -------------------------------------------
   per day                             2 GB
   per year (x 400, rounded)         800 GB
   kept in 3 copies                  2.4 TB

   Fits on ordinary disks. No special storage design needed yet.
```

## Which is larger {prediction}

A photo app has 100,000 users who each upload 5 photos a day at 2 MB per photo. Each photo also has a database row of 500 bytes with its owner, date and caption.

:::question photo-storage
After one year, what does the storage look like?
- [ ] The rows and the photos are about the same size :: A photo is 2 MB and its row is 500 bytes. They differ by a factor of 4,000.
- [x] The photos need about 400 TB and the rows about 100 GB :: 500,000 photos a day is 1 TB a day. The rows are tiny by comparison. The two belong in different kinds of storage.
- [ ] Both fit in one ordinary database :: 100 GB of rows does. 400 TB of image files does not, and should go to file storage built for it.
:::

## What one machine can do

To turn load into a machine count you need a feel for capacity. These are rough figures for ordinary hardware. They vary widely with the work being done.

| Part | Rough capacity |
| --- | --- |
| A web server doing simple requests | 1,000 or more requests per second |
| A relational database, simple indexed reads | several thousand per second |
| A relational database, writes | hundreds to a few thousand per second |
| An in-memory cache | 100,000 or more operations per second |
| One disk | several TB |

Use them to sanity-check, not to plan exactly. If the estimate says 600 requests per second at peak, one server can do the work and you want two so that one can fail. If it says 60,000, you need many servers and the database becomes the real question.

## Bandwidth and memory

Two more quick estimates are sometimes needed.

**Bandwidth** is requests per second multiplied by response size. 600 requests per second of 50 KB pages is 30 MB per second. That is fine for a data centre connection and a reason to compress responses and move images to a CDN.

**Memory for a cache** follows from what you want to keep. A common rule is that a small share of the items gets most of the requests. Caching the most popular 20% of 10 million records of 1 KB each needs about 2 GB, which fits in one machine.

## Latency numbers worth knowing

Some operations are thousands of times slower than others. The order matters more than the exact values.

| Operation | Rough time |
| --- | --- |
| Read from memory | under a microsecond |
| Read from a fast local disk | about 0.1 ms |
| A call to another machine in the same data centre | about 0.5 ms |
| A simple database query, with an index | 1 to 5 ms |
| A call across a continent | 40 to 80 ms |
| A call between continents | 100 to 300 ms |

One conclusion follows at once. A request that makes 50 database calls one after another spends 50 to 250 ms on waiting alone. Counting the calls a design makes per request is part of estimating it.

## The spike {prediction}

A ticket site averages 50 requests per second. When tickets for a popular concert go on sale, 200,000 people open the page within the same minute.

:::question spike
What does that minute look like, compared with the average?
- [ ] About the same, spread over the day :: The load is not spread. It arrives in one minute.
- [ ] About 3 times the average, like a normal daily peak :: A normal peak is a multiple of 2 to 5. This is far beyond that.
- [x] Over 3,000 requests per second, more than 60 times the average :: 200,000 in 60 seconds is about 3,300 per second, before anyone refreshes the page. A design sized for the daily peak fails here.
:::

## Exercise: size a system {independent}

A team plans a service for short voice notes. Assume 2 million daily active users. Each sends 10 notes a day and listens to 40. A note is 20 seconds long and takes 100 KB. Each note has a 200-byte record. Notes are kept for one year.

Estimate: the average and peak requests per second for sending and for listening, the storage for the audio and for the records after a year, and the peak download bandwidth. State which of these numbers should worry the team most.

## One possible answer {walkthrough}

**Requests**

| | Per day | Average per second | Peak (x 3) |
| --- | --- | --- | --- |
| Send | 20 million | 200 | 600 |
| Listen | 80 million | 800 | 2,400 |

**Storage after a year**

- Audio: 20 million notes a day at 100 KB is 2 TB a day, or about 800 TB a year. With three copies, about 2.4 PB (1 PB is 1,000 TB).
- Records: 20 million a day at 200 bytes is 4 GB a day, or about 1.6 TB a year.

**Bandwidth at peak**

2,400 downloads per second at 100 KB is 240 MB per second.

**What to worry about**

The request rates are modest. A handful of servers handle 3,000 requests per second. The record data fits in one large database, with some care.

The audio storage is the problem. It is 500 times larger than the records, it grows by 2 TB every day, and its cost continues for as long as notes are kept. It decides the main choices: audio goes to object storage and never into the database, downloads go through a CDN, and the one-year retention rule is worth questioning, since halving it halves the bill.

This is what an estimate is for. It took a few minutes, and it showed which part of the system deserves the design effort.
