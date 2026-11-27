---
id: course:system-design/module/replication
title: Replication
requires: []
outcomes: []
tasks: []
drills: []
---

Replication keeps copies of the same data on several machines. It protects against losing a machine and adds capacity for reads. This module covers the usual arrangement, the delay it introduces, and what happens when the main copy fails.

## Why keep copies

A database on one machine has two problems. If the machine fails, the system is down, and data written since the last backup may be gone. And one machine can serve only so many reads.

**Replication** addresses both. Each copy is called a **replica**. With replicas you get:

- **Availability.** Another copy can take over when one fails.
- **Durability.** Data survives the loss of a disk or a machine.
- **Read capacity.** Reads can be spread across the copies.
- **Distance.** A copy can be placed near users in another region.

Replication does not increase write capacity. Every write must still be applied to every copy.

## Leader and followers

The most common arrangement has one **leader** (also called the primary) and one or more **followers** (also called replicas or secondaries).

- All writes go to the leader.
- The leader records each change in a log and sends it to the followers.
- Each follower applies the changes in the same order.
- Reads may go to the leader or to any follower.

One writer keeps things simple. There is a single order of changes, so two copies never have to settle a conflict.

```text example leader readonly
                         writes
   application ----------------------> +----------+
        |                              |  leader  |
        |                              +----------+
        |                               |        |   change log
        |                               v        v
        |                        +----------+ +----------+
        +----- reads ----------> | follower | | follower |
                                 +----------+ +----------+
```

## Synchronous or asynchronous

When the leader receives a write, it can confirm it to the application at two different moments.

**Synchronous.** The leader waits until a follower confirms that it has the change, and only then answers. The data exists in two places before the application is told "saved". The cost is speed, and if the follower is slow or unreachable, writes wait.

**Asynchronous.** The leader answers as soon as it has saved the change itself, and sends it to the followers afterwards. Writes are fast and do not depend on the followers. The cost is a window in which the change exists on the leader only. If the leader dies in that window, the change is lost, although the application was told it was saved.

Many systems use a mix: one follower is synchronous, so every confirmed write is on two machines, and the rest are asynchronous.

| | Synchronous | Asynchronous |
| --- | --- | --- |
| Write speed | Slower | Faster |
| A confirmed write can be lost | No | Yes, if the leader fails at the wrong moment |
| A slow follower | Slows writes | Affects nothing |

## Replication lag

With asynchronous replication, a follower is always slightly behind the leader. This delay is **replication lag**. It is normally a fraction of a second. Under heavy write load, or when a follower is busy, it can grow to seconds or minutes.

Lag produces a specific and confusing bug. A user saves a change, which goes to the leader. The page reloads and reads from a follower that does not have the change yet. The user sees the old value and concludes that the save failed.

```text example lag readonly
   12:00:00.00   user saves new address      -> leader      (has it)
   12:00:00.05   page reloads, reads address -> follower B  (not yet)
                 user sees the OLD address
   12:00:00.30   follower B applies the change
   12:00:01.00   user refreshes              -> follower B  (has it now)
```

## Reading your own writes

The fix is a guarantee called **read-your-writes**: a user always sees their own changes, even if other users see them a moment later. There are several ways to provide it.

- Read from the leader for a short time after a user writes, such as 10 seconds.
- Read from the leader for data that only its owner edits, such as a user's own profile and settings.
- Remember the position in the change log of the user's last write, and read only from a follower that has reached it.

Other users seeing the change half a second late is nearly always fine. What must not happen is a person failing to see what they just did.

## After the save {prediction}

A forum sends all reads to followers, which lag by about 2 seconds at busy times. A user posts a reply and is taken to the thread page.

:::question own-write
What does the user see?
- [ ] Their reply, since the write was confirmed :: Confirmed means the leader has it. The thread page is read from a follower.
- [x] The thread without their reply, until the follower catches up :: The follower is about 2 seconds behind. Many users will post the reply a second time.
- [ ] An error, because the data is inconsistent :: Nothing reports an error. The follower gives a correct answer for a slightly earlier moment.
:::

## When the leader fails

If a follower fails, reads move to the others and little is lost. If the leader fails, nothing can be written until a follower takes its place. That change is called **failover**. It has three steps.

1. **Detect** that the leader is gone, usually by a missed heartbeat for some seconds.
2. **Promote** a follower to be the new leader, preferably the one that is most up to date.
3. **Redirect** writes to the new leader, and make the other followers follow it.

Each step can go wrong.

- **Lost writes.** With asynchronous replication, changes that never reached the promoted follower are gone.
- **False alarms.** A leader that is slow, not dead, may be declared failed. If the limit is too short, failovers happen for no reason. If it is too long, real outages last longer.
- **Two leaders.** If the old leader comes back and still believes it is the leader, both accept writes and the data diverges. This is called **split brain**, and it is the worst outcome. Systems prevent it by making sure the old leader is shut out before the new one starts.

Managed database services automate failover. It still takes time, often 30 seconds to a few minutes, and applications must reconnect and retry.

## More than one leader

Some systems allow writes on several nodes: **multi-leader** setups, used across regions, and **leaderless** stores, where a write is sent to several nodes and counts as saved when enough of them confirm it.

They keep accepting writes when a node or a region is cut off. The price is **conflicts**: two nodes can accept different changes to the same record at the same time, and something must decide the result. The simplest rule, "the last write wins", silently throws one of the changes away.

Choose these only when you need writes to continue in several regions and can say how each conflict is settled. For most systems, one leader is the right design.

## Backups are still needed

Replication copies every change, including the wrong ones. If someone deletes a table by mistake, the delete reaches every follower within a second.

A **backup** is a copy from a point in the past, kept apart from the running system. It protects against the things replication repeats faithfully: mistakes, bugs and deliberate damage. A system needs both. And a backup that has never been restored in a test is a hope, not a backup.

## What survives {prediction}

A database has a leader and two followers, all asynchronous. At 14:00 an engineer runs a command on the leader that deletes all rows from the `orders` table by mistake.

:::question backup
What recovers the orders?
- [ ] Promoting one of the followers :: The delete was replicated. Both followers applied it within a second.
- [x] Restoring from a backup taken before 14:00 :: A backup is a copy of an earlier state. With a saved change log, the restore can stop just before the mistake.
- [ ] Nothing. The data is gone for good :: It is gone from all three live copies, and a backup exists apart from them.
:::

## Exercise: choose the setup {independent}

A clinic booking system stores appointments. It has 300 writes and 6,000 reads per minute. A confirmed booking must never be lost. Patients must see their own booking at once. The clinic can accept about two minutes of downtime if a machine fails, and must be able to recover if staff delete data by mistake.

Describe the replication setup: the number of copies, which are synchronous, where reads go, how failover works and what backups are kept.

## One possible answer {walkthrough}

**Copies.** One leader and two followers, in three separate zones.

**Synchronous or not.** One follower is synchronous. A booking is confirmed only when it is on two machines in two zones, so a confirmed booking survives the loss of the leader. The second follower is asynchronous, so that a slow machine there cannot hold up writes.

**Reads.** The load is small: 100 reads per second. The leader could serve all of it. Send a patient's own bookings to the leader, which gives read-your-writes with no extra mechanism, and send staff schedule views and reports to the followers.

**Failover.** Automatic, and promoting the synchronous follower, since it has every confirmed write. With detection after about 30 seconds and promotion after that, it fits the two-minute allowance. The application retries connections with backoff.

**Backups.** A full backup every night and the change log kept continuously, so the data can be restored to any minute. Test a restore on a schedule.

A simpler answer is worth saying out loud. At this load, the replicas exist for safety and availability, not for capacity. Routing reads to followers adds the lag problem and solves nothing the system has. Using followers only as standbys would be a reasonable design.
