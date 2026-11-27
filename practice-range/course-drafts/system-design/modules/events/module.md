---
id: course:system-design/module/events
title: Events and streams
requires: []
outcomes: []
tasks: []
drills: []
---

A queue hands one piece of work to one worker. An event tells any number of interested parts that something happened. This module covers the difference, how an event log works, and what you take on when services communicate this way.

## Commands and events

Two kinds of message look alike and mean different things.

A **command** asks for something to be done: "send this email". It has one intended receiver, and the sender cares that it happens.

An **event** states that something has happened: "order 8841 was placed". It is a fact about the past. The sender does not know or care who reads it. Zero, one or ten parts of the system may react.

The difference decides who depends on whom. With commands, the order service must know about the email service, the warehouse service and the analytics service, and must change whenever one is added. With events, the order service announces "order placed" and knows nothing more. A new consumer is added without touching it.

```text example command-event readonly
   COMMANDS: the sender knows every receiver

   orders ---- "send email" ----------> email
   orders ---- "reserve stock" -------> warehouse
   orders ---- "record sale" ---------> analytics

   EVENTS: the sender announces a fact

                                    +--> email
   orders -- "order placed" --------+--> warehouse
                                    +--> analytics
                                    +--> (anything added later)
```

## Publish and subscribe

The mechanism behind events is **publish/subscribe**. A producer publishes messages to a named **topic**. Each consumer **subscribes** to the topics it cares about, and every subscriber receives its own copy of every message.

Compare this with a work queue, where each message goes to exactly one worker.

| | Work queue | Publish/subscribe |
| --- | --- | --- |
| A message is handled by | One worker | Every subscriber |
| Adding a consumer | Shares the work | Adds a new reaction |
| Typical use | Spread jobs across workers | Tell several systems about a fact |

Both are often combined. Each subscriber gets its own queue of the events, and may run several workers on that queue.

## The log

Many event systems, with Apache Kafka as the best-known example, store events in a **log**: an ordered list that is only ever added to. Each event gets the next number in the list, called its **offset**.

A log differs from a queue in one important way. Reading an event does not remove it. Events stay for a set time, such as seven days, or for ever. Each consumer keeps its own position, which is the offset it has processed up to.

That gives the log three useful properties.

- **Many independent readers.** Each has its own position. A slow one does not hold up the others.
- **Replay.** A consumer can move its position back and read old events again. A new consumer can start from the beginning and build its own view of all past events. A consumer that had a bug can be fixed and run again over the same events.
- **Order.** Events are read in the order they were written.

```text example log readonly
   topic "orders"            offsets grow to the right, nothing is removed

   +----+----+----+----+----+----+----+----+
   | 0  | 1  | 2  | 3  | 4  | 5  | 6  | 7  |  <-- new events appended
   +----+----+----+----+----+----+----+----+
                    ^              ^
                    |              |
        analytics is at 3          email is at 6
        (slow, catching up)        (nearly up to date)
```

## Order and partitions of a log

One log on one machine has a single order and a limit on how much it can take. To scale, a topic is split into several partitions, each its own log. Order is guaranteed inside a partition and not between partitions.

The producer chooses the partition by a key, the same idea as in the partitioning module. All events with the same key go to the same partition and therefore stay in order.

Choose the key by asking which events must stay in order relative to each other. For orders it is the order ID: "placed", "paid" and "shipped" for one order must be read in that sequence. Events of different orders can be handled in any order.

## Which order is kept {prediction}

A topic has 4 partitions, and events are placed by customer ID. Customer 17 produces "address changed" and then "order placed". Customer 42 produces "order placed" between those two.

:::question log-order
What can a consumer rely on?
- [ ] All three events are read in the order they were produced :: Order across different partitions is not guaranteed.
- [x] Customer 17's two events are read in order. Customer 42's event may come before, between or after them :: The same key means the same partition, which is ordered. Another key may be on another partition.
- [ ] No order at all :: Order inside one partition is guaranteed.
:::

## What an event should contain

There are two styles.

A **thin event** carries only identifiers: "order 8841 placed". A consumer that needs details calls the order service. The event stays small, and consumers always get current data. The cost is that every consumer calls back, so the load and the dependency return.

A **fat event** carries the data: the order with its lines, totals and address. Consumers need no call back and can work when the order service is down. The cost is larger messages, and the fact that the data is a snapshot of one moment.

Whichever you choose, an event is a public contract. Other teams' code depends on its fields. Treat changes as you would changes to an API: add fields freely, and never remove or rename one without a version and a migration plan.

## Writing to the database and publishing

A service often has to do two things for one action: save a change to its database and publish an event about it. These are two systems, and no transaction covers both.

- Save first, then publish: a crash in between leaves a saved order that nobody was told about.
- Publish first, then save: a crash in between announces an order that does not exist.

The standard solution is the **outbox pattern**. In the same database transaction that saves the order, the service also inserts a row into an "outbox" table that describes the event. A separate process reads the outbox and publishes each row, marking it as sent. If that process crashes, it starts again and may publish a row twice. So events are delivered at least once, and consumers must be idempotent, as in the queues module.

```text example outbox readonly
   one database transaction             a separate process

   +-----------------------------+      read unsent outbox rows
   | insert into orders ...      |      publish each to the topic
   | insert into outbox          | ---> mark the row as sent
   |   ("order placed", 8841)    |
   +-----------------------------+      crash and restart: a row may
   both rows are saved, or neither      be published twice, never zero
```

## The cost of events

Events loosen the ties between services, and they bring costs that are easy to miss at the start.

- **Everything is eventually consistent.** After "order placed", the warehouse's view is behind for a moment. Screens and processes must tolerate that.
- **The flow is hard to see.** With direct calls you can read the code and follow a request. With events, what happens after "order placed" is spread across every subscriber. Finding out why something did not happen takes good tracing and logs.
- **Failures are quiet.** A direct call that fails returns an error to someone. A consumer that silently stops is noticed only when its backlog is monitored.
- **Duplicates and reordering** have to be handled in every consumer.

Use events where several independent parts need to react to the same fact and none of them has to finish before the user gets an answer. Use a direct call when the caller needs the result to continue.

## Call or event {prediction}

At checkout, the order service must know whether the payment succeeded before it tells the user "order confirmed".

:::question call-or-event
How should the order service talk to the payment service at this point?
- [x] With a direct call, and wait for the result :: The answer decides what the user is told. An event would leave the order service waiting for a reply event, which is a slower and more fragile way to make a call.
- [ ] By publishing "payment requested" and responding to the user at once :: Then the user is told "confirmed" before anyone knows whether the payment worked.
- [ ] Either way, the two are equivalent :: They differ in whether the caller has the result when it responds.
:::

## Exercise: design the events {independent}

A library system lets members borrow and return books. When a book is returned, these things should happen: the book becomes available in the catalogue, the next person on the waiting list is notified, a late fee is charged if the book is overdue, and monthly statistics are updated.

Today the "return" endpoint calls four services one after another, and a failure in any of them fails the return. Redesign it with events. Name the event and its contents, say what stays in the request, and describe how each consumer copes with a duplicate.

## One possible answer {walkthrough}

**In the request.** The loans service marks the loan as returned and inserts a `book_returned` row in its outbox, in one transaction. It responds at once. The member sees "returned" as soon as the fact is recorded, whatever happens to the other services.

**The event.** `book_returned`, keyed by book ID so events for one copy stay in order. A fat event suits it: event ID, loan ID, book ID, member ID, due date and return time. No consumer needs to call back.

**Consumers**

| Consumer | Does | Copes with a duplicate by |
| --- | --- | --- |
| Catalogue | Sets the copy to "available" | Setting a status twice changes nothing |
| Waiting list | Notifies the next member and holds the copy for them | Recording the event ID. A hold for this copy already exists |
| Fees | Charges a fee if the return time is after the due date | Recording the loan ID as charged, in the same transaction as the fee |
| Statistics | Adds to monthly counts | Recording processed event IDs, or recounting from stored events |

**What this changes.** A fault in the statistics service no longer stops a member from returning a book. A new reaction, such as "suggest similar books", is a new subscriber and needs no change to the loans service.

**What to watch.** The catalogue is now briefly behind: a returned book shows as "on loan" for a moment. And each consumer's backlog needs an alert, since a fee service that has stopped produces no error anywhere.
