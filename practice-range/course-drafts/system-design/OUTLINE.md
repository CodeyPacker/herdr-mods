# System design

A reading course about designing systems that hold up under load and failure. It has no code to write and needs nothing installed. It builds on the Networking course.

Status: all 16 modules are written, built and registered as `course:system-design`, content version 0.1.0-preview.1. Nobody has worked through it as a learner.

## Who it is for

Someone who has built or worked on a web application or an API and wants to make design decisions on purpose: which parts a system needs, what each one costs, and what happens when one fails. The Networking course is the recommended base, since this course uses load balancers, timeouts, retries and latency without explaining them again.

## Modules

The manifest expands each key with `course:system-design/module/`. Each module is one `module.md` in the Markdown format described at the top of `scripts/course-markdown.mjs`.

| Module | What the reader can do afterwards |
| --- | --- |
| 1. **approach** · How to approach a design | Turn a vague request into requirements and work from a simple design. |
| 2. **estimates** · Estimate load and size | Estimate requests per second, storage and bandwidth. |
| 3. **scale** · Scale up and scale out | Find the state that stops an application from running as many copies. |
| 4. **storage** · Choose a data store | Choose a store from the questions the system asks of its data. |
| 5. **caching** · Caches | Design keys, expiry and invalidation, and survive a stampede and a cold start. |
| 6. **replication** · Replication | Handle replication lag, failover and the need for backups. |
| 7. **partitioning** · Partitioning | Choose a partition key and name what partitioning takes away. |
| 8. **consistency** · Consistency and its trade-offs | Decide which data needs strong consistency. |
| 9. **queues** · Queues and background work | Move work onto a queue with workers that are safe to repeat. |
| 10. **events** · Events and streams | Tell a command from an event and publish reliably with an outbox. |
| 11. **failure** · Design for failure | Contain a failure with timeouts, breakers, bulkheads and fallbacks. |
| 12. **availability** · Availability and recovery | Set availability and recovery targets as numbers. |
| 13. **observe** · See what the system is doing | Choose metrics, logs and traces, and alert on what users experience. |
| 14. **overload** · Protect the system from overload | Use rate limits, load shedding and backpressure. |
| 15. **worked** · Worked design: a link shortener | Follow a complete design and revise it when a requirement changes. |
| 16. **review** · Review a design and make one | Review a flawed design and produce one, without help. |

The course has 182 steps, 32 questions and 40 examples (mostly plain-text diagrams), in about 22,000 words.

## How a module is built

Each module explains an idea in short steps with diagrams and tables, asks two questions where the reader predicts an outcome, and ends with an exercise on paper followed by one possible answer. Every exercise uses a different invented system, so no single theme runs through the course.

## Decisions

- D1: **A reading course.** A design cannot be checked by running it. The exercises are done on paper and compared with a worked answer that says it is one of several good ones.
- D2: **Numbers before parts.** Estimation is module 2, and every later module justifies a part with a number. The worked design decides against partitioning because the estimate says the data fits on one machine.
- D3: **Simple first.** The course repeats one rule: start with clients, one application and one database, and add a part only when a stated reason exists. The review module asks which part of a design has no reason to exist.
- D4: **Products are named as examples only.** PostgreSQL, Redis, Kafka, S3 and others are mentioned so that the reader can recognise them. No lesson depends on one, and no cloud provider is assumed.
- D5: **Rough figures are stated as rough.** Capacity and latency tables are rounded and labelled as typical. They are for orders of magnitude.
- D6: **One worked design and one review module.** Module 15 walks through a complete design. Module 16 adds no new ideas.
- D7: **Security and privacy advice is marked as general guidance.** For example the note on what must not be written to logs.

## Checks

`tests/course-system-design.test.mjs` checks the built pack: 16 available modules, no exercises to run, every example read-only with a known fence and no line over 76 characters, every question shown with feedback on every choice, an exercise and a worked answer in every module, example domains only, and nothing that looks like a live credential. It also drives an enrollment through the course service.

## Not verified

- Nobody has opened the course in the app, so the look of the tables and diagrams at the pane's real width is unseen.
- The arithmetic in the estimates and answers was checked by hand by the author. The capacity and latency figures were not checked against current sources.
- The designs in the worked answers were not built or tested.
- The text was reviewed by its author only.

## Scope

Outside this course: consensus algorithms, distributed transactions in depth, specific cloud services, cost modelling, security architecture, data pipelines and machine learning systems.
