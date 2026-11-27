---
id: course:ts-foundations/module/lists
title: Arrays and tuples
requires: ["function","numeric-expression"]
outcomes: [{"id":"predict","can":"Trace an accumulator on a list and an empty list.","assessment":["predict","explain"]},{"id":"tuple","can":"Read a tuple's fixed slots and their types.","assessment":["tuple-slots"]},{"id":"sum","can":"Repair an accumulated sum","assessment":["course:ts-foundations/task/lists-sum"]},{"id":"long","can":"Keep values at or above a minimum","assessment":["course:ts-foundations/task/lists-long"]},{"id":"min-max","can":"Return two results as a tuple","assessment":["course:ts-foundations/task/lists-min-max"]},{"id":"count-zero","can":"Count empty bins","assessment":["course:ts-foundations/task/lists-count-zero"]}]
tasks: [{"id":"course:ts-foundations/task/lists-sum","path":"tasks/sum/task.json"},{"id":"course:ts-foundations/task/lists-long","path":"tasks/long/task.json"},{"id":"course:ts-foundations/task/lists-min-max","path":"tasks/min-max/task.json"},{"id":"course:ts-foundations/task/lists-count-zero","path":"tasks/count-zero/task.json"}]
review: {"task":"course:ts-foundations/task/lists-count-zero","afterModule":"course:ts-foundations/module/collections","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["loops/for-of","arrays/push"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

An array holds values in order. A tuple is an array with a fixed number of slots, where each slot has its own type.

## Walk through every value

An array holds any number of values of one type, in order.

- `number[]` is an array of numbers. `[]` is an empty array.
- `values.length` counts the entries.
- `for (const value of values)` visits each entry once, first to last.
- A variable declared before the loop can collect a result across visits. This is an accumulator.
- To build a new array, start from `[]` and call `push(value)` to add to the end.

## Predict before running {prediction}

Read the example and predict what it prints before you run it.

```typescript example trace
const minutes = [2, 0, 3];
let total = 0;
for (const value of minutes) {
  total = total + value;
}
console.log(total);

```

```output
5
```

:::question predict example=trace
What prints after the last visit?
- [x] 5 :: All three values are added to `total`.
- [ ] 3 :: 3 is only the last value. Each visit adds to `total` instead of replacing it.
:::

## Trace the example {walkthrough}

Track `total` before the loop and after each visit: `0`, `2`, `2`, `5`.

- The `0` entry is still visited. It just adds nothing.
- On an empty array the loop body never runs, so `total` stays at its starting value.
- If `let total = 0` moved inside the loop, every visit would start over and earlier values would be lost.

@example trace

## Check your explanation {prediction}

Read the example again and choose the explanation that fits.

@example trace

:::question explain example=trace
If `minutes` were empty, what would print?
- [ ] The program would fail. :: Looping over an empty array is fine. The body runs zero times.
- [x] 0 :: No visits change the starting `total`.
:::

## Fixed slots with tuples

Sometimes a function needs to return two results together, such as a width and a height. A tuple type lists each slot.

- `[number, string]` has exactly two slots: a `number` first, then a `string`.
- `const size: [number, number] = [1920, 1080]` is a tuple of two numbers.
- Read slots by position, `size[0]` and `size[1]`, or unpack them with `const [width, height] = size`.
- Asking for a slot that is not there, such as `size[2]`, is a type error.

TypeScript infers `number[]` for `[1920, 1080]` unless you write the tuple type. Write it on a function's return type so callers know there are exactly two slots.

## Read a tuple {prediction}

Read the example and predict what it prints.

```typescript example score
function bestScore(scores: number[]): [string, number] {
  return ["Ana", scores[0]];
}
const [name, points] = bestScore([42, 17]);
console.log(`${name} ${points}`);

```

```output
Ana 42
```

:::question tuple-slots example=score
What is the type of `points`?
- [x] number :: The second slot of `[string, number]` is a `number`.
- [ ] string :: `string` is the first slot. Unpacking goes in slot order.
- [ ] number[] :: Unpacking takes one slot, not the whole array.
:::

## Repair a running sum {modification}

Repair `totalMinutes`. It must return the sum of every value, and 0 for an empty array. The starter keeps only the last value.

@task lists-sum

## Keep values at or above a minimum {independent}

Build a new array with `push` and leave the input unchanged.

@task lists-long

## Return two results as a tuple {independent}

Return the smallest and largest value together, typed as a tuple.

@task lists-min-max
