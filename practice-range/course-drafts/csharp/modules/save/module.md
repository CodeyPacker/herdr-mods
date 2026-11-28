---
id: course:cs-foundations/module/save
title: Run a program, read errors
requires: []
outcomes: [{"id":"output","can":"Predict the lines a short program prints, in order.","assessment":["outputs","course:cs-foundations/task/save-board-sign"]},{"id":"error","can":"Find the line a compiler error names and repair it.","assessment":["missing","course:cs-foundations/task/save-fix-message"]},{"id":"transfer","can":"Print an exact two-line message from a written description.","assessment":["course:cs-foundations/task/save-echo-card"]}]
tasks: [{"id":"course:cs-foundations/task/save-fix-message","path":"tasks/fix-message/task.json"},{"id":"course:cs-foundations/task/save-board-sign","path":"tasks/board-sign/task.json"},{"id":"course:cs-foundations/task/save-echo-card","path":"tasks/echo-card/task.json"}]
review: {"task":"course:cs-foundations/task/save-echo-card","afterModule":"course:cs-foundations/module/decisions","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: []
drillGap: No practice drill covers saving a file and reading its output.
---

Every exercise in this course works the same way: you edit a file, save it, and read what comes back. Predict before running, solve from the prompt before opening hints, explain why each failed case failed, then return for a scheduled fresh review without the earlier answer.

Experienced learners can use readiness checks if useful. Credit applies to the task you pass, not blanket course mastery, and modules remain freely navigable.

## Save a file and read its output

A C# program is a list of **statements**. In straight-line code, they run from top to bottom until a control-flow statement, such as a branch or loop, changes what runs next.

```csharp
Console.WriteLine("Hello");
```

This is one statement. It prints the text between the double quotes, then ends the line. The semicolon `;` ends the statement.

When you save an exercise, the checker **compiles** your code, runs it, and compares the result with what the task asked for. Compiling means the C# compiler reads the whole file first. If it finds an error, nothing runs.

## Predict before running {prediction}

Read the example and predict its output before you run it.

```csharp example board
Console.WriteLine("Good morning");
Console.WriteLine("Coffee is ready");
```

```output
Good morning
Coffee is ready
```

:::question outputs example=board
What does the example print?
- [x] `Good morning`, then `Coffee is ready`, on two lines :: The statements run in the order they are written, and each `Console.WriteLine` prints its text and ends the line. The quotes mark where the text starts and stops, and they are not printed. Output must match exactly: capital letters, spaces and punctuation all count.
- [ ] Both on one line :: `Console.WriteLine` ends the line after its text, so the next print starts a new line.
- [ ] `Coffee is ready`, then `Good morning` :: Statements run from top to bottom, in the order they are written.
:::

## Predict a compiler error {prediction}

One statement in this example is not finished. Read it before checking.

```csharp example missing diagnostics=[{"code":1002,"line":1}]
Console.WriteLine("Good morning")
Console.WriteLine("Coffee is ready");
```

:::question missing example=missing
What happens when you check this example?
- [ ] It prints `Good morning`, then reports an error. :: The compiler reads the whole file before running anything. With an error, nothing runs.
- [x] The compiler reports an error on line 1 and nothing prints. :: Line 1 is missing its semicolon. That is CS1002, and the program never starts.
- [ ] It prints both lines, because line 2 is complete. :: One unfinished statement stops the whole file from compiling.
:::

## Repair the greeting {modification}

Save the starter as it is and read the error. A compiler error looks like this:

```text
Scratch.cs(1,34): error CS1002: ; expected
```

- `(1,34)` is the line and the column where the compiler noticed the problem.
- `CS1002` is the error code. Every compiler error has one.

The compiler can report several diagnostics for one file, and it may point after the original mistake. Start with the first useful diagnostic and inspect the code around that location. A practical loop is: reproduce the problem with the smallest input, read the first useful diagnostic, fix one cause, then rerun and repeat. Fix the line the error names when it is the cause, save again, and compare the output with the prompt.

@task save-fix-message

## Run C# outside this checker

With the .NET SDK installed, these commands create and run a console program in a new folder:

```sh
dotnet new console -o FirstProgram
cd FirstProgram
dotnet run
```

`Program.cs` holds the code. Replace its contents with a print statement from this lesson and run it again. `FirstProgram.csproj` holds project settings, including the target .NET version. `dotnet build` compiles without running. A project compiles its C# files together, so types in another `.cs` file can be used from Program.cs.

The short form used here has **top-level statements**. In a new console project, common namespaces such as `System` are imported automatically, which makes `Console` available. A namespace groups type names. `using System;` imports its names, and `System.Console.WriteLine("Hello");` uses the full name. Later exercise wrappers supply imports and an entry point so you can focus on one skill at a time.

## Print a receipt {independent}

Work from the prompt. Save to check your output.

@task save-board-sign
