---
id: course:cs-foundations/module/async
title: async and await
requires: ["method","parameter-return","throw-catch","list","loop","variable"]
outcomes: [{"id":"await","can":"Await a task and use its result.","assessment":["predict-order","course:cs-foundations/task/async-total"]},{"id":"missing","can":"Read the error from using a task as if it were its result.","assessment":["predict-await"]},{"id":"failure","can":"Handle a failed task and keep a successful zero.","assessment":["predict-failure","course:cs-foundations/task/async-count-or"]},{"id":"transfer","can":"Await several reads in order and keep going after one fails.","assessment":["course:cs-foundations/task/async-counts"]},{"id":"concurrent","can":"Start independent operations before awaiting and preserve cancellation and failure.","assessment":["course:cs-foundations/task/async-parallel"]}]
tasks: [{"id":"course:cs-foundations/task/async-total","path":"tasks/total/task.json"},{"id":"course:cs-foundations/task/async-count-or","path":"tasks/count-or/task.json"},{"id":"course:cs-foundations/task/async-counts","path":"tasks/counts/task.json"},{"id":"course:cs-foundations/task/async-parallel","path":"tasks/parallel/task.json"}]
review: {"task":"course:cs-foundations/task/async-counts","afterModule":"course:cs-foundations/module/checks","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["async/await","async/sequential","async/faulted","methods/async"]
drillGap: These drills practise one async form each. They do not check a failed read next to a successful zero.
---

Reading a file, a database or a network takes time. C# represents work that finishes later as a Task. This module covers `async` methods, `await`, choosing sequential or concurrent reads, cancellation, and failures. Every source here is local, so nothing depends on network access or measured delays.

## A Task is a result that comes later

A `Task<int>` represents an operation that may be pending, already finished, canceled, or failed. `await` gives you its int on success. Awaiting an incomplete task suspends this async method without blocking the current thread. Awaiting an already completed task can continue immediately.

- The methods here use `async Task` for no result and `async Task<T>` for a result. Inside an async Task<T> method, return a plain T. C# completes the task with that value. Avoid async void except for event handlers: callers cannot await it or handle its failures through a returned task.
- By convention the names of such methods end in `Async`.
- While a method waits at an `await`, the program is free to do other work, which is the point of writing code this way.
- A task's `Result` also waits, but it blocks the whole thread until the task is done. Prefer `await`.


## Predict the order {prediction}

Read the two methods and the statements below them. Predict the first three lines of output.

```csharp example trace
async Task<int> ReadCountAsync()
{
    Console.WriteLine("reading");
    await Task.Yield();
    return 3;
}

async Task<int> ReadBrokenAsync()
{
    await Task.Yield();
    throw new InvalidOperationException("Source is offline.");
}

Console.WriteLine("start");
int count = await ReadCountAsync();
Console.WriteLine(count);

try
{
    await ReadBrokenAsync();
}
catch (InvalidOperationException error)
{
    Console.WriteLine(error.Message);
}

```

```output
start
reading
3
Source is offline.
```

:::question predict-order example=trace
What are the first three lines of output?
- [x] start, reading, 3 :: `start` prints first. Calling `ReadCountAsync` runs its body synchronously until an await needs to suspend it, so `reading` prints next. The caller's `await` then waits for the task and receives 3. Code after an `await` runs only when the awaited task is done, so awaits in a row run in order.
- [ ] reading, start, 3 :: Nothing in `ReadCountAsync` runs until it is called, and `start` prints before the call.
- [ ] start, 3, reading :: `"reading"` prints inside the method, before it returns its result.
:::

## When a task fails {prediction}

`ReadBrokenAsync` throws after its `await`. Predict the last line of output.

@example trace

:::question predict-failure example=trace
What is the last line of output?
- [ ] Nothing, because the program stops with an error :: The `await` is inside a `try`, and the `catch` names the exception's type.
- [x] Source is offline. :: An exception thrown inside an `async` method is stored in its task and thrown again at the `await`, so a `try` and `catch` around the `await` handles it like any other. Observe failures by awaiting the task, directly or through a combined task such as Task.WhenAll. Discarding a task can leave its failure unnoticed.
- [ ] 3 :: That was printed earlier. The last statement is the `try` and `catch`.
:::

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example bad-await diagnostics=[{"code":29,"line":7}]
async Task<int> ReadCountAsync()
{
    await Task.Yield();
    return 3;
}

int count = ReadCountAsync();
Console.WriteLine(count);

```

:::question predict-await example=bad-await
Which error does the compiler report?
- [ ] Line 4: an `async` method cannot return a plain `int`. :: Inside an `async` method you return the plain value, and C# wraps it in the task. Line 4 is fine.
- [x] Line 7, CS0029: the call gives a `Task<int>`, which cannot be stored in an `int`. :: Without `await`, the call gives you the task, not the number. Write `int count = await ReadCountAsync();`
- [ ] Line 8: `count` has no value yet, because the task has not finished. :: The compiler checks types, not timing, and it stops at line 7.
:::

## Add two counts {modification}

The case box supplies a local source. The starter reads only the first shop.

@task async-total

## Fall back when a shop is offline {independent}

Work from the prompt. One shop throws, and one shop has a real count of 0.

@task async-count-or

## Choose sequential or concurrent work

Await calls one at a time when the second needs the first result or the operation requires that order. For independent reads, start both calls before awaiting:

```csharp
Task<int> first = source.ReadAsync("north", cancellationToken);
Task<int> second = source.ReadAsync("south", cancellationToken);
int[] counts = await Task.WhenAll(first, second);
```

The operations can overlap (**concurrency**). This does not promise two CPU threads. Task.WhenAll completes after every supplied task completes. Its results follow task input order, even if the operations finish in a different order. A failed operation makes the combined task fail. If none failed but one was canceled, the combined task is canceled. Awaiting it throws.

A **CancellationToken** passes a request to stop. The operation must cooperate by observing it, often with `cancellationToken.ThrowIfCancellationRequested()`, or by passing it to an API that accepts it. `CancellationTokenSource.Cancel()` requests cancellation. It does not forcibly stop code. Pass the caller's token through every operation that supports it. Let OperationCanceledException propagate when cancellation belongs to the caller rather than turning it into an ordinary success.

## Start both reads before waiting {independent}

Write the method from its contract. The local source keeps reads pending until the checks supply their results, so a sequential answer fails without timing assumptions.

@task async-parallel
