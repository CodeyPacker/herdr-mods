---
id: course:cs-foundations/module/exceptions
title: Exceptions
requires: ["method","parameter-return","branch","comparison","text","record","class"]
outcomes: [{"id":"throw","can":"Throw a specific exception for input a method cannot accept.","assessment":["predict-skip","course:cs-foundations/task/exceptions-checked"]},{"id":"catch","can":"Catch one exception type and let others through.","assessment":["predict-catch","course:cs-foundations/task/exceptions-safe-load"]},{"id":"result","can":"Return a result value for an expected failure instead of throwing.","assessment":["course:cs-foundations/task/exceptions-parse-minutes"]},{"id":"cleanup","can":"Dispose a resource on return and failure without hiding the exception.","assessment":["course:cs-foundations/task/exceptions-cleanup"]}]
tasks: [{"id":"course:cs-foundations/task/exceptions-checked","path":"tasks/checked/task.json"},{"id":"course:cs-foundations/task/exceptions-parse-minutes","path":"tasks/parse-minutes/task.json"},{"id":"course:cs-foundations/task/exceptions-safe-load","path":"tasks/safe-load/task.json"},{"id":"course:cs-foundations/task/exceptions-cleanup","path":"tasks/cleanup/task.json"}]
review: {"task":"course:cs-foundations/task/exceptions-safe-load","afterModule":"course:cs-foundations/module/async","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["exceptions/catch","exceptions/throw","exceptions/multiple","conversions/try-parse"]
drillGap: These drills practise one statement each. They do not check which exception types are caught and which pass through.
---

Some failures are bugs, and some are expected: text that is not a number, a store that is offline. This module covers throwing and catching exceptions, and returning a result value when a failure is a normal outcome.

## Throw and catch

An **exception** is an object that reports a failure. `throw new ArgumentException("Minutes cannot be negative.");` stops the current method at once and passes the exception to its caller. If nothing catches it, the program stops.

- A `try` block marks code that may fail. A `catch` block after it runs only when an exception of the named type is thrown inside the `try`, and the rest of the `try` is skipped.
- `catch (FormatException)` catches that type and any derived exception types. Naming a variable, as in `catch (ArgumentException error)`, lets you read `error.Message`.
- Catch the most specific type you can handle. `catch (Exception)` catches everything, including bugs you would want to see, so it is rarely the right choice.
- Some built-in methods throw: `int.Parse("soon")` throws a `FormatException` because the text is not a number.


## Catch a bad format {prediction}

`ReadMinutes` is called with text that is a number and text that is not. Predict the first two lines of output.

```csharp example parse
int ReadMinutes(string text)
{
    try
    {
        return int.Parse(text);
    }
    catch (FormatException)
    {
        return -1;
    }
}

void Check(int minutes)
{
    if (minutes < 0)
    {
        throw new ArgumentException("Minutes cannot be negative.");
    }
}

Console.WriteLine(ReadMinutes("30"));
Console.WriteLine(ReadMinutes("soon"));

try
{
    Check(-5);
    Console.WriteLine("checked");
}
catch (ArgumentException error)
{
    Console.WriteLine(error.Message);
}

```

```output
30
-1
Minutes cannot be negative.
```

:::question predict-catch example=parse
What are the first two lines of output?
- [x] 30, then -1 :: `int.Parse("30")` works, so the `try` returns 30 and the `catch` never runs. `int.Parse("soon")` throws a `FormatException`, so the rest of the `try` is skipped and the `catch` returns -1. The caller sees an ordinary return value both times.
- [ ] 30, then the program stops with an error :: The `FormatException` is caught inside `ReadMinutes`, so the program continues.
- [ ] 30, then 0 :: The catch block returns -1. Nothing here turns bad text into 0.
:::

## What runs after a throw? {prediction}

`Check(-5)` throws inside the second try block. Predict the last line of output.

@example parse

:::question predict-skip example=parse
What is the last line of output?
- [ ] checked :: `Check(-5)` throws, so the rest of the try block is skipped.
- [ ] checked, then Minutes cannot be negative. :: A throw leaves the try block at once. The line after `Check(-5)` never runs.
- [x] Minutes cannot be negative. :: `Check` throws, so it ends at once. Back in the `try`, the line that prints `checked` is skipped, because control jumps straight to the matching `catch`, which prints the exception's `Message`.
:::

## Expected failures can be values

An exception suits a failure the caller is not expected to handle on every call, such as a broken promise about the input. When failure is a normal outcome, a return value is often clearer.

- A **result type** holds either the answer or the reason there is none, for example `record Parsed(bool Ok, int Minutes, string Error);`. The caller checks `Ok` before using the answer. This record makes failure visible but does not force the caller to check it.
- Built-in methods offer the same choice: `int.TryParse(text, out int value)` returns false for bad text instead of throwing.

## Release a resource on every path

Some objects hold files, connections or other resources. They implement **IDisposable**, an interface with a `Dispose()` method that releases the resource. Garbage collection reclaims managed memory, but it does not replace timely disposal.

```csharp
using var reader = LocalReader.Open(key);
return reader.Read();
```

This `using` is a declaration, different from a namespace import. It calls Dispose when the scope exits, including when Read throws or return runs. A `using (var reader = LocalReader.Open(key)) { ... }` statement gives the reader a smaller scope.

For cleanup that needs more control, put it in a `finally` block after `try` and any `catch` blocks. Finally runs on ordinary scope exit, including return and exception unwinding. A bare `throw;` inside a catch rethrows the current exception while preserving its original stack trace. Do not catch a failure just to silently return a success-looking value.

## Reject negative minutes {modification}

The starter accepts every input. Make it throw for the input it cannot accept.

@task exceptions-checked

## Parse minutes into a result {independent}

Work from the prompt. The method must never throw for the inputs listed.

@task exceptions-parse-minutes

## Close the reader on success and failure {independent}

Work from the contract. There are no real files or network calls. The checks observe cleanup on both paths.

@task exceptions-cleanup
