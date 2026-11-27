---
id: course:ts-foundations/module/functions
title: Function types
requires: ["numeric-expression","branch","inference"]
outcomes: [{"id":"predict","can":"Trace separate calls and identify which names are local.","assessment":["outputs","scope"]},{"id":"return-count","can":"Return a local count","assessment":["course:ts-foundations/task/functions-return-count"]},{"id":"extra-hours","can":"Calculate time beyond a booking","assessment":["course:ts-foundations/task/functions-extra-hours"]},{"id":"movement","can":"Measure a signed change","assessment":["course:ts-foundations/task/functions-movement"]}]
tasks: [{"id":"course:ts-foundations/task/functions-return-count","path":"tasks/return-count/task.json"},{"id":"course:ts-foundations/task/functions-extra-hours","path":"tasks/extra-hours/task.json"},{"id":"course:ts-foundations/task/functions-movement","path":"tasks/movement/task.json"}]
review: {"task":"course:ts-foundations/task/functions-movement","afterModule":"course:ts-foundations/module/shapes","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["functions/declaration","variables/block-scope"]
drillGap: These tasks also check successive calls with different inputs.
---

A function packages instructions so callers can use them with different values. Its parameters are names for those inputs. In hours + extra the two names refer to this call's numbers. A colon followed by number says what kind of input or output the compiler expects. return sends a value back to the caller and ends this call.

## Give a calculation a name

A function packages instructions so callers can use them with different values. Its parameters are names for those inputs. In hours + extra the two names refer to this call's numbers. A colon followed by number says what kind of input or output the compiler expects. return sends a value back to the caller and ends this call.

## Predict before running {prediction}

Read the example and predict what happens before checking your answer.

```typescript example calls
function addHours(hours: number, extra: number): number {
  const total = hours + extra;
  return total;
}
console.log(addHours(3, 2));
console.log(addHours(1, 0));

```

```output
5
1
```

:::question outputs example=calls
Which two values print?
- [x] 5 then 1 :: The second call receives its own inputs.
- [ ] 5 then 6 :: The local total does not accumulate across calls.
:::

## Trace the example {walkthrough}

Read the inputs from left to right. Each call creates its own parameters and local variables. The name total belongs inside the braces (its scope). Another function cannot read it directly. Return it and use the returned value in the caller. A function can return a result without printing it.

@example calls

## Check your explanation {prediction}

Read the indicated code and choose the explanation that accounts for its behavior.

@example calls

:::question scope example=calls
Can a later console.log(total) outside the function read total?
- [ ] Yes, after calling addHours once. :: Calling the function does not create a global total.
- [x] No. total belongs to the function body. :: Use the value returned by a call.
:::

## Return a local count {modification}

Repair `stockAfter`. It must return `opening` plus `delivered` minus `sold`. Inputs are nonnegative counts, and sales never exceed the items available. The starter tries to return a name outside its block.

@task functions-return-count

## Calculate time beyond a booking {independent}

Use the contract in the exercise and check your answer on save.

@task functions-extra-hours
