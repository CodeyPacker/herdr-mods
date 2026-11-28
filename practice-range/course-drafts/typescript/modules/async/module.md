---
id: course:ts-foundations/module/async
title: async and Promises
requires: ["throw-catch","import-export"]
outcomes: [{"id":"predict","can":"Distinguish the promise from its resolved value and identify where to catch rejection.","assessment":["predict","explain"]},{"id":"all","can":"Predict the order of results from Promise.all.","assessment":["all"]},{"id":"double","can":"Wait before multiplying","assessment":["course:ts-foundations/task/async-double"]},{"id":"read-batch","can":"Report a failed load","assessment":["course:ts-foundations/task/async-read-batch"]},{"id":"in-order","can":"Load two notes in order","assessment":["course:ts-foundations/task/async-in-order"]}]
tasks: [{"id":"course:ts-foundations/task/async-double","path":"tasks/double/task.json"},{"id":"course:ts-foundations/task/async-read-batch","path":"tasks/read-batch/task.json"},{"id":"course:ts-foundations/task/async-in-order","path":"tasks/in-order/task.json"}]
review: {"task":"course:ts-foundations/task/async-in-order","afterModule":"course:ts-foundations/module/generic","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["async/await","async/try-catch"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

Some work finishes later, such as reading a file or calling a server. A promise stands for a result that is not ready yet. `await` waits for it.

## Wait for a result

- A promise ends in one of two ways. It **resolves** with a value, or it **rejects** with a reason (like a throw).
- `Promise<string>` is a promise that resolves with a string.
- An `async` function always returns a promise, even when it returns a plain value.
- Inside an `async` function, `await promise` pauses until the promise settles. It gives the value, or throws the rejection at that line, so a `try` and `catch` around the `await` handles a rejection.

The examples and tasks here use local data, with no network or timers.

## Await a name {prediction}

Read the example and predict what it prints.

```typescript example trace
async function readName(): Promise<string> {
  return "Jo";
}
const name = await readName();
console.log("Hello " + name);

```

```output
Hello Jo
```

:::question predict example=trace
What does it print?
- [x] Hello Jo :: `readName()` returns a `Promise<string>`, not a string. `await` waits for it and gives `"Jo"`, and only then is `"Hello " + name` built.
- [ ] Hello [object Promise] :: That would happen without `await`. Here the promise is awaited first.
:::

## Handle a rejection {prediction}

Suppose `readName` rejected instead of resolving.

@example trace

:::question explain example=trace
If `readName` rejected, where could you handle the failure?
- [ ] In an `if` that checks the promise :: The promise object does not tell you its result before it settles.
- [x] In a `catch` around the `await` :: A rejection at `await` behaves like a throw.
:::

## Run work at the same time

`await` one after another runs the steps in order. Each waits for the one before it. When the steps do not depend on each other, start them all and wait once:

```typescript
const [user, posts] = await Promise.all([loadUser(), loadPosts()]);
```

- `Promise.all` resolves with an array of results, in the same order as the input, not the order they finished.
- If any promise rejects, `Promise.all` rejects too.
- Use one `await` after another when a step needs the previous result. Use `Promise.all` when it does not.

## Wait for several {prediction}

Read the example and predict what it prints.

```typescript example all
async function slow(): Promise<string> {
  await Promise.resolve();
  await Promise.resolve();
  return "slow";
}
async function fast(): Promise<string> {
  return "fast";
}
const results = await Promise.all([slow(), fast()]);
console.log(results.join(", "));

```

```output
slow, fast
```

:::question all example=all
`fast` finishes first. What does it print?
- [ ] fast, slow :: `Promise.all` keeps the input order, not the finish order.
- [x] slow, fast :: Results come back in the order the promises were passed in.
:::

## Wait before multiplying {modification}

The starter multiplies a promise. Wait for the number first.

@task async-double

## Report a failed load {independent}

Return a result object for both a successful load and a rejected one.

@task async-read-batch
