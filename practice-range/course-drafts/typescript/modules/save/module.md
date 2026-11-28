---
id: course:ts-foundations/module/save
title: Run code, read a type error
requires: []
outcomes: [{"id":"predict","can":"Predict two lines of output and read a compiler diagnostic.","assessment":["order","course:ts-foundations/task/save-fix-message"]},{"id":"fix-message","can":"Repair the first message","assessment":["course:ts-foundations/task/save-fix-message"]},{"id":"board-sign","can":"Print the board sign","assessment":["course:ts-foundations/task/save-board-sign"]},{"id":"echo-card","can":"Read a supplied card","assessment":["course:ts-foundations/task/save-echo-card"]}]
tasks: [{"id":"course:ts-foundations/task/save-fix-message","path":"tasks/fix-message/task.json"},{"id":"course:ts-foundations/task/save-board-sign","path":"tasks/board-sign/task.json"},{"id":"course:ts-foundations/task/save-echo-card","path":"tasks/echo-card/task.json"}]
review: {"task":"course:ts-foundations/task/save-echo-card","afterModule":"course:ts-foundations/module/decisions","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: []
drillGap: Existing drills begin with language syntax. Saving a first file and reading output need a separate introduction.
---

Print a first message, then use the checker to find a typing mistake.

## Save a file and read its output

The editor holds your answer as a text file. Open an exercise, put the cursor inside its starter, type, and save with your editor's Save command. Practice Range checks the saved file.

```typescript
console.log("Ready");
```

- This tells the program to print `Ready`. The quotes mark the text, and the parentheses hold what to print.
- The dot, the quotes, the parentheses and the semicolon are all part of the instruction.
- Lines beginning with `//` are notes for the reader.

## Predict two lines {prediction}

Read the example and predict what it prints.

```typescript example board
console.log("Ready");
console.log("Open");

```

```output
Ready
Open
```

:::question order example=board
What appears, in order?
- [ ] Open then Ready :: The first instruction runs first.
- [x] Ready then Open :: The two instructions run from the top down, and each call prints one line with the words inside its quotes.
:::

## Repair the first message {modification}

Make the starter print `Ready` on exactly one line. Save once and read the diagnostic: it names the file and the line where the compiler gave up. Fix the earliest broken line and save again.

A failed output check is different: it means the code ran but printed something else.

@task save-fix-message

## Print a cafe sign {independent}

Use the contract in the exercise and check your answer on save.

@task save-board-sign
