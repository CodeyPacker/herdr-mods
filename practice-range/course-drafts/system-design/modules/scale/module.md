---
id: course:system-design/module/scale
title: Scale up and scale out
requires: []
outcomes: []
tasks: []
drills: []
---

When one server is no longer enough, there are two ways to get more capacity. This module covers both, what has to be true of an application before it can run on many machines, and how machines are added and removed automatically.

## Two directions

**Scaling up** (vertical scaling) means replacing a machine with a larger one: more processors, more memory, faster disks.

**Scaling out** (horizontal scaling) means adding more machines of the same size and spreading the work across them.

| | Scale up | Scale out |
| --- | --- | --- |
| Change to the application | None | It must work as many copies |
| Limit | The largest machine you can buy | Almost none for stateless work |
| Cost at the high end | Rises steeply | Rises in proportion |
| Failure of one machine | Total outage | Lose a share of capacity |
| Effort to operate | Low | Higher: many machines, a load balancer |

Scaling up is the right first move more often than its reputation suggests. It needs no redesign, and a single large machine is simple to run. Its two real limits are the ceiling and the fact that one machine is one point of failure.

```text example directions readonly
   SCALE UP                         SCALE OUT

   +--------+      +-----------+    +--------+     +----+ +----+ +----+
   | small  | ---> |           |    | small  | --> |    | |    | |    |
   | server |      |   large   |    | server |     +----+ +----+ +----+
   +--------+      |   server  |    +--------+     three of the same,
                   +-----------+                   behind a load balancer
```

## What "stateless" means

Scaling out puts several copies of the application behind a load balancer. Any request may reach any copy. That works only if every copy can answer every request, which means no copy may keep information that another copy would need.

**State** is anything the system must remember between requests: who is logged in, what is in a shopping cart, an uploaded file, a counter. An application is **stateless** when it keeps none of that in its own memory or on its own disk. All state lives in a shared place that every copy can reach: a database, a cache or file storage.

A stateless copy can be started, stopped or replaced at any moment without anything being lost. That one property is what makes the rest of this module possible.

## Where state hides

State often sits in the application without anyone having decided it should.

| Hidden state | What goes wrong with several copies | Where it belongs |
| --- | --- | --- |
| Login sessions in memory | The user is logged out when a request reaches another copy | A shared cache or a signed token |
| Uploaded files on local disk | The file exists on one copy only | Object storage |
| An in-memory cache of data | Copies disagree after an update | A shared cache, or accept short-lived differences |
| A counter or a rate limit in memory | Each copy counts separately | A shared store |
| A scheduled job inside the app | It runs once per copy | One scheduler, or a lock |

The last row surprises people. An application that sends a daily report at 08:00 will send three reports when it runs as three copies.

## The upload that vanished {prediction}

A site runs as three copies behind a load balancer. A user uploads a profile photo, which the application saves to a folder on its local disk. The page then reloads and requests the photo.

:::question lost-upload
What does the user see?
- [ ] The photo, every time :: Only the copy that received the upload has the file.
- [x] The photo about one time in three :: The request for the photo goes to whichever copy the load balancer picks. Two of the three do not have the file.
- [ ] An upload error :: The upload itself worked. The fault shows up when another copy is asked for the file.
:::

## The database does not scale out the same way

Application servers are easy to copy because they hold no state. The database is the opposite: it is where the state lives. Ten copies of a database are ten databases that disagree, unless something keeps them in step.

So the usual picture is many application servers and one database, and the database is scaled up for as long as possible. When that is no longer enough, there are specific techniques, each with a cost, and each has its own module later in the course.

- **Caching** takes repeated reads away from the database.
- **Replication** adds copies that can serve reads.
- **Partitioning** splits the data across several databases.

Try them in that order. Each one is harder than the one before.

```text example tiers readonly
                          +--> app copy 1 --+
   clients --> load ------+--> app copy 2 --+--> database
               balancer   +--> app copy 3 --+    (one, scaled up)
                          +--> app copy 4 --+

   easy to add: application copies       hard to add: databases
```

## Adding machines automatically

Traffic changes through the day. Running enough machines for the evening peak all night wastes money. **Autoscaling** adds copies when load rises and removes them when it falls.

You give it three things.

- A **signal** to watch, such as average processor use or requests per copy.
- A **target** for that signal, such as 60%.
- A **minimum and maximum** number of copies.

Three details decide whether it works in practice.

- **Start-up time.** If a new copy needs four minutes to be ready, it cannot help with a spike that lasts two. Keep copies quick to start, and keep some spare capacity for sudden jumps.
- **The minimum.** Never fewer than two, so one can fail.
- **Removal.** A copy that is being removed must finish its current requests first. This is the draining described in the networking course.

## Capacity and spare room

How many copies are enough? Take the peak load, divide by what one copy can handle, and then add room for failure.

A useful rule is to plan for losing one copy, or one location, at the worst moment. If the peak needs four copies, run five or six, so that the loss of one does not push the others over their limit. Without that room, one failure overloads the rest, and they fail in turn. That chain is called a **cascading failure**.

```text example headroom readonly
   peak load: 2,000 requests/s      one copy handles: 500 requests/s

   4 copies   each at 100%   one fails -> 3 copies at 133%   overload
   5 copies   each at  80%   one fails -> 4 copies at 100%   no room left
   6 copies   each at  67%   one fails -> 5 copies at  80%   safe
```

## Enough copies {prediction}

A service needs 6 copies to carry its peak. The team runs exactly 6, split evenly over 3 zones (independent locations in one region). One zone loses power at the peak.

:::question zone-loss
What happens?
- [ ] Nothing visible. The load balancer sends traffic to the other zones :: It does, and those 4 copies now receive the load of 6.
- [x] The remaining 4 copies are overloaded and the service slows or fails :: Each must carry 150% of what it can handle. Surviving a zone loss needs 9 copies, 3 per zone, so that any 2 zones carry the peak.
- [ ] Autoscaling adds copies at once and nobody notices :: New copies take minutes to start, and the overload begins in seconds.
:::

## Exercise: make it scale out {independent}

An application runs on one server. It does these things:

1. Keeps login sessions in memory.
2. Stores uploaded invoices as files in `/var/data/invoices`.
3. Keeps a list of the 100 most-viewed products in memory, refreshed every 10 minutes.
4. Runs a job every night at 02:00 that emails unpaid-invoice reminders.
5. Limits each user to 5 login attempts per minute, counted in memory.

The team wants to run four copies behind a load balancer. For each of the five, say what breaks and what you would change. Say which one could be left as it is.

## One possible answer {walkthrough}

1. **Sessions.** A user is logged out whenever a request lands on another copy. Move sessions to a shared cache, or use signed tokens that any copy can check.
2. **Invoice files.** A file exists on one copy only, and is lost when that copy is replaced. Move the files to object storage, and store only their location in the database.
3. **Top products.** Each copy builds its own list, and they may differ slightly for a few minutes. This one can stay. The data is not critical, and a small difference between copies does no harm. It costs four queries every 10 minutes, not one.
4. **Nightly job.** Every copy runs it, so each customer gets four reminders. Run the job in one place: a separate scheduled task outside the web copies, or guard it with a lock in the database so only one copy proceeds.
5. **Login limit.** Each copy counts on its own, so the real limit becomes 20 attempts a minute, spread by the load balancer. Count in a shared store.

Point 3 is the lesson worth keeping. Not all in-memory state is a fault. The question for each piece is: what happens when two copies disagree about it? If the answer is "nothing that matters", leave it alone.
