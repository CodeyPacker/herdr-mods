---
id: course:ts-foundations/module/generic
title: Generics
requires: ["function","array","optional","transform"]
outcomes: [{"id":"predict","can":"Identify the runtime values returned by a generic function and explain a type-only projection.","assessment":["predict","explain"]},{"id":"constraint","can":"Use a constraint to read a field on a generic value.","assessment":["constraint"]},{"id":"first","can":"Keep the first value even when falsy","assessment":["course:ts-foundations/task/generic-first"]},{"id":"edit-shapes","can":"Describe an article preview and patch","assessment":["course:ts-foundations/task/generic-edit-shapes"]},{"id":"pair","can":"Keep both sides of a pair","assessment":["course:ts-foundations/task/generic-pair"]}]
tasks: [{"id":"course:ts-foundations/task/generic-first","path":"tasks/first/task.json"},{"id":"course:ts-foundations/task/generic-edit-shapes","path":"tasks/edit-shapes/task.json"},{"id":"course:ts-foundations/task/generic-pair","path":"tasks/pair/task.json"}]
review: {"task":"course:ts-foundations/task/generic-pair","afterModule":"course:ts-foundations/module/utility","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["generics/first","utility/pick","utility/omit","utility/partial"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

A generic function works with many types and keeps track of which type it was given. What goes in decides what comes out.

## Preserve the caller's type

- In `function choose<T>(value: T): T`, `T` is a type parameter. It stands for whatever type the caller passes.
- `choose(0)` returns a `number`. `choose("Tea")` returns a `string`. TypeScript infers `T` at each call.
- `function choose(value: unknown): unknown` would accept anything too, but the caller would get back `unknown` and lose the type.
- Type parameters are removed when the code runs, like all types.

## Return the same type {prediction}

Read the example and predict what it prints.

```typescript example trace
function choose<T>(value: T): T {
  return value;
}
console.log(choose(0));
console.log(choose("Tea"));

```

```output
0
Tea
```

:::question predict example=trace
What prints?
- [x] 0 then Tea :: `choose` returns the value it was given, and `T` becomes `number` for the first call and `string` for the second.
- [ ] A type name then Tea :: `T` is removed when the code runs. Only values remain.
:::

## Types built from other types

TypeScript has generic types too. Three common ones build a new object type from an existing one:

- `Pick<Article, "id" | "title">` keeps only the listed fields.
- `Omit<Article, "id">` keeps every field except the listed ones.
- `Partial<Article>` makes every field optional.

They can be combined: `Partial<Omit<Article, "id">>` is "any of the fields except `id`". These only describe types. They never add or remove fields from a real object.

## Does Pick change objects? {prediction}

`Pick` builds a type with fewer fields.

@example trace

:::question explain example=trace
Does `Pick` remove fields from an object at runtime?
- [ ] Yes. It deletes the fields you did not list. :: Types do nothing at runtime.
- [x] No. It only describes a type. :: To drop fields from a real object, build a new object with code.
:::

## Limit what T can be

Inside `function f<T>(value: T)`, TypeScript knows nothing about `value`, so `value.length` is an error. A constraint says what every `T` must have:

```typescript
function longest<T extends { length: number }>(a: T, b: T): T {
  return b.length > a.length ? b : a;
}
```

`T extends { length: number }` means "any type with a numeric `length`". Strings and arrays fit. Numbers do not.

## Use a constraint {prediction}

Read the example and predict what it prints.

```typescript example constraint
function longest<T extends { length: number }>(a: T, b: T): T {
  return b.length > a.length ? b : a;
}
console.log(longest("tea", "coffee"));
console.log(longest([1, 2], [3]).join(","));

```

```output
coffee
1,2
```

:::question constraint example=constraint
What happens with `longest(10, 200)`?
- [ ] It returns 200. :: Numbers have no `length`, so they do not fit the constraint.
- [x] It is a type error. :: `number` has no `length` field, so it does not satisfy `T extends { length: number }`.
:::

## Keep the first value even when falsy {modification}

The starter uses `||`, which throws away a first item of `0` or `""`. Check the length instead.

@task generic-first

## Describe an article preview and patch {independent}

Build two types from `Article` with `Pick`, `Omit` and `Partial`, or write them out by hand.

@task generic-edit-shapes
