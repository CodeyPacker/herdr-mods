---
id: course:ts-foundations/module/decisions
title: Narrowing with control flow
requires: ["binding","numeric-expression","read-output"]
outcomes: [{"id":"predict","can":"Choose the correct branch at a threshold and distinguish equality from truthiness.","assessment":["edge","zero"]},{"id":"limit","can":"Include the last available place","assessment":["course:ts-foundations/task/decisions-limit"]},{"id":"flag","can":"Flag urgent work","assessment":["course:ts-foundations/task/decisions-flag"]},{"id":"empty-label","can":"Handle an empty label","assessment":["course:ts-foundations/task/decisions-empty-label"]}]
tasks: [{"id":"course:ts-foundations/task/decisions-limit","path":"tasks/limit/task.json"},{"id":"course:ts-foundations/task/decisions-flag","path":"tasks/flag/task.json"},{"id":"course:ts-foundations/task/decisions-empty-label","path":"tasks/empty-label/task.json"}]
review: {"task":"course:ts-foundations/task/decisions-empty-label","afterModule":"course:ts-foundations/module/lists","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["narrowing/if-else","narrowing/truthiness"]
drillGap: The course checks boundary and empty-input cases together.
---

A comparison such as count >= 3 produces true or false (a boolean). An if statement runs its first block when the condition is true. An else block runs otherwise. Braces group the lines in each block. === compares values for equality. && requires both tests to be true, and || requires at least one.

## Decide which books need a reminder

A comparison such as count >= 3 produces true or false (a boolean). An if statement runs its first block when the condition is true. An else block runs otherwise. Braces group the lines in each block. === compares values for equality. && requires both tests to be true, and || requires at least one.

## Predict before running {prediction}

Read the example and predict what happens before checking your answer.

```typescript example limit
const count = 3;
if (count >= 3) {
  console.log("Busy");
} else {
  console.log("Room");
}

```

```output
Busy
```

:::question edge example=limit
What prints for the example as written?
- [ ] Room :: The equal sign in >= includes three.
- [x] Busy :: Three meets its own threshold.
:::

## Trace the example {walkthrough}

At exactly 3, >= includes the boundary and prints Busy. A number used directly as an if condition uses truthiness: 0 is false and other ordinary nonzero numbers are true. The empty string is false too. To ask whether a value is zero, compare it to zero explicitly.

@example limit

## Check your explanation {prediction}

Read the indicated code and choose the explanation that accounts for its behavior.

@example limit

:::question zero example=limit
If the condition were simply if (count), which count would select Room?
- [x] 0 :: Zero is false in this condition.
- [ ] 3 :: A positive count is true.
- [ ] -1 :: A negative nonzero number is also true.
:::

## Include the last available place {modification}

The supplied numbers requests and places are nonnegative. Set fits to true when every request can fit, including an exact fit. Fix the starter’s boundary mistake.

@task decisions-limit

## Flag urgent work {independent}

Use the contract in the exercise and check your answer on save.

@task decisions-flag
