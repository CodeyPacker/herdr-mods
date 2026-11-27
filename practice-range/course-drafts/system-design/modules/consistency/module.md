---
id: course:system-design/module/consistency
title: Consistency and its trade-offs
requires: []
outcomes: []
tasks: []
drills: []
---

Once data lives on more than one machine, the copies can disagree for a while. This module covers what "consistent" means, why a system sometimes has to choose between a correct answer and any answer, and how to decide what each piece of data needs.

## The problem

With one database on one machine, a read returns the latest write. Nothing else is possible, so nobody thinks about it.

With replicas, caches and partitions, there are several copies, and they are updated at slightly different times. A read may now return an older value, depending on which copy answers. **Consistency** is the word for how much of that a system allows.

It is not a matter of right and wrong designs. Stricter consistency costs speed and availability. Looser consistency costs correctness in the moments after a change. The work is to give each kind of data the level it needs and no more.

## Strong and eventual

Two ends of the range are worth naming.

**Strong consistency.** Every read returns the most recent confirmed write, whichever copy answers. The system behaves like a single machine. To do this, a write is not confirmed until enough copies have it, and a copy that might be behind does not answer reads.

**Eventual consistency.** A write is confirmed quickly and reaches the other copies afterwards. If the writes stop, all copies become the same in the end. In between, different readers may see different values.

| | Strong | Eventual |
| --- | --- | --- |
| A read after a write | Always sees it | May see the old value briefly |
| Write speed | Slower, waits for copies | Faster |
| When copies cannot reach each other | Some requests are refused | Keeps answering |
| Fits | Balances, stock at checkout, unique names | Feeds, counters, profiles, search results |

```text example eventual readonly
   write "price = 12" confirmed on copy A at 12:00:00.0

   time          copy A    copy B    copy C
   12:00:00.0    12        10        10       readers may see 10 or 12
   12:00:00.2    12        12        10
   12:00:00.5    12        12        12       all copies agree again
```

## Guarantees in between

Most systems need something between the two ends. Three guarantees cover the common cases.

- **Read-your-writes.** A user always sees their own changes. Others may see them later. This removes the "my save was lost" confusion from the replication module.
- **Monotonic reads.** A user never sees time go backwards. Without it, a user can see a new comment, refresh, land on a slower copy and watch the comment vanish. A simple way to get it is to send each user to the same copy every time.
- **Consistent prefix.** Changes are seen in the order they happened. Without it, a reader can see an answer before the question it replies to.

These are far cheaper than strong consistency, and they are usually what people actually want when they say "it must be consistent".

## Going backwards {prediction}

A user refreshes a discussion page twice. Each refresh is served by a random follower. Follower A is up to date. Follower B is 5 seconds behind. A new reply was posted 2 seconds ago.

:::question monotonic
What can the user see?
- [ ] The reply on both refreshes :: Only if both happen to be served by follower A.
- [x] The reply on the first refresh and not on the second :: If A serves the first and B the second, the reply appears and then disappears. Monotonic reads is the guarantee that prevents this.
- [ ] An error, since the followers disagree :: Each follower answers correctly for its own moment. Nothing detects the difference.
:::

## When the network splits

Machines in a distributed system talk over a network, and networks fail. A **network partition** is a failure in which some machines cannot reach others, although all of them are still running. (This is a different use of the word from data partitioning.)

During a partition, a copy that receives a request cannot check with the other side. It has two choices.

- **Refuse**, because it cannot be sure its data is current. The system stays consistent and is unavailable for that request.
- **Answer anyway**, with what it has. The system stays available and may return old data or accept a write that conflicts with one on the other side.

There is no third choice. This is the **CAP theorem**: when a partition happens, a system can keep consistency or availability, not both. Partitions cannot be ruled out, so the real decision is which of the two to give up while one lasts.

```text example split readonly
   +----------------+        X        +----------------+
   | copy A         |   link broken   | copy B         |
   | sees clients 1 |                 | sees clients 2 |
   +----------------+                 +----------------+

   choose consistency:   B refuses requests until the link is back
   choose availability:  both answer, and may disagree until it is
```

## Choosing per piece of data

The choice is made per kind of data, not once for the whole system. Ask what a wrong answer costs.

| Data | A stale or conflicting value means | Choose |
| --- | --- | --- |
| Account balance when approving a payment | Money spent twice | Consistency |
| The last seat on a flight | Two people sold one seat | Consistency |
| A username at sign-up | Two accounts with one name | Consistency |
| Number of likes | A count that is off by a few | Availability |
| A shopping cart | An item that reappears | Availability |
| A product description | An old description for a moment | Availability |

A shop is a good example of mixing both. Browsing and the cart stay available at almost any price, since a refusal loses a sale. The payment step is strict, since a wrong answer costs real money.

## Transactions

Inside one database, **transactions** give strong guarantees for a group of changes. The usual summary is **ACID**.

- **Atomic.** All of the changes happen, or none.
- **Consistent.** The rules of the data hold afterwards.
- **Isolated.** Transactions running at the same time do not see each other's half-done work.
- **Durable.** Once confirmed, a change survives a crash.

A transfer between two accounts in one database is safe because of this. Take 50 from one, add 50 to the other, and no failure can leave only half done.

Across two databases or two services, there is no such built-in guarantee. That is one more reason to keep data that must change together in the same database.

## When a change spans services

Sometimes one business action must change data in several services: an order service, a payment service and a stock service. No single transaction covers them.

The usual approach is a **saga**: a sequence of local steps, each a normal transaction in one service, and for each step an undo action, called a **compensation**.

1. Create the order as "pending".
2. Reserve the stock. If that fails, cancel the order.
3. Take the payment. If that fails, release the stock and cancel the order.
4. Mark the order "confirmed".

A saga is not atomic. Between the steps, others can see the in-between state, such as an order that is pending. The design must make those states visible and sensible. That is why real systems show "pending" and "processing", and why they send a correction afterwards when a later step fails.

## Avoid the conflict

The cheapest way to deal with conflicting writes is to design so that they cannot happen.

- **One writer per piece of data.** If only one service or one leader changes a record, there is nothing to reconcile.
- **Record events, do not overwrite totals.** Store each like as its own row and add them up. Two writers adding rows cannot conflict. Two writers overwriting one counter can.
- **Compare before writing.** Include a version number in an update: "set the price to 12 if the version is still 7". A writer whose copy was old is refused and must read again. This is **optimistic locking**.

## The last seat {prediction}

A booking system keeps "seats left: 1" for a concert. Two users press "buy" at the same instant. Each request reads the value 1, sees a seat is free, and writes 0.

:::question last-seat
What is the outcome, and what prevents it?
- [ ] One request fails by itself, since the second write is the same as the first :: Both writes succeed. Neither knows about the other.
- [x] Both purchases succeed and one seat is sold twice. A transaction or a version check prevents it :: Each read happened before the other's write. Making "check and decrease" one atomic step, or refusing a write based on an old version, lets only one through.
- [ ] The database detects the conflict in every case :: Only if it is asked to, through a transaction with the right isolation or a conditional update.
:::

## Exercise: assign the level {independent}

An online bank's mobile app shows or does these things. For each, say whether it needs strong consistency or can be eventual, and what a user would notice if you chose wrongly.

1. The balance shown on the home screen.
2. The check that a transfer does not exceed the balance.
3. The list of past transactions.
4. A "you spent 12% more on food this month" insight.
5. Freezing a stolen card.
6. The user's own display name after editing it.

## One possible answer {walkthrough}

1. **Eventual, with read-your-writes.** A balance that is a second old is acceptable for viewing. After the user's own transfer, it must show the new figure, or they will think it failed.
2. **Strong.** This is a decision about money. It must read the real balance and decrease it in one transaction. A stale read here lets someone spend the same money twice.
3. **Eventual, with consistent prefix.** A new transaction may appear a moment late. The order must be right, and entries must not appear and vanish.
4. **Eventual.** It can be computed nightly. Nobody is harmed by an insight that is a day old.
5. **Strong.** Every system that approves a payment must see the freeze at once. A copy that has not heard about it yet would approve a thief's purchase. Here the system should refuse payments when it is unsure.
6. **Read-your-writes.** The user must see the new name at once. Others seeing the old one for a second is harmless.

Only two of the six need strong consistency, and both are moments where a decision is made. That ratio is typical. Showing data can usually be eventual. Deciding on data usually cannot.
