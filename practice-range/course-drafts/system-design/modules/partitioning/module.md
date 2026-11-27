---
id: course:system-design/module/partitioning
title: Partitioning
requires: []
outcomes: []
tasks: []
drills: []
---

When the data or the write load no longer fits on one machine, it has to be split. This module covers how data is divided, how the choice of key decides everything that follows, and what splitting takes away.

## What partitioning is

**Partitioning** splits one large set of data into smaller sets that live on different machines. Each piece is a **partition** or a **shard**, and splitting a database this way is called **sharding**.

Replication and partitioning solve different problems, and large systems use both.

- Replication keeps the same data on several machines. It helps reads and survives failures.
- Partitioning puts different data on different machines. It helps writes and total size.

Each partition is normally replicated too, so every shard has its own leader and followers.

```text example shards readonly
   one database                  partitioned by customer

   +--------------------+        +---------+ +---------+ +---------+
   | all customers      |        | shard 1 | | shard 2 | | shard 3 |
   | all orders         |  --->  | A to H  | | I to P  | | Q to Z  |
   | 4 TB, at its limit |        | 1.3 TB  | | 1.4 TB  | | 1.3 TB  |
   +--------------------+        +---------+ +---------+ +---------+
```

## The partition key

Every record is placed by its **partition key**: one field whose value decides the shard. For a system with many customers it is often the customer ID.

The key is the most important decision in a partitioned design, and it is hard to change afterwards. A good key does two things.

- It **spreads the data and the load evenly** across the shards.
- It **keeps data that is used together on the same shard**, so the common requests need only one of them.

A request that includes the key goes straight to one shard. A request without it must ask every shard and combine the answers. This is a **scatter-gather** query, and it is slow, costly and only as reliable as the least reliable shard.

So choose the key from the access patterns. If nearly every request is "something for this customer", the customer ID is the key.

## Two ways to map keys to shards

**By range.** Each shard holds a continuous range of keys: A to H, I to P, Q to Z. Range queries stay cheap, since neighbouring keys sit together. The risk is uneven load. If the key is a date, every new record lands on the last shard, and one machine takes all the writes.

**By hash.** A hash function turns the key into a number that looks random, and the number decides the shard. The load spreads evenly whatever the keys look like. The price is that neighbouring keys end up scattered, so a range query has to ask every shard.

| | By range | By hash |
| --- | --- | --- |
| Even spread | Only if the keys are evenly used | Yes |
| Range queries | One or a few shards | Every shard |
| Typical risk | All new data on one shard | Nothing stays together |

## Hot keys

Even a perfect spread of keys does not mean an even spread of load. If one key gets far more traffic than the others, the shard that holds it is overloaded while the rest are idle. That key is a **hot key**, and its shard a **hot spot**.

One famous account with millions of followers, one very large customer or one viral post can each be a hot key. Adding shards does not help, since the hot key still lives on exactly one of them.

Ways to deal with it:

- **Cache** the hot item, so most reads never reach the shard.
- **Split the key further**, for example by adding a suffix so one large customer's data is spread over several shards.
- **Give a known large customer a shard of its own.**

## The date key {prediction}

A system stores sensor readings and partitions them by range on the reading's timestamp, one shard per month. It receives 20,000 new readings per second.

:::question date-key
How is the write load spread?
- [ ] Evenly, since each shard holds one month :: Each shard holds the same amount in the end. The writes do not arrive evenly.
- [x] All of it lands on the shard for the current month :: Every new reading has a timestamp of now. One shard takes 20,000 writes per second and the others take none.
- [ ] Randomly across all shards :: That is what hashing gives. Range partitioning keeps neighbouring keys together, and all new timestamps are neighbours.
:::

## Adding shards

Sooner or later a partitioned system needs more shards, and data must move. This is **rebalancing**. How much has to move depends on how keys are mapped.

The naive mapping is `hash(key) mod N`, where N is the number of shards. It is simple and has a serious flaw: when N changes from 4 to 5, the result changes for almost every key, so nearly all the data has to move at once.

Two designs avoid that.

- **Many fixed partitions.** Create far more partitions than machines at the start, for example 1,000 partitions on 4 machines. A key always maps to the same partition. To add a machine, move some whole partitions to it. Only the data in those partitions moves.
- **Consistent hashing.** Keys and machines are placed on the same circle of hash values, and each key belongs to the next machine around the circle. Adding a machine takes over one section of the circle from its neighbour, so only that section's keys move.

Either way, adding the fifth machine moves about a fifth of the data, not all of it.

```text example rebalance readonly
   hash(key) mod N, going from 4 shards to 5

   key hash    mod 4    mod 5
   ----------------------------
   1000        0        0       stays
   1001        1        1       stays
   1002        2        2       stays
   1003        3        3       stays
   1004        0        4       moves
   1005        1        0       moves
   1006        2        1       moves
   1007        3        2       moves
   ...         only 4 keys in every 20 keep their shard
```

## What partitioning takes away

A single database gives you features that stop working across shards, or become slow and complicated.

- **Joins across shards.** The database cannot join rows that live on different machines. The application must fetch from both and combine them.
- **Transactions across shards.** "All or nothing" is easy on one machine and hard across several. It needs a coordination protocol that is slower and can leave things stuck when a machine fails.
- **Unique rules.** "This email is used only once" cannot be checked by one shard when the other emails are elsewhere.
- **Totals and reports.** Any question about all the data is a scatter-gather query.
- **Operations.** Backups, schema changes and upgrades are done once per shard.

This is why partitioning comes last. Scale up, add caches, add read replicas, move old data to an archive and move large files to object storage first. Each of those is cheaper than sharding and can be undone.

## The email that must be unique {prediction}

A system is partitioned by user ID across 8 shards. It must guarantee that no two accounts share an email address.

:::question unique
Why is that hard here?
- [ ] Hashing changes the email addresses :: The stored email is unchanged. Hashing only decides where a record is placed.
- [x] Two accounts with the same email can land on different shards, and no single shard sees both :: Asking all 8 shards on every sign-up is slow, and two sign-ups at the same instant could still both pass. A common fix is a small table keyed by email, in one place, that is written first.
- [ ] Each shard allows only one email :: A shard holds many users. The trouble is that the check spans all of them.
:::

## Exercise: pick the key {independent}

A messaging product has 40 million users in 2 million group chats. Messages are 500 bytes on average, and 3 billion are sent per day. The main requests are:

1. Show the latest 50 messages in a chat.
2. Send a message to a chat.
3. Show a user's list of chats with the latest message of each.
4. Search a user's messages for a word. This is rare.

One database can no longer hold the messages. Choose a partition key for the message data, say whether you would map by range or by hash, name the request that suffers, and name one hot-key risk.

## One possible answer {walkthrough}

**Key: the chat ID, mapped by hash.**

Requests 1 and 2 are by far the most frequent, and both name one chat. With the chat ID as the key, all of a chat's messages are on one shard, and each of those requests touches exactly one. Inside the shard, messages are sorted by time, so "the latest 50" reads neighbouring rows.

Hashing is right because chat IDs carry no meaning worth keeping in order, and hashing spreads 2 million chats evenly. Mapping by range on time would send every new message to one shard, as in the sensor example.

**The request that suffers: 3.** A user's chats are spread over many shards. Fetching the latest message of each would be a scatter-gather query on every app open. The usual answer is a second set of data, keyed by user ID, that holds each user's chat list with a preview. It is updated when a message is sent. This stores the same fact twice in exchange for a one-shard read.

Request 4 also crosses shards. Since it is rare, a separate search index fed from the messages is the normal approach.

**Hot key.** One huge chat, such as a company-wide announcement channel with 100,000 members, puts all its traffic on one shard. Its recent messages can be cached, and a known giant can be given its own shard.

The size check: 3 billion messages at 500 bytes is 1.5 TB per day. That confirms the premise. No single machine holds a year of this.
