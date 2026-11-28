---
id: course:ts-foundations/module/values
title: Types and inference
requires: ["save-run","read-output"]
outcomes: [{"id":"trace","can":"Predict the order and values printed after a numeric update.","assessment":["predict-count","course:ts-foundations/task/arrival-log"]},{"id":"infer","can":"Declare a numeric variable with an inferred type and calculate the number remaining.","assessment":["course:ts-foundations/task/remaining"]},{"id":"label","can":"Use a fixed text binding and combine supplied text in order.","assessment":["course:ts-foundations/task/shelf-label"]},{"id":"repair","can":"Identify a number assigned to a text variable and repair the numeric count.","assessment":["predict-error","course:ts-foundations/task/repair-count"]},{"id":"transfer","can":"Preserve a starting value when calculating a changed value in another setting.","assessment":["course:ts-foundations/task/seat-snapshot"]}]
tasks: [{"id":"course:ts-foundations/task/arrival-log","path":"tasks/arrival-log/task.json"},{"id":"course:ts-foundations/task/remaining","path":"tasks/remaining/task.json"},{"id":"course:ts-foundations/task/shelf-label","path":"tasks/shelf-label/task.json"},{"id":"course:ts-foundations/task/repair-count","path":"tasks/repair-count/task.json"},{"id":"course:ts-foundations/task/seat-snapshot","path":"tasks/seat-snapshot/task.json"}]
review: {"task":"course:ts-foundations/task/seat-snapshot","afterModule":"course:ts-foundations/module/functions","evidence":"Open a fresh starter after Functions, with the prior answer closed. A first unaided pass on both counts is later evidence of tracing and arithmetic. A hinted pass remains assisted."}
drills: ["variables/const-number","variables/let-reassign","variables/infer-let"]
drillGap: These drills isolate declaration forms. They do not check a snapshot against changing supplied input pairs.
---

A thermometer starts the day at one temperature. When it warms up, the reading changes. How can a program keep the original reading and show the new one?

## Give a value a name

A **value** is a piece of data. `4` is a number. `"Desk"` is text (a **string**). `true` and `false` are the two **boolean** values.

A **variable** is a name for a value:

```typescript
const opening = 4;
let open = opening;
```

- `const` gives a fixed name its value. `let` gives a name that can be assigned a new value later.
- Read `=` as "gets". A semicolon ends a statement, and statements run from top to bottom.

## Trace the count {prediction}

Read the example before running it. `console.log(value)` prints the current value on its own line, and `+` between two numbers adds them. On a line such as `open = open + 1`, work out the right side first.

```typescript example board
const opening = 4;
let open = opening;
console.log(open);
open = open + 1;
console.log(open);

```

```output
4
5
```

:::question predict-count example=board
What are the two output lines, in order?
- [x] 4 then 5 :: The first print runs before the assignment, so it sees 4. The next print sees the updated `open`. Assigning `open` a new value leaves `opening` at 4.
- [ ] 5 then 5 :: The later assignment cannot change a line that has already printed.
- [ ] 4 then 4 :: open is a separate variable and receives the new number.
:::

## Join text

For numbers, `-` subtracts. For text, `+` joins the pieces in order, and the spaces inside the quotes become part of the result.

```typescript example label
const area = "Desk";
const label = area + " shelf";
console.log(label);

```

```output
Desk shelf
```

## Find the error {prediction}

TypeScript uses the first value to work out a type (**inference**). In `let count = 4`, `count` can only ever hold a number. Writing `: number` after the name would state the type yourself (an **annotation**).

This example does not compile. Find the line the compiler stops at, and why.

```typescript example bad-count diagnostics=[{"code":2322,"line":2}]
let count = 4;
count = "5";

```

:::question predict-error example=bad-count
Which error does the compiler report?
- [ ] Line 1: `let` needs a type annotation. :: An annotation is optional. TypeScript infers `number` from the 4, so line 1 is fine.
- [x] Line 2, TS2322: type `string` is not assignable to type `number`. :: `count` was inferred as `number`, and the quotes make `"5"` a string. The checker stops before running anything, and an annotation would not convert quoted digits into a number either.
- [ ] Line 2: a `let` cannot be assigned again. :: Reassigning is what `let` allows. The problem is the type of the new value.
:::

## Update a delivery {modification}

Read the supplied `opening` and `change` values above the editor. Each check can supply different values. An input declaration such as `const opening: number = 6` supplies a number you can read. Edit the starter, save, and compare both prints.

@task arrival-log

## Write two small answers {independent}

Work from the prompt, then save each answer. One computes a changing number. The other constructs a fixed text label.

@tasks remaining shelf-label

## Repair a broken count {debugging}

Read the compiler message before editing. Trace the value in the starter back to the line that gave it its type.

@task repair-count
