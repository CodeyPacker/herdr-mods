---
id: course:ts-foundations/module/save
title: Run code, read a type error
requires: []
outcomes: [{"id":"predict","can":"Predict two lines of output and distinguish a typing error from a different printed message.","assessment":["order","quotes"]},{"id":"fix-message","can":"Repair the first message","assessment":["course:ts-foundations/task/save-fix-message"]},{"id":"board-sign","can":"Print the board sign","assessment":["course:ts-foundations/task/save-board-sign"]},{"id":"echo-card","can":"Read a supplied card","assessment":["course:ts-foundations/task/save-echo-card"]}]
tasks: [{"id":"course:ts-foundations/task/save-fix-message","path":"tasks/fix-message/task.json"},{"id":"course:ts-foundations/task/save-board-sign","path":"tasks/board-sign/task.json"},{"id":"course:ts-foundations/task/save-echo-card","path":"tasks/echo-card/task.json"}]
review: {"task":"course:ts-foundations/task/save-echo-card","afterModule":"course:ts-foundations/module/decisions","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: []
drillGap: Existing drills begin with language syntax. Saving a first file and reading output need a separate introduction.
---

Print a first message, then use the checker to find a typing mistake.

## Save a file and read its output

The editor holds your answer as a text file. Open an exercise, put the cursor inside its starter, type, and save using your editor’s Save command. Practice Range checks the saved file. console.log("Ready"); tells the program to print Ready. The quotes mark the text. The parentheses hold what to print. The dot and matching punctuation are part of this instruction. Lines beginning with // are notes for the reader.

## Predict before running {prediction}

Read the example and predict what happens before checking your answer.

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
- [x] Ready then Open :: Each instruction prints one line.
:::

## Trace the example {walkthrough}

Read the two instructions from the top down. Each call prints one line. The output contains the words inside the quotes. If a quote is missing, the compiler reports a diagnostic with a filename and line number. Fix the earliest broken line and save again. A failed output check means the code ran but produced a different result.

@example board

## Check your explanation {prediction}

Read the indicated code and choose the explanation that accounts for its behavior.

@example board

:::question quotes example=board
If the text Open becomes Closed and you save, what changes?
- [x] Only the second output line. :: The first instruction is unchanged.
- [ ] Both output lines. :: The two instructions contain separate text.
- [ ] The compiler rejects Closed. :: Quoted text can contain either word.
:::

## Repair the first message {modification}

Make the starter print Ready on exactly one line. Save once to see the missing-quote diagnostic, fix the punctuation and save again.

@task save-fix-message

## Print a cafe sign {independent}

Use the contract in the exercise and check your answer on save.

@task save-board-sign
