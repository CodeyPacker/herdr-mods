---
id: course:cs-foundations/module/async
title: async and await
requires: ["method","parameter-return","throw-catch","list","loop","variable"]
outcomes: [{"id":"await","can":"Await a task and use its result.","assessment":["predict-order","course:cs-foundations/task/async-total"]},{"id":"missing","can":"Read the error from using a task as if it were its result.","assessment":["predict-await"]},{"id":"failure","can":"Handle a failed task and keep a successful zero.","assessment":["predict-failure","course:cs-foundations/task/async-count-or"]},{"id":"transfer","can":"Await several reads in order and keep going after one fails.","assessment":["course:cs-foundations/task/async-counts"]}]
tasks: [{"id":"course:cs-foundations/task/async-total","path":"tasks/total/task.json"},{"id":"course:cs-foundations/task/async-count-or","path":"tasks/count-or/task.json"},{"id":"course:cs-foundations/task/async-counts","path":"tasks/counts/task.json"}]
review: {"task":"course:cs-foundations/task/async-counts","afterModule":"course:cs-foundations/module/checks","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["async/await","async/sequential","async/faulted","methods/async"]
drillGap: These drills practise one async form each. They do not check a failed read next to a successful zero.
---

Reading a file, a database or a network takes time. C# represents work that finishes later as a Task. This module covers `async` methods, `await`, running reads in order, and what happens when a task fails. Every source here is local, so nothing depends on timing.

## A Task is a result that comes later

A method that returns `Task<int>` hands back a task at once: a promise that an `int` will be available later. `await` waits for that task and gives you the `int`. A method that uses `await` must be marked `async`, and its return type is Task or `Task<T>`. Inside it you return the plain value, and C# wraps it in the task. By convention the names of such methods end in Async. While a method waits at an `await`, the program is free to do other work, which is the point of writing code this way.

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

## Predict the order {prediction}

Read the two methods and the statements below them. Predict the first three lines of output.

@example trace

:::question predict-order example=trace
What are the first three lines of output?
- [x] start, reading, 3 :: The call runs the method up to its first `await`, then the caller's `await` receives 3.
- [ ] reading, start, 3 :: Nothing in ReadCountAsync runs until it is called, and `"start"` prints before the call.
- [ ] start, 3, reading :: `"reading"` prints inside the method, before it returns its result.
:::

## Follow the awaits {walkthrough}

`"start"` prints first. Calling ReadCountAsync runs its body up to the first `await`, so `"reading"` prints next. The `await` in the caller then waits for the task to finish and receives 3. Code after an `await` runs only when the awaited task is done, so awaits in a row run one after another, in order.

@example trace

## When a task fails {prediction}

ReadBrokenAsync throws after its `await`. Predict the last line of output.

@example trace

:::question predict-failure example=trace
What is the last line of output?
- [ ] Nothing, because the program stops with an error :: The `await` is inside a try, and the catch names the exception's type.
- [x] Source is offline. :: The exception is thrown again at the `await`, and the catch prints its Message.
- [ ] 3 :: That was printed earlier. The last statement is the try and catch.
:::

## Follow the failure {walkthrough}

An exception thrown inside an `async` method is stored in its task. It is thrown again at the `await`, so a try and catch around the `await` handles it like any other exception. Here the catch prints the message. A task you never `await` keeps its exception to itself and the failure goes unnoticed, so `await` every task you start.

@example trace

## Forget the await {prediction}

Line 7 calls the method without `await`. Read the example before checking.

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
What happens when you check this example?
- [ ] It prints 3. :: Without `await` the call returns a task, and a task is not an `int`.
- [ ] It prints 0, because the task has not finished. :: The file does not compile, so nothing prints.
- [x] The compiler reports an error on line 7. :: Line 7 stores a `Task<int>` in an `int`. That is CS0029. The fix is `await`.
:::

## Read the compiler error {walkthrough}

Check the example. Without `await`, the call gives you the task, not the number. CS0029 says a `Task<int>` cannot be converted to `int`. Add `await` in front of the call. There is also a way to wait without `await`: reading a task's Result blocks the whole thread until the task is done. Prefer `await`, which lets other work continue.

@example bad-await

## Add two counts {modification}

The case box supplies a local source. The starter reads only the first shop.

@task async-total

## Fall back when a shop is offline {independent}

Work from the prompt. One shop throws, and one shop has a real count of 0.

@task async-count-or
