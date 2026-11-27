---
id: course:system-design/module/approach
title: How to approach a design
requires: []
outcomes: []
tasks: []
drills: []
---

System design is deciding which parts a system needs and how they work together, before the code is written. This module gives you an order to work in, so that a large, vague request becomes a series of small decisions.

## What a design is for

A design answers three questions.

1. **What must the system do?** The features, stated exactly.
2. **How well must it do them?** How many users, how fast, how reliable.
3. **What will it cost?** In machines, in complexity and in work to run it.

Every design is a set of **trade-offs**: choices where gaining one thing costs another. A cache makes reads faster and makes data possibly out of date. A second copy of the database survives a failure and has to be kept in step. There is no best design in general. There is a design that fits these requirements at this size.

A common mistake is to design for a size the system will never reach. A system for 500 users does not need what a system for 50 million needs, and building it anyway costs months and adds parts that can fail.

## The order to work in

Use the same five steps each time.

1. **Requirements.** What it must do, and what is out of scope.
2. **Numbers.** How much traffic and data, roughly.
3. **Interface and data.** The operations it offers and the records it stores.
4. **A simple design.** The fewest parts that could work.
5. **Pressure.** Find what breaks first as load grows or parts fail, and change only that.

The order matters. Without step 1 you solve the wrong problem. Without step 2 you cannot tell whether one machine is enough. Starting at step 5, with queues and shards, before a simple design exists is the usual way designs go wrong.

```text example steps readonly
   1. requirements      what must it do?          what is out of scope?
            |
   2. numbers           how many requests?        how much data?
            |
   3. interface, data   which operations?         which records?
            |
   4. simple design     the fewest parts that could work
            |
   5. pressure          what breaks first?        fix only that
            |
            +---- repeat step 5 until the requirements are met
```

## Two kinds of requirement

**Functional requirements** say what the system does: "a user can upload a photo", "a user sees photos from people they follow".

**Non-functional requirements** say how well: how fast, how available, how much data may be lost, how consistent. They decide the shape of the design far more than the features do. Ask about each of these.

| Question | Why it changes the design |
| --- | --- |
| How many users and requests? | One machine or many |
| Mostly reads or mostly writes? | Caches and replicas help reads, not writes |
| How fast must a response be? | Whether work can be done later, in the background |
| How much downtime is acceptable? | How much redundancy to pay for |
| May data be slightly out of date? | Whether caches and replicas can be used at all |
| May any data be lost? | How writes are confirmed and backed up |

Write the answers down as numbers where you can. "Fast" is not a requirement. "95% of page loads under 300 ms" is.

## Which requirement shapes it {prediction}

Two teams build a "like" button. Team A's product is a company intranet with 2,000 employees. Team B's product is a public app where one post can receive 50,000 likes in a minute.

:::question shape
What is the main reason the two designs differ?
- [ ] The feature is different :: Both do the same thing: record that a user liked a post, and show a count.
- [x] The load is different :: For team A, one database row per like and a count query is enough. For team B, 50,000 writes a minute to one counter needs a different approach.
- [ ] Team B has better engineers :: The requirements decide the design. A good engineer on team A builds the simple version.
:::

## Start with the simplest thing

The simplest design for most systems is the same: clients, one application server, one database. Draw that first.

It is a real design, and it goes further than people expect. One modern server handles thousands of simple requests per second. One database holds hundreds of gigabytes without special effort. Many successful products ran on this shape for years.

Starting simple has a second benefit. It gives you something to test against the numbers. Each part you add later then has a reason: "the database cannot keep up with reads, so add a cache". A part with no stated reason should not be in the drawing.

```text example simple readonly
   +---------+        +-------------+        +----------+
   | clients | -----> | application | -----> | database |
   +---------+        +-------------+        +----------+

   Start here. Add a part only when you can name what it fixes.
```

## Find the bottleneck

A **bottleneck** is the part that limits the whole system. Work flows only as fast as the slowest step allows, so improving any other part changes nothing.

To find it, follow one request through the design and ask of each part: how much can this handle, and how much will it get? The first part where the load exceeds the capacity is the bottleneck. Fix it, then look again, because the next one is now exposed.

Different systems hit different limits first.

- A system with heavy reads usually runs out of database read capacity.
- A system with heavy writes runs out of disk or of a single writer.
- A system that stores large files runs out of storage and bandwidth.
- A system that does long calculations runs out of processor time.

## Where to look first {prediction}

A recipe site has 2 million page views a day. Almost every view reads a recipe. About 500 recipes are added or edited per day. Pages are slow in the evening peak.

:::question bottleneck
Which change is most likely to help?
- [ ] Make writes faster with a queue :: There are 500 writes a day. Writes are not the load.
- [x] Reduce the read load on the database, for example with a cache :: Reads outnumber writes 4,000 to 1, and a recipe changes rarely, so a stored copy can serve most views.
- [ ] Split the data across several databases :: That is a large change aimed at data size or write volume, and neither is the problem here.
:::

## Say what you gave up

A design is easier to judge, and to change later, when each decision is written with its cost.

- "Recipes are cached for 5 minutes. An edit can take 5 minutes to appear."
- "One database, no standby. If it fails, the site is down until a backup is restored, which takes about an hour."
- "Search covers titles only, not the full text."

These sentences are the most useful part of a design document. They tell the next person what was chosen on purpose, and they turn a later complaint into a known trade-off that can be revisited when the requirements change.

## Exercise: ask before you draw {independent}

You are asked to "design a system for sharing files inside a company". Before drawing anything, write the questions you would ask. Aim for at least eight. Group them into what the system must do, and how well it must do it. Then state the two answers that would change the design the most.

## One possible answer {walkthrough}

**What it must do**

1. Who can see a file: only people it is shared with, a team, or everyone in the company?
2. Can files be edited, or only replaced? Are old versions kept?
3. Is there search, and over names only or over contents?
4. Are there folders, links to share, or expiry dates?

**How well**

5. How many employees, and how many files per person?
6. How large is a typical file, and the largest allowed?
7. How quickly must a new file be available to others?
8. How much downtime is acceptable during working hours?
9. May a file ever be lost? For how long are deleted files kept?
10. Are there rules about where the data is stored or who may read it?

**The two that change the most**

- **File size and count** (5 and 6). A thousand people with small documents fit on one storage service with no special design. Video files of several gigabytes mean uploads in parts, transfer that can resume, and a real storage bill.
- **Versions and editing** (2). Replace-only is simple storage. Keeping versions, or letting two people edit one file, brings in conflict handling, which is a much harder problem.

The point of the exercise is that the picture cannot be drawn yet. Two systems that fit the one-line request can differ by a factor of a hundred in size and in difficulty.
