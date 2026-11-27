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

Every exercise in this course works the same way: you edit a file, save it, and read what comes back. This module covers that loop: printing a line, reading the output, and reading a compiler error.

## Save a file and read its output

A C# program is a list of **statements** that run from top to bottom.

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
- [x] `Good morning`, then `Coffee is ready`, on two lines :: Each `Console.WriteLine` prints its text and ends the line.
- [ ] Both on one line :: `Console.WriteLine` ends the line after its text, so the next print starts a new line.
- [ ] `Coffee is ready`, then `Good morning` :: Statements run from top to bottom, in the order they are written.
:::

## Trace the example {walkthrough}

The two statements ran in the order they were written, and each printed on its own line.

- The quotes mark where the text starts and stops. They are not printed.
- Output must match exactly: capital letters, spaces and punctuation all count.

@example board

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

## Read the compiler error {walkthrough}

Check the example. The compiler reports:

```text
Scratch.cs(1,34): error CS1002: ; expected
```

- `(1,34)` is the line and the column where it noticed the problem.
- `CS1002` is the error code. Every compiler error has one.
- Line 1 has no semicolon, so nothing ran, not even line 2.

Start reading at the line the error names.

@example missing

## Repair the greeting {modification}

Save the starter as it is and read the error. Fix that line, save again, and compare the output with the prompt.

@task save-fix-message

## Print a receipt {independent}

Work from the prompt. Save to check your output.

@task save-board-sign
