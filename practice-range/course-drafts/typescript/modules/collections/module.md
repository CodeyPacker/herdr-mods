---
id: course:ts-foundations/module/collections
title: Transform arrays, maps and sets
requires: ["array","loop","object-shape","function","optional"]
outcomes: [{"id":"predict","can":"Trace selection and transformation and explain how a Set treats duplicates.","assessment":["predict","explain"]},{"id":"map-count","can":"Trace a Map that counts with get, set and ??.","assessment":["count"]},{"id":"titles","can":"Keep the names of products in stock","assessment":["course:ts-foundations/task/collections-titles"]},{"id":"owner-counts","can":"Count votes per choice","assessment":["course:ts-foundations/task/collections-owner-counts"]},{"id":"unique","can":"List distinct stops","assessment":["course:ts-foundations/task/collections-unique"]}]
tasks: [{"id":"course:ts-foundations/task/collections-titles","path":"tasks/titles/task.json"},{"id":"course:ts-foundations/task/collections-owner-counts","path":"tasks/owner-counts/task.json"},{"id":"course:ts-foundations/task/collections-unique","path":"tasks/unique/task.json"}]
review: {"task":"course:ts-foundations/task/collections-unique","afterModule":"course:ts-foundations/module/boundary","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["callbacks/predicate","arrays/find"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

Arrays have methods that take a small function and apply it to every item. A `Set` keeps each value once. A `Map` stores one value per key.

## Select, transform and group

A function passed to another function is a callback. `p => p.inStock` is a short arrow function that returns `p.inStock`.

- `filter(callback)` keeps the items where the callback returns `true`, in order.
- `map(callback)` returns one new item for each input item.
- `new Set(values)` keeps each distinct value once.
- A `Map` holds one value per key: `set(key, value)` writes, `get(key)` reads, and `get` gives `undefined` for a missing key.

## Filter, then map {prediction}

Read the example and predict what it prints.

```typescript example trace
const products = [{ name: "Tea", inStock: true }, { name: "Jam", inStock: false }, { name: "Tea", inStock: true }];
const names = products.filter(p => p.inStock).map(p => p.name);
console.log(names.join(", "));

```

```output
Tea, Tea
```

:::question predict example=trace
Which names print?
- [x] Tea, Tea :: Read the chain left to right. `filter` keeps the first and third products, in order. `map` turns each kept product into its `name`. Two products are called Tea, and `filter` and `map` never remove duplicates.
- [ ] Tea, Jam :: Jam is out of stock, so `filter` drops it.
:::

## Put the names in a Set {prediction}

Suppose the names went into a `Set`: `new Set(names)`.

@example trace

:::question explain example=trace
Would `new Set(names)` keep both copies of `"Tea"`?
- [ ] Yes. Each product creates a new entry. :: Two different products can have equal name strings.
- [x] No. Equal strings share one entry. :: A `Set` keeps each distinct value once.
:::

## Count with a Map {prediction}

Read the example and predict what it prints.

```typescript example count
const colors = ["red", "blue", "red"];
const counts = new Map<string, number>();
for (const color of colors) {
  counts.set(color, (counts.get(color) ?? 0) + 1);
}
console.log(counts.get("red"), counts.get("green"));

```

```output
2 undefined
```

:::question count example=count
What does `counts.get("green")` print?
- [ ] 0 :: `?? 0` only runs inside the loop. Reading a missing key gives `undefined`.
- [x] undefined :: `"green"` was never set, so the `Map` has no value for it.
:::

## Keep the names of products in stock {modification}

Return the names of products that are in stock. The starter keeps every product.

@task collections-titles

## Count votes per choice {independent}

Build a `Map` that counts how often each choice appears.

@task collections-owner-counts
