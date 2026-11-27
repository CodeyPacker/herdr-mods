---
id: course:ts-foundations/module/utility
title: Utility types
requires: ["generic","utility","object-shape","literal-union"]
outcomes: [{"id":"record","can":"Predict the keys a Record type requires.","assessment":["record"]},{"id":"readonly","can":"Predict where Readonly reports an error.","assessment":["readonly"]},{"id":"return-type","can":"Derive a type from a function with ReturnType.","assessment":["return-type"]},{"id":"tally","can":"Count every category","assessment":["course:ts-foundations/task/utility-tally"]},{"id":"finalize","can":"Require and lock a draft","assessment":["course:ts-foundations/task/utility-finalize"]},{"id":"promote","can":"Promote a user without copying its type","assessment":["course:ts-foundations/task/utility-promote"]}]
tasks: [{"id":"course:ts-foundations/task/utility-tally","path":"tasks/tally/task.json"},{"id":"course:ts-foundations/task/utility-finalize","path":"tasks/finalize/task.json"},{"id":"course:ts-foundations/task/utility-promote","path":"tasks/promote/task.json"}]
review: {"task":"course:ts-foundations/task/utility-promote","afterModule":"course:ts-foundations/module/mapped","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["utility/pick","utility/omit","utility/partial"]
drillGap: The linked drills cover Pick, Omit and Partial. This module adds Record, Required, Readonly and ReturnType.
---

TypeScript ships generic types that build new types from old ones (utility types). You met `Pick`, `Omit` and `Partial` in Generics. This module adds four more.

## Four more utility types

- `Record<K, V>` is an object with exactly the keys `K`, each holding a `V`. `Record<"fruit" | "veg", number>` means `{ fruit: number; veg: number }`.
- `Required<T>` removes every `?`, so all fields must be present. It is the opposite of `Partial<T>`.
- `Readonly<T>` marks every field `readonly`. The fields can be read but not reassigned.
- `ReturnType<typeof f>` is the type that function `f` returns. You write the function once and get its type for free.

Like all types, these only exist while checking. `Readonly` does not freeze an object at runtime.

## Every key is required {prediction}

Read the example and predict the answer.

```typescript example record
type Day = "mon" | "tue" | "wed";
const hours: Record<Day, number> = { mon: 8, tue: 0, wed: 6 };
let total = 0;
for (const day of ["mon", "tue", "wed"] as Day[]) total += hours[day];
console.log(total);

```

```output
14
```

:::question record example=record
What happens if you remove `tue: 0` from `hours`?
- [x] A type error: `tue` is missing. :: `Record<Day, number>` requires every key in `Day`.
- [ ] It works, and `hours.tue` is 0. :: Missing keys are not filled in. `Record` requires all of them.
- [ ] It works, and `hours.tue` is `undefined`. :: The type checker stops this before the code runs.
:::

## Readonly fields {prediction}

Which line does the type checker flag? Read the code before checking it.

```typescript example readonly diagnostics=[{"code":2540,"line":4}]
type Point = Readonly<{ x: number; y: number }>;
const start: Point = { x: 1, y: 2 };
const moved: Point = { ...start, x: 5 };
start.x = 5;

```

:::question readonly example=readonly
Which line is an error?
- [ ] Line 3, the spread :: Making a new object is fine. Only changing an existing field is blocked.
- [x] Line 4, `start.x = 5` :: `x` is `readonly`, so it cannot be reassigned.
- [ ] Line 2, creating `start` :: Setting fields when you create the object is allowed.
:::

## Readonly and copies {walkthrough}

`Readonly` blocks `start.x = 5`, but it does not stop you from making a changed copy. `{ ...start, x: 5 }` builds a new object, so nothing is reassigned.

This is the same idea as the copies in Object types: keep the original, return a new object.

@example readonly

## A type from a function {prediction}

Read the example and predict what it prints.

```typescript example return-type
function makeSize(width: number, height: number) {
  return { width, height, area: width * height };
}
type Size = ReturnType<typeof makeSize>;
const box: Size = makeSize(3, 4);
console.log(box.area);

```

```output
12
```

:::question return-type example=return-type
What is `Size`?
- [x] `{ width: number; height: number; area: number }` :: `ReturnType` reads what `makeSize` returns.
- [ ] `(width: number, height: number) => object` :: That is the function's own type. `ReturnType` gives only the result.
- [ ] `number` :: `area` is a number, but the function returns the whole object.
:::

## Count every category {modification}

Return a `Record` with a count for every category, including the ones that never appear.

@task utility-tally

## Require and lock a draft {independent}

Build two types from `Draft` with `Required` and `Readonly`.

@task utility-finalize
