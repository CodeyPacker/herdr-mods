---
id: course:ts-foundations/module/errors
title: Errors and failure
requires: ["unknown","narrowing","tests"]
outcomes: [{"id":"predict","can":"Tell a thrown error from a successfully returned empty value.","assessment":["predict","explain"]},{"id":"throw","can":"Trace throw, catch and finally in order.","assessment":["finally"]},{"id":"error-text","can":"Explain a caught value","assessment":["course:ts-foundations/task/errors-error-text"]},{"id":"read-result","can":"Keep successes and errors apart","assessment":["course:ts-foundations/task/errors-read-result"]},{"id":"lookup","can":"Return an expected miss","assessment":["course:ts-foundations/task/errors-lookup"]}]
tasks: [{"id":"course:ts-foundations/task/errors-error-text","path":"tasks/error-text/task.json"},{"id":"course:ts-foundations/task/errors-read-result","path":"tasks/read-result/task.json"},{"id":"course:ts-foundations/task/errors-lookup","path":"tasks/lookup/task.json"}]
review: {"task":"course:ts-foundations/task/errors-lookup","afterModule":"course:ts-foundations/module/async","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["narrowing/instanceof-narrowing","guards/unwrap-result"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

Some failures are normal results, such as a search that finds nothing. Others are exceptions, such as a file that cannot be read. Return the first kind. Throw and catch the second.

## Handle expected and unexpected failures

- An expected miss is a normal return value, such as `null` or `{ kind: "error" }`. Callers handle it like any other result.
- `throw` stops the current code and jumps to the nearest `catch`.
- `try { ... } catch (problem) { ... }` runs the `try` block and goes to `catch` only if something was thrown.
- In TypeScript the caught value is `unknown`. JavaScript lets code throw anything, including a plain string, so check it before reading `.message`.

## Return or throw? {prediction}

Read the example and predict what it prints.

```typescript example trace
function read(source: () => string): string {
  try {
    return source();
  } catch (problem) {
    if (problem instanceof Error) return problem.message;
    return "Unknown";
  }
}
console.log(read(() => "" ) === "");
console.log(read(() => { throw new Error("No file"); }));

```

```output
true
No file
```

:::question predict example=trace
What prints on the first line?
- [x] true :: The first source returns `""`. Nothing is thrown, so `try` returns it and `catch` never runs. The second source throws an `Error`: `catch` receives it, `instanceof Error` narrows it, and `.message` is `"No file"`.
- [ ] Unknown :: Only a thrown value goes to `catch`. An empty string is returned, not thrown.
:::

## Throw a plain string {prediction}

Suppose the source threw the plain string `"No file"` instead of an `Error`.

@example trace

:::question explain example=trace
If the source throws the string `"No file"`, what does `read` return?
- [ ] No file :: Only the `Error` path reads `.message`, and a string is not an `Error`.
- [x] Unknown :: A thrown string fails `instanceof Error`, so it falls through.
:::

## Throw your own errors

Throw when your function cannot do its job and the caller made a mistake.

- `throw new Error("Age must be 0 or more")` creates an error with a message.
- `finally { ... }` runs after `try` or `catch`, whether or not something was thrown. Use it for clean-up.
- Do not throw for normal outcomes such as "not found". Return a value the caller can check instead.

## Follow try, catch and finally {prediction}

Read the example and predict what it prints.

```typescript example finally
function checkAge(age: number): number {
  if (age < 0) throw new Error("Age must be 0 or more");
  return age;
}
for (const age of [30, -1]) {
  try {
    console.log("ok " + checkAge(age));
  } catch (problem) {
    console.log(problem instanceof Error ? problem.message : "Unknown");
  } finally {
    console.log("done " + age);
  }
}

```

```output
ok 30
done 30
Age must be 0 or more
done -1
```

:::question finally example=finally
How many times does `done` print?
- [x] Twice :: `finally` runs after every attempt, whether it succeeded or threw.
- [ ] Once, after the error :: `finally` also runs when nothing is thrown.
- [ ] Once, after the success :: `finally` also runs after `catch`.
:::

## Explain a caught value {modification}

Turn a caught value into text. The starter uses `String`, which adds `"Error: "` in front of messages.

@task errors-error-text

## Keep successes and errors apart {independent}

Return a result object for both outcomes instead of letting the error escape.

@task errors-read-result
