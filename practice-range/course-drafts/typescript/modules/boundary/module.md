---
id: course:ts-foundations/module/boundary
title: unknown and type guards
requires: ["discriminant","map-set","narrowing"]
outcomes: [{"id":"predict","can":"Predict runtime validation results and explain why an assertion cannot validate a field.","assessment":["predict","explain"]},{"id":"guard","can":"Use a type guard function to narrow unknown data.","assessment":["guard"]},{"id":"safe-title","can":"Read only a valid title","assessment":["course:ts-foundations/task/boundary-safe-title"]},{"id":"valid-task","can":"Accept only complete member records","assessment":["course:ts-foundations/task/boundary-valid-task"]},{"id":"safe-list","can":"Validate a list of labels","assessment":["course:ts-foundations/task/boundary-safe-list"]}]
tasks: [{"id":"course:ts-foundations/task/boundary-safe-title","path":"tasks/safe-title/task.json"},{"id":"course:ts-foundations/task/boundary-valid-task","path":"tasks/valid-task/task.json"},{"id":"course:ts-foundations/task/boundary-safe-list","path":"tasks/safe-list/task.json"}]
review: {"task":"course:ts-foundations/task/boundary-safe-list","afterModule":"course:ts-foundations/module/errors","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["guards/validate-unknown","narrowing/object-check"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

Data from outside your program, such as parsed JSON, can be anything. TypeScript's types only exist while compiling, so you have to check the real data with code.

## Check data before trusting its type

Three ways to hold a value you know nothing about:

- `unknown` holds anything, but you cannot read fields until you check what it is. This is the safe choice.
- `any` turns type checking off. Mistakes reach runtime.
- `value as Book` (a type assertion) tells the compiler to assume a type. It checks nothing and converts nothing.

Annotations and assertions are erased when the code runs. Only runtime checks such as `typeof`, `Array.isArray` and `in` look at the actual data.

## Check an unknown value {prediction}

Read the example and predict what it prints.

```typescript example trace
function hasTitle(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && "title" in value && typeof value.title === "string";
}
console.log(hasTitle({ title: "" }));
console.log(hasTitle({ title: 7 }));

```

```output
true
false
```

:::question predict example=trace
Which results print?
- [x] true then false :: The checks run left to right, each narrowing `value` further. `typeof value === "object"` is also true for `null` and for arrays, so those are ruled out next. `"title" in value` checks that the field exists, and `typeof value.title === "string"` checks its type. An empty string is still a string.
- [ ] false then true :: The check looks at the type, not at whether the value is truthy.
:::

## Assert a type with as {prediction}

A type assertion such as `value as { title: string }` looks like a shortcut past these checks.

@example trace

:::question explain example=trace
Would `value as { title: string }` turn a numeric title into text?
- [ ] Yes. It converts the field. :: Converting data needs runtime code. `as` is removed when compiling.
- [x] No. The data stays the same. :: An assertion only changes what the compiler assumes.
:::

## Write a type guard

A check like the one above returns `boolean`, so the caller learns nothing about the type. A type guard function returns `value is T` instead.

```typescript
type Point = { x: number; y: number };
function isPoint(value: unknown): value is Point {
  return typeof value === "object" && value !== null
    && "x" in value && typeof value.x === "number"
    && "y" in value && typeof value.y === "number";
}
```

When `isPoint(data)` returns `true`, TypeScript treats `data` as a `Point` inside that `if`. The guard is only as good as its checks: if you forget to check `y`, TypeScript still trusts it.

## Use a type guard {prediction}

Read the example and predict what it prints.

```typescript example guard
type Point = { x: number; y: number };
function isPoint(value: unknown): value is Point {
  return typeof value === "object" && value !== null
    && "x" in value && typeof value.x === "number"
    && "y" in value && typeof value.y === "number";
}
const inputs: unknown[] = [{ x: 1, y: 2 }, { x: 1 }, "1,2"];
for (const input of inputs) {
  console.log(isPoint(input) ? input.x + input.y : "skip");
}

```

```output
3
skip
skip
```

:::question guard example=guard
Why is `input.x + input.y` allowed even though `input` is `unknown`?
- [x] `isPoint` returns `value is Point`, so the true branch treats `input` as a `Point`. :: The guard narrows the type where it returned `true`.
- [ ] `unknown` lets you read any field. :: That is `any`. `unknown` requires a check first.
:::

## Read only a valid title {modification}

Return the title only when the data really has a string title. The starter uses `as`, which checks nothing.

@task boundary-safe-title

## Accept only complete member records {independent}

Check each required field and its type.

@task boundary-valid-task
