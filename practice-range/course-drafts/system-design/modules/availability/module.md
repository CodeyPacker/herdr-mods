---
id: course:system-design/module/availability
title: Availability and recovery
requires: []
outcomes: []
tasks: []
drills: []
---

"The system must always be up" is not a requirement anyone can build to. This module covers how availability is measured, how the parts of a system combine, and how to plan for the day when a whole site is lost.

## Measuring availability

**Availability** is the share of time, or of requests, in which the system works. It is written as a percentage and often spoken of in "nines".

| Availability | Downtime per year | Downtime per month |
| --- | --- | --- |
| 99% (two nines) | 3.7 days | 7.3 hours |
| 99.9% (three nines) | 8.8 hours | 44 minutes |
| 99.99% (four nines) | 53 minutes | 4.4 minutes |
| 99.999% (five nines) | 5.3 minutes | 26 seconds |

Each extra nine cuts the allowed downtime by ten and costs far more than the one before. At 99.9% a person can be woken up and fix things by hand. At 99.99% there are four minutes a month, so every recovery must be automatic. At 99.999% even a deploy has to be invisible.

So choose the target from what downtime costs the business, and do not reach for the highest number. An internal tool used in office hours has no need for four nines.

## Parts in a row and parts side by side

The availability of a system follows from its parts in two ways.

**In a row (all needed).** If a request needs A and B and C, multiply. Three parts at 99.9% each give 99.7%. Every required part lowers the total.

**Side by side (any one is enough).** If either of two copies can do the job, the system fails only when both fail together. Two copies at 99% each give 99.99%, provided they fail independently.

This gives the two rules of available design: have as few required parts as possible, and have more than one of each.

```text example combine readonly
   IN A ROW: all three are needed

   --> [ A 99.9% ] --> [ B 99.9% ] --> [ C 99.9% ] -->
   0.999 x 0.999 x 0.999 = 99.7%

   SIDE BY SIDE: either one is enough

        +--> [ copy 1  99% ] --+
   -----+                      +----->
        +--> [ copy 2  99% ] --+
   fails only if both fail: 0.01 x 0.01 = 0.0001  ->  99.99%
```

## What the numbers say {prediction}

A service is deployed as a single copy that is available 99.5% of the time. It depends on one database at 99.9% and on an external provider at 99.5%. All three are required.

:::question combined
What availability can the service offer?
- [ ] 99.9%, the best of the three :: Parts in a row cannot do better than the worst of them, and they do worse than that.
- [ ] 99.5%, the worst of the three :: That would be true if the failures always happened at the same time. They mostly do not.
- [x] About 98.9% :: 0.995 times 0.999 times 0.995. That is roughly four days of downtime a year, more than any single part has.
:::

## SLI, SLO and SLA

Three terms make a target precise.

- An **SLI** (service level indicator) is a measurement: "the share of requests answered successfully in under 500 ms".
- An **SLO** (service level objective) is the target for it: "99.9% over 30 days".
- An **SLA** (service level agreement) is a contract with customers that says what happens if a level is missed, such as a refund. It is set lower than the internal SLO, to leave a margin.

Measure what the user experiences. "The server process is running" is a poor indicator. A server can be running and return errors, or be so slow that nobody waits. Count requests that succeeded and were fast enough, measured as close to the user as you can.

## The error budget

An SLO of 99.9% allows 0.1% of requests to fail. That allowance is the **error budget**. In a month of 10 million requests it is 10,000 failures.

The budget turns reliability into something a team can decide with.

- While budget remains, the team can release changes quickly and take risks.
- When the budget is spent, releases slow down and the effort goes to reliability until the service is back within its target.

It also settles the argument about whether to aim for 100%. A system with no budget for failure can never be changed, since every change carries some risk.

## Kinds of redundancy

A standby can be kept in different states of readiness. The more ready it is, the more it costs and the faster it takes over.

| Kind | The spare is | Takeover takes |
| --- | --- | --- |
| Cold | Switched off, or exists only as a backup | Hours |
| Warm | Running at small size, data kept up to date | Minutes |
| Hot (active-passive) | Running at full size, takes no traffic | Seconds to a minute |
| Active-active | Running and serving traffic already | Nearly no time. The others just carry more |

Active-active looks like the obvious choice, and it has two costs. Each site must have room to carry the load of one that fails. And the data must be writable in more than one place, which brings the conflicts from the consistency module.

## Zones and regions

Cloud providers offer two levels of separation.

A **zone** is one or more data centres with their own power and network. Zones in the same region are a few milliseconds apart. Spreading copies over three zones protects against the loss of a building, and the short distance means a database can replicate synchronously between them. This is the normal design and should be the default.

A **region** is a set of zones in one part of the world. Regions are tens or hundreds of milliseconds apart. Running in two regions protects against the loss of a whole region and puts the service near more users. The distance makes synchronous replication slow, so the design must accept either slower writes or some lost data on failover.

Most systems should be multi-zone. Multi-region is a large step in cost and complexity. Take it when a requirement names it: a regional outage is unacceptable, or users far away need low latency.

```text example zones readonly
   REGION (one part of the world)

   +-----------+     +-----------+     +-----------+
   |  zone A   |     |  zone B   |     |  zone C   |
   |  app x 2  |     |  app x 2  |     |  app x 2  |
   |  leader   | --> |  follower | --> |  follower |
   +-----------+     +-----------+     +-----------+
        a few ms apart, synchronous replication is practical

   Losing one zone: 4 of 6 app copies remain, a follower is promoted.
```

## Disaster recovery: RPO and RTO

Some events are larger than a failed machine: a region goes down, data is corrupted by a bug, an account is compromised. Planning for these is **disaster recovery**. Two numbers define the goal.

- **RPO** (recovery point objective): how much data may be lost, measured as time. An RPO of 5 minutes means that after recovery, at most the last 5 minutes of changes are gone.
- **RTO** (recovery time objective): how long recovery may take. An RTO of 1 hour means service is restored within an hour.

They are set by the business and they decide the method.

| Method | RPO | RTO |
| --- | --- | --- |
| Nightly backups, restored by hand | up to 24 hours | hours to a day |
| Backups plus a continuous change log | minutes | hours |
| A warm standby in another region, asynchronous | seconds | minutes |
| Active-active in two regions | close to zero | close to zero |

```text example rpo-rto readonly
        last good copy            failure          service is back
              |                      |                    |
   -----------+----------------------+--------------------+------->
              |<------- RPO -------->|<------- RTO ------>|
                 data that is lost       time spent down
```

## A plan that was never tried

A recovery plan has value only if it works, and the only way to know is to run it.

- **Restore a backup** on a schedule, into a test environment, and check the data.
- **Fail over** on purpose, in a planned window, and measure how long it really takes.
- **Write the steps down** as a runbook: an ordered list that a person who is tired and under pressure can follow.
- **Check the dependencies of the recovery itself.** If the runbook, the passwords or the deploy tool live only in the region that failed, there is no plan.

Teams that practise recovery find the gaps on a quiet afternoon. Teams that do not find them during the outage.

## Which target fits {prediction}

A payroll system runs a pay calculation once a month. Staff use it on working days. Losing a day of entered data would mean re-entering it by hand, which is annoying and possible.

:::question target
Which recovery target is reasonable?
- [ ] RPO and RTO near zero, with active-active in two regions :: That is the most expensive design, for a system whose users can wait and can re-enter a day's work.
- [x] An RPO of a few hours and an RTO of about a day, with frequent backups and a tested restore :: The cost of the outage is small, so a cheap method with a proven restore fits. The important part is "tested".
- [ ] No plan. It is only used monthly :: Losing all of the data would be a serious problem. Backups are cheap.
:::

## Exercise: set the targets {independent}

A hospital runs an appointment booking system. Patients book online at any hour. Reception staff use it from 07:00 to 19:00. If it is down, staff fall back to paper for a short time. A lost booking means a patient who arrives and is not expected.

Propose an SLI, an SLO, an RPO and an RTO, each with a reason. Then describe the redundancy you would use, and name two things you would test regularly.

## One possible answer {walkthrough}

**SLI.** The share of booking and schedule requests that succeed in under 1 second, measured at the load balancer.

**SLO.** 99.9% over 30 days, which allows about 44 minutes a month. Paper covers short gaps, and four nines would cost a great deal more for little gain. It may be worth a separate, stricter target for 07:00 to 19:00, when a failure hits staff and patients together.

**RPO.** Zero for confirmed bookings. A lost booking has a real cost to a patient. That means a confirmed write must be on two machines before it is acknowledged.

**RTO.** 15 minutes. Paper works for that long without real harm.

**Redundancy**

- Application copies in three zones behind a load balancer, with room to lose one zone.
- A database leader with a synchronous follower in a second zone and an asynchronous one in a third. Failover is automatic.
- Backups with a continuous change log, stored in a second region. They protect against a regional loss and against mistakes, with an RPO of minutes and an RTO of hours for that rare case.

A second live region is not justified by these requirements. Stating that as a decision is part of the design.

**Test regularly**

1. Restore a backup into a test environment every month and check that recent bookings are there.
2. Fail the database over to the follower every quarter, during a quiet period, and measure the time against the 15-minute RTO.
