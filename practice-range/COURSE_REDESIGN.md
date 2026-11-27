# Course redesign plan

Status: in progress. Started 2026-11-26. Branch `wip/learning-scope`.

This is the working checklist for the course redesign. Any agent (Claude, Codex or other) can pick it up. Read "How to work" first, then continue from the first unchecked box.

Design mockups: the "Practice Range courses: redesign" Claude Doc (owner has the link). This file is the source of truth if they disagree.

## Why

The owner found the course screens confusing. The module list opened with five "Task tracker" project checkpoints, then settings (known languages, repo attach), then three competing buttons (Suggested next step, Review, Continue lesson), and only then the modules. Every C# and TypeScript task used the same task tracker theme. The owner wants to learn the languages, not build a project.

## Decisions

These are recorded as D11 to D15 in `LEARNING_SCOPE.md`.

| ID | Decision |
| --- | --- |
| D11 | Courses teach the language one concept at a time. No project theme, no project checkpoints, no capstone modules. |
| D12 | Each language course is its own: its own module list, titles and examples. Examples vary by module instead of sharing one theme. |
| D13 | Every course screen has one obvious next action. The course page is an "Up next" box with one Continue button, then the numbered module list. |
| D14 | Settings (known languages, repo attachment, AI options) leave the catalog and module list and move to a course settings page. |
| D15 | Lessons are written in Markdown files, one per module, and code blocks are shown with syntax colours. |

Readiness checks stay, renamed "Skip-ahead test", as one link at the bottom of the course page.

## Target screens

1. **Catalog.** Header tabs: Courses (current), Practice, Review, and Settings on the right. One card per course: title, one-line summary, "N of M done" (or "Not started"), one button: Start or Continue. "Preview" is a small label on the card, not a banner on every page. No known-languages form here.
2. **Course page.** Header: "← Courses", course title, Settings. An "Up next" box: module number and title, step title, "Step X of Y", one Continue button. Below: "MODULES", one row per module: status mark (done, in progress, not started), "N. Title", short status on the right ("Done", "2 of 9 steps"). Any row opens that module. At the bottom: "Already know some C#? Take a skip-ahead test". A "Review · N ready" line appears only when N > 0. No project section, no repo section, no Skip buttons on rows (skip moves into the module's own page or the skip-ahead test).
3. **Lesson step.** Header: "← <course>", "N. Module title", "Step X of Y", with a step progress bar. Body: step heading, Markdown text with inline code, coloured code blocks, an example's Run button and output, questions as choice buttons with feedback. Footer: esc Course page, p Previous, n Continue. Drill links ("Practice <topic>") and extra practice only on the module's last step. "Explain this topic using my repo" only when a repo is attached and AI is on.
4. **Exercise.** Header: "← N. Module", "Exercise: <title>", "X of Y". Action row first: o Open in editor (main), c Check, h Hint, Show solution, then Start fresh. Task text. Results box: "K of N checks pass", one line per check with a pass or fail mark, and expected vs actual under a failure. Test inputs and supplied code folded behind "Show test inputs (N)". Footer: esc Back to lesson, Next exercise.
5. **Course settings.** Known languages, repo attachment and "Explain repo architecture", AI help notes, older course versions. Reached from Settings in the catalog or course page header.

## Module lists (16 each)

| # | Learn C# | Learn TypeScript | Learn SQL |
| --- | --- | --- | --- |
| 1 | Run a program, read errors | Run code, read a type error | Run a query, read the result |
| 2 | Types and values | Types and inference | Choose and name columns |
| 3 | Control flow | Narrowing with control flow | Filter rows |
| 4 | Methods | Function types | Missing values (NULL) |
| 5 | Arrays and lists | Arrays and tuples | Sort and limit |
| 6 | Classes and properties | Object types and interfaces | Aggregates |
| 7 | Structs, records, copies | null, undefined, optional | GROUP BY |
| 8 | Nullable types | Union and literal types | Joins |
| 9 | Dictionaries and sets | Discriminated unions | Outer joins |
| 10 | LINQ | unknown and type guards | Subqueries |
| 11 | Interfaces and inheritance | Modules | CTEs |
| 12 | Pattern matching | Generics | Expressions and CASE |
| 13 | Exceptions | Utility types | Insert, update, delete |
| 14 | Generics | Mapped and conditional types | Design a table |
| 15 | async and await | Errors and Result types | Window functions |
| 16 | Writing unit tests | async and Promises | Check a query is right |

## How to work

- Work on branch `wip/learning-scope`. Commit after every checked box and push: `git push -u origin wip/learning-scope` (retry on network errors). Never commit to `main`. Never add a co-author line.
- Tick a box (`- [x]`) in this file in the same commit as the work. Add a one-line note under the box when something differs from the plan.
- Code search: if a Graphify graph exists, use `graphify query` first. Otherwise `rg`.
- The course panel is `mods/practice-range/courses/panel.js`. Course data comes from `courses/service.mjs` (`courseCommand`). Packs are built by `scripts/build-course.mjs <language>` from `course-drafts/<language>/` and verified by `scripts/verify-course.mjs <language>`.
- Checks to run before ticking a UI box:
  - `node tests/check-courses.mjs` (native render of every course fixture; name one fixture to run only it)
  - `env TMPDIR=/private/tmp node --test --test-concurrency=3 tests/course-*.test.mjs`
  - `herdr-app check mods/practice-range`
- Screenshots: `node scripts/shoot-courses.mjs` (added in A0). It renders each fixture in a separate Herdr window with its own home folder. Never drive keys or clicks in the owner's real window. Herdr tabs live in a shared backend, so the script makes one temporary space and deletes it after.
- Do not change drill practice, sync or the AI tutor beyond what a box says.
- Keep `LEARNING_PROGRESS.md` and `README.md` accurate when a phase finishes (last phase does the full pass).

## Checklist

### Phase 0: Plan

- [x] P0.1 Write this plan and record D11 to D15 in `LEARNING_SCOPE.md`.

### Phase A: Interface, with today's content

- [x] A0 Add `scripts/shoot-courses.mjs`: build course fixtures (as `tests/check-courses.mjs` does), open each in an isolated Herdr window (`HERDR_APP_HOME`), save PNGs to a folder, clean up the space and window.
- [x] A1 Catalog: cards with title, summary, progress, one Start/Continue button, Preview label. Remove the known-languages form and the "I know another language" button from the catalog.
- [x] A2 Course settings page: known languages, repo attach/detach, Explain repo architecture, older versions. Header Settings button on catalog and course page.
- [x] A3 Course page: Up next box with one Continue button (uses `enrollment.position`, else `recommendation`, else module 1), numbered module rows with status marks, Review line only when ready > 0, skip-ahead link at the bottom. Remove the project section and per-row Skip buttons from this page.
- [x] A4 Lesson step: header with module and "Step X of Y", step progress bar, footer with Previous and Continue only. Drill links and extra practice only on the last step. Repo button only with a repo and AI on. Remove the preview banner from every page.
- [x] A5 Exercise: actions first, then task text, then a results box with one line per check. Fold fixtures behind "Show test inputs (N)". Next exercise button.
- [x] A6 Update `tests/check-courses.mjs` fixtures and any course tests for the new layout. All checks pass. Screenshots taken with A0 and reviewed.

Notes on Phase A:
- The results box lists the runner's failure details. The runner does not report passing checks one by one yet, so passed checks are not listed. Adding per-check results to the C#, TypeScript and SQL runners is open (do it in Phase C if wanted).
- Module titles still read "Build a task tracker with C#" until Phase C renames the courses.
- `tests/check-courses.mjs` needed no changes: all 49 fixtures pass. A full run can stop with "interrupted" while loading the SQL catalog (known, see RELEASE.md). Rerun the fixtures it did not reach by name. `course-*.test.mjs`: 43 of 43 pass.

### Phase B: Markdown lessons and code colours

- [x] B1 Find how to colour code: test whether `TextView.markdown` colours ```` ```csharp ````, ```` ```typescript ```` and ```` ```sql ```` fences. If not, try a read-only `EditorState` with `language`. If neither covers all three, write a small colourer (keywords, strings, numbers, comments). Write the result here.
    - Result: `TextView.markdown` never colours code. The read-only code editor colours `cs` (C#), `sql`, and `javascript` (used for TypeScript; type annotations stay plain). `csharp`, `typescript`, `ts` and `tsx` do not colour. Editor state cannot be made during render, so `courses/code.js` makes 16 editors per language when the panel starts and lends them to code blocks. Any other fence (text, http, json) stays a Markdown block.
- [x] B2 Use that for every code block in lessons, tasks, hints and solutions.
- [x] B3 Define the module Markdown format (below) and write `scripts/course-markdown.mjs` that turns `module.md` into the same module object `build-course.mjs` reads from `module.json` today. Add a test.
- [x] B4 `build-course.mjs` reads `module.md` when present, else `module.json`.
- [x] B5 Convert one existing C# module to `module.md`, rebuild, verify, screenshot.

#### Module Markdown format

The full rules are at the top of `scripts/course-markdown.mjs`. Short version:

````markdown
---
id: course:cs-foundations/module/methods
title: Methods
requires: ["control-flow"]
outcomes: [{"id":"return","can":"Write a static method that returns a value.","assessment":["empty-average"]}]
tasks: [{"id":"course:cs-foundations/task/methods-average","path":"tasks/average/task.json"}]
drills: ["methods/return"]
---

Intro paragraph shown on step 1.

## Return a value

Step text with `inline code`. A plain fence stays part of the text and is coloured.

```csharp example average
Console.WriteLine(Average(new double[] { 18, 21, 22.5 }));
```

```output
20.5
```

## Empty input {prediction}

@example average

:::question empty-average example=average
What does `Average(new double[0])` return?
- [x] 0 :: The empty check returns 0 before dividing.
- [ ] NaN :: The early return runs first.
- [ ] It throws an exception :: Dividing a double by 0 does not throw.
:::

@task methods-average
````

- Front matter: one `key: value` per line. A value starting with `[`, `{` or `"` is JSON.
- Each `## Title {kind}` is one step. The kind defaults to `explanation`.
- A fence whose info is `<language> example <id>` is a runnable example. Flags: `readonly`, `diagnostics=[...]` (JSON). An ```` ```output ```` block right after it lists the printed lines.
- `@example <id>` shows an example from an earlier step. `@task <id>` and `@tasks <id> <id>` place tasks (full id, or the key after `/task/`).
- `:::question <id> [example=<id>]`: prompt, then `- [x] text :: feedback` per choice.
- Tasks stay in `tasks/<key>/task.json` with their files, as today.
- `node scripts/course-markdown.mjs <module.json>` writes `module.md` from an existing module and refuses if it would not convert back exactly. `tests/course-markdown.test.mjs` round-trips every authored module.

### Phase C: C# course rewrite

Course names (owner, 2026-11-26): language courses show just the language name, "TypeScript", "C#", "SQL". The panel takes it from the language (`courseName` in `courses/panel.js`), so packs need no rebuild for it. The API course is titled "API design" (pack 0.1.0-preview.2, compatible with preview.1).

New content version `0.2.0-preview.1`, no compatibility with 0.1.0 (old enrollments stay readable from Course settings). Each module: 6 to 10 steps, at least one prediction question, 2 to 4 tasks, examples from varied everyday data. No task tracker. Teach C# on its own terms (D9).

- [x] C0 New `course-drafts/csharp/OUTLINE.md` and `manifest.json` for the 16 modules. Remove the project file and capstone modules from the manifest.
    - Kept the 0.1.0 module keys (save, values, decisions, ...) so task IDs and files stay put. Only titles and content change. Course title is now "Learn C#", content version 0.2.0-preview.1. `tracker`, `report` and `project/` are deleted. Do not run `build-course.mjs csharp` until C18: a rebuild with a new version archives 0.1.0, and the pack should only change once.
    - `node scripts/verify-course.mjs csharp <key>` checks one module in a few minutes. A full run also checks R1 to R4, which may fail until C17.
    - Recipe used for C1 to C4 (each took one pass):
        1. `cd course-drafts/csharp/modules/<key> && node ../../../../scripts/course-markdown.mjs module.json` (skip if `module.md` exists).
        2. Read `module.md` and every `tasks/*/task.json` and `.cs` file. List the tracker words (task, board, open, done, owner, arrivals).
        3. Rename identifiers in each task's `.cs` files and `checks` together, then rewrite `title`, `prompt`, `hints`, `checkLabels`, `feedback` and each wrong answer's `misconception`. Rewrite fixture files with new values. Watch `alternative.cs`: it often builds text with `+`, so a rename can break its format.
        4. Rewrite the lesson body in `module.md` with backticks for code, short paragraphs and lists. Keep every example id, question id, step kind and `@task` line.
        5. `git rm module.json examples/*.cs`, point the manifest entry at `module.md`, run `node scripts/verify-course.mjs csharp <key>`, then grep the module for tracker words.
        6. A word-for-word rename must skip `@task` lines, example ids (` example <id>`, `example=<id>`, `@example <id>`) and question ids. The verifier catches a broken id, so read its assertion when it fails.
        7. In Python, read a file before opening it for writing. `open(f, "w").write(open(f).read())` empties the file.
- [x] C1 Run a program, read errors
- [x] C2 Types and values
- [x] C3 Control flow
- [x] C4 Methods
- [x] C5 Arrays and lists
- [x] C6 Classes and properties
- [x] C7 Structs, records, copies
- [x] C8 Nullable types
- [x] C9 Dictionaries and sets
- [x] C10 LINQ
- [x] C11 Interfaces and inheritance
- [x] C12 Pattern matching
- [x] C13 Exceptions
- [x] C14 Generics
- [x] C15 async and await
- [x] C16 Writing unit tests
- [x] C16b Markdown polish: modules 7 to 16 were rethemed by renaming, so their prose has no backticks or lists yet (modules 1 to 6 do). Add `code` formatting and short lists to their step text. Content and ids stay.
    - Done with `scripts/course-polish.py <module.md>`: it wraps member access, calls, generic types, exception names, C# keywords that are not English words, and short quoted strings in backticks, outside code fences and directive lines. Then two fixes: `` `int`? `` to `` `int?` ``, and `` x[`"a"`] `` to `` `x["a"]` ``. Never strip doubled backticks: that breaks the fences. C# pack is now 0.2.0-preview.2, compatible with 0.1.0-preview.1 and 0.2.0-preview.1.
- [x] C17 Rewrite readiness checks R1 to R4 as skip-ahead tests over the new modules.
    - Full verifier run passed all 16 modules on 2026-11-26. `node scripts/verify-course.mjs csharp readiness` checks only R1 to R4.
- [x] C18 Build, run `scripts/verify-course.mjs csharp` (about 20 minutes), update `tests/course-csharp.test.mjs` and its native fixtures, screenshots. Owner reviews before Phase D.

Owner feedback after C18 (2026-11-26), done:
- Step 1 of every module says how many steps there are and which steps are exercises.
- The AI box shows only on exercises.
- A step's question comes before its Run example button. Run appears once the question is answered, so running cannot give the answer away.
- Buttons no longer show their key. One line at the bottom right lists the screen's shortcuts.
- 0.2.0 is compatible with 0.1.0: an existing enrollment sees "Update to 0.2.0-preview.1" on the course page.

### Phase A2: Lesson layout v2 (owner, 2026-11-26)

Mockup: "Screen 3, revised after first use" in the redesign doc.

- [x] A2.1 Lesson page in two panes: a step list on the left (Learn steps, then "Practice in your editor" for exercise steps; done, current and exercise marks; "N of M done" at the bottom) and the step on the right, in a column about 70 characters wide.
- [x] A2.2 Step content as numbered stages: 1 Read the code, 2 Pick your answer, 3 Run it to check (Run locked until answered; output shown beside the Run button with "matches").
- [x] A2.3 Bottom bar: Previous, "X / Y", and Continue as the only filled button. Shortcuts in one line below.
- [x] A2.4 Feedback and choices render inline code (feedback still shows raw backticks).
- [x] A2.5 Apply the same narrow column and bottom bar to the course page and the exercise page.
    - Course and exercise pages use a 760-wide centred column; the lesson uses 1040 for the step list plus a 680-wide step. "Open in editor" is the filled button on exercises. GPUI elements take no children after they are added to a parent, so containers are attached last.

Owner feedback round 3 (2026-11-26), done:
- Catalog cards and the course page's Up next box are clickable as a whole, with "Continue →" text instead of a button.
- "← Courses" in the course header goes back.
- Practice drills are one plain "Practice drills" button beside Settings, with no due-for-review notice.
- "Loading course…" shows in the footer, so the page does not shift when a step opens.
- A newer course version is offered as "Update to <version>" on the catalog card, not as a banner on the course page.

Also done: a language card ("Start or resume course") with exactly one course opens that course page directly instead of a one-item list.

### Phase D: TypeScript course rewrite

Owner decision (2026-11-26): write all three new modules (Union and literal types, Utility types, Mapped and conditional types).

Same rules as Phase C, new content version, 16 modules from the table.

- [x] D0 Outline and manifest. 18 modules, version 0.2.0-preview.1, compatible with 0.1.0-preview.1 and preview.2. `compose`, `tracker`, `report` and `project/` are deleted. Collections and Checks stay, because later modules and the skip-ahead tests depend on what they teach. The three new modules are `planned` entries in the manifest (no `source`) until written. R4 now covers Generics only. Do not rebuild the TypeScript pack until D18.

    Retheme each existing module with the C recipe (convert to `module.md`, rename tracker words, verify with `node scripts/verify-course.mjs typescript <key>`, run `scripts/course-polish.py` if the prose needs code formatting; its keyword list is C#, so check the result). Never rename inside `"id"` fields: a word rename over the whole task.json once changed `save-echo-card` to `save-echo-word`. TypeScript tasks can also have `typeChecks`, `rejects`, `moduleSources` and two-file `workspace` folders: rename inside those too.

- [x] D1 save · Run code, read a type error
- [ ] D2 values · Types and inference
- [ ] D3 decisions · Narrowing with control flow
- [ ] D4 functions · Function types
- [ ] D5 lists · Arrays and tuples (add a tuple step and task)
- [ ] D6 shapes · Object types and interfaces
- [ ] D7 missing · null, undefined and optional
- [ ] D8 unions · Union and literal types (new module: write `modules/unions/module.md` and 2 to 4 tasks with wrong answers, add `source` to its manifest entry)
- [ ] D9 tagged · Discriminated unions
- [ ] D10 collections · Transform arrays, maps and sets
- [ ] D11 boundary · unknown and type guards
- [ ] D12 modules · Modules
- [ ] D13 checks · Writing tests
- [ ] D14 errors · Errors and failure
- [ ] D15 async · async and Promises
- [ ] D16 generic · Generics
- [ ] D16a utility · Utility types (new module)
- [ ] D16b mapped · Mapped and conditional types (new module, last in the course: its review uses `"afterCompletion": true`)
- [ ] D17 Readiness checks
- [ ] D18 Build, verify, tests (update `tests/course-pack.test.mjs`, `tests/course-project.test.mjs` and the TypeScript fixtures in `tests/check-courses.mjs` that use `report-audit` or the project), screenshots

### Phase E: SQL course

- [ ] E1 Remove the project checkpoints and the assemble and report modules. Convert modules to Markdown. Keep the practice database.
- [ ] E2 Build, verify, tests, screenshots

### Phase F: Wrap up

- [ ] F1 Update `README.md`, `RELEASE.md` and `LEARNING_PROGRESS.md` for the new courses and screens.
- [ ] F2 Full test run and owner walkthrough.
