---
id: course:system-design/module/storage
title: Choose a data store
requires: []
outcomes: []
tasks: []
drills: []
---

Where data lives decides what the system can do quickly, what it can guarantee and how it grows. This module covers the main kinds of data store and how to choose by asking how the data will be read.

## Start from the questions, not the product

A data store is good at some questions and bad at others. So the first step is to list the questions the system will ask of its data. These are called **access patterns**.

- "Get the order with this ID."
- "List this customer's orders, newest first."
- "Find products whose description mentions 'waterproof'."
- "Total sales per region for last month."

Each one favours a different kind of store. Choosing a product first and discovering the questions later is how systems end up with a store that cannot answer what they need.

## Relational databases

A **relational database** keeps data in tables of rows and columns, with a fixed structure, and is queried with SQL. PostgreSQL, MySQL and SQL Server are examples.

Its strengths are broad.

- It answers questions nobody planned for, by joining and filtering tables.
- It enforces rules: a required column, a unique email, an order that must refer to a real customer.
- It supports **transactions**: a group of changes that all happen or none do. Moving money between two accounts is the standard example.

Its limit is scale in one direction. All of this works best on one machine, and spreading a relational database over many machines is hard.

Use a relational database by default. It fits most data, it protects you from many mistakes, and it carries a system a long way. Choose something else when you can name the specific thing it cannot do for you.

## Key-value stores

A **key-value store** does one thing: give it a key and it returns the value stored under that key. It cannot search inside values or join anything. Redis and Memcached keep the data in memory. Others, such as DynamoDB, keep it on disk and spread it across many machines.

Since every operation names one key, the store always knows which machine holds the data. That makes it very fast and easy to spread out.

It fits sessions, caches, counters, feature settings and anything looked up by one identifier. It does not fit data you need to query in several ways.

```text example kinds readonly
   RELATIONAL                         KEY-VALUE

   orders                             key              value
   +----+----------+-------+          "session:9f2c"   {user: 17, ...}
   | id | customer | total |          "cart:17"        [item, item]
   +----+----------+-------+          "views:post:88"  4031
   | 1  | 17       | 40.00 |
   | 2  | 17       | 12.50 |          one question only:
   +----+----------+-------+          "what is stored under this key?"

   any question you can write in SQL
```

## Document stores

A **document store** keeps each record as a self-contained document, usually in a JSON-like form, and lets you query by fields inside it. MongoDB is an example.

A document can hold nested data that a relational design would split across several tables: an order together with its lines and its delivery address. Reading the whole thing is one lookup, and records need not all have the same fields.

The cost appears when data is shared between documents. If each order document holds a copy of the customer's name, changing the name means updating every order. Relational databases avoid this by storing each fact once. Document stores fit data that is read and written as a whole and rarely needs joining.

## Object storage

**Object storage** holds files of any size under a name: images, videos, backups, exports, logs. Amazon S3 and Azure Blob Storage are examples. You upload a file, get it back by name and delete it. There are no queries.

It is cheap per gigabyte, it grows without limit, and it keeps several copies for you. It is slower per request than a database, which does not matter for large files.

The rule is simple: files do not belong in a database. Store the file in object storage and store its name, size and owner as a row in the database.

```text example files readonly
   database row                         object storage

   photo_id   8841                      photos/8841/original.jpg   2.1 MB
   owner      17              ----->    photos/8841/thumb.jpg      40 KB
   caption    "harbour"
   file       photos/8841/original.jpg

   small, queryable facts               large, opaque files
```

## Where does it go {prediction}

A team stores scanned contracts as PDF files of about 5 MB each, inside a column of their relational database. They have 2 million contracts.

:::question files-in-db
What is the main problem?
- [ ] A relational database cannot store binary data :: It can. The question is whether it should.
- [x] The database is now 10 TB, nearly all of it files it can do nothing useful with :: Backups, restores and copies all become slow and costly. Object storage holds the files for less, and the database shrinks to a few gigabytes of rows.
- [ ] PDFs cannot be searched in a database :: True, and that is not the main cost. The size is.
:::

## Search indexes and other special stores

Some questions need a store built for them.

- A **search index**, such as Elasticsearch, answers "which documents contain these words?" quickly, with ranking and tolerance for typing errors. A database's `LIKE '%word%'` reads every row.
- A **time-series database** is built for measurements with a timestamp: store millions of points, query a range, compute averages over intervals.
- A **data warehouse** is built for analysis: totals and trends over years of data. It stores data by column, which makes sums over one column fast and single-row lookups slow.
- A **graph database** is built for following connections: friends of friends, routes, dependencies.

These are usually second stores. The main database stays the source of truth, and a copy of the relevant data is sent to the special store. That copy lags a little, and you must keep it in step. It is a real cost, so add a special store when a need is proven, not in advance.

## Indexes

Whatever the store, one idea decides read speed. An **index** is an extra structure that lets the store find rows by a column without reading the whole table, like the index at the back of a book.

Without an index on `customer_id`, "list this customer's orders" reads every order. With one, it goes straight to the matching rows.

Indexes are not free. Each one takes space and must be updated on every write, so a table with ten indexes is slower to write. Add an index for each question the system asks often, and no more.

## More than one store

Real systems often use several stores, each for what it does best.

```text example several readonly
   +------------------+   orders, customers, payments
   | relational DB    |   the source of truth
   +------------------+
   +------------------+   sessions, cached pages, counters
   | key-value cache  |   can be rebuilt if lost
   +------------------+
   +------------------+   product images, invoices as PDF
   | object storage   |   large files
   +------------------+
   +------------------+   product search
   | search index     |   a copy, fed from the database
   +------------------+
```

Decide for each piece of data which store is the **source of truth**: the one place whose value is correct when two stores disagree. Everything else is a copy that can be rebuilt from it.

## Which store {prediction}

A site needs "search products by words in the name and description, with results ranked by relevance, tolerating small typing errors". The products are in a relational database of 3 million rows.

:::question search-store
What is the usual design?
- [ ] Move all product data into a search index and drop the relational database :: A search index is weak at transactions and rules. Orders and stock still need them.
- [x] Keep the products in the database, and feed a copy of the searchable fields to a search index :: The database stays the source of truth. The index answers the search question it was built for.
- [ ] Add an ordinary index on the description column :: An ordinary index finds exact values or prefixes. It does not find words inside text, rank results or tolerate errors.
:::

## Exercise: place the data {independent}

A ride-booking service has these kinds of data. For each, choose a store and give one sentence of reasoning.

1. Rider and driver accounts.
2. Each trip: rider, driver, start, end, price, payment status.
3. The current location of every active driver, updated every 4 seconds.
4. Photos of drivers' licences.
5. "Find trips whose notes mention a lost item."
6. Total revenue per city per week, for the finance team.

## One possible answer {walkthrough}

1. **Relational database.** Accounts need unique emails, rules and joins with trips.
2. **Relational database.** A trip and its payment must change together in a transaction, and trips are queried in many ways.
3. **In-memory key-value store.** One value per driver, overwritten every few seconds, read constantly, and worthless a minute later. Writing it to the main database would be thousands of pointless writes per second. If it is lost, it refills within seconds.
4. **Object storage**, with a row in the database for the owner and the file's name. Access must be restricted, since these are identity documents.
5. **Search index**, fed from the trip notes. If this is a rare support task, a slow database query might be enough, and a whole new store would not be worth running.
6. **Data warehouse**, or at a small size a scheduled query against a copy of the database. Either way, not the live database at peak time.

Two answers deserve a second look. Number 3 shows that how often data changes and how long it matters can decide the store. Number 5 shows that "which store fits best" and "is it worth adding" are separate questions.
