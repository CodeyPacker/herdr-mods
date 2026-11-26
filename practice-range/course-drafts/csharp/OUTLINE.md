# C# foundations

The beginner follows all 18 modules in order. The experienced path starts with the same save/run check and offers the readiness checks below. A learner can open any module or practice drill directly. The manifest expands each module key below with `course:cs-foundations/module/`. Position is independent of identity.

Status: all 18 modules, four project checkpoints and four readiness checks are written and pass the verifier. `VALIDATION.md` records the run. The course teaches C# on its own terms and never compares it with another language.

## Outcome-to-assessment map

Task keys expand to `course:cs-foundations/task/<module>-<key>`. The last task listed for each module is its delayed review task.

| Module | Prior modules | What the learner can do | Tasks | Experienced entry |
| --- | --- | --- | --- | --- |
| 1. **save** · Save, run, read output | None | Save a short program, read its output, and find the line a compiler error names. | fix-message, board-sign, echo-card | Setup for both |
| 2. **values** · Values, types and text | save | Trace assignments, choose whole-number or fractional division, build text from values, and repair a type mismatch. | arrival-log, share-hours, shelf-label, repair-count, seat-snapshot | R1 |
| 3. **decisions** · Make a decision | values | Choose a branch with `if`, comparisons and boolean operators, including the edge values. | status, can-start, owner-line | R1 |
| 4. **methods** · Give a calculation a name | decisions | Write a static method with parameters and a return value. Explain why a name is out of scope. | after-arrivals, extra-hours, summary, movement | R1 |
| 5. **collections** · Work through a list | methods | Build and walk an array and a `List<T>` with loops and a running total. | total-minutes, over, average | R1 |
| 6. **classes** · Describe a task with a class | methods, collections | Write a class with properties, a constructor and methods. Predict what two names for one object share. | board, task-card, emphasize | R2 |
| 7. **records** · Records, structs and copies | classes | Tell a copy from a shared reference, change a record with `with`, and predict `==` for records, structs and classes. | rename, slot, complete-all | R2 |
| 8. **nulls** · Handle a missing value | classes, decisions | Mark a value that may be missing with `?`, check it before use, and supply a fallback with `??`, keeping zero and empty text. | owner-label, due-text, text-length | R2 |
| 9. **lookups** · Look up and de-duplicate | collections, nulls | Count with a `Dictionary`, read a key that may be missing, and collect unique values with a `HashSet`. | count-by-owner, minutes-for, unique-owners | R2 |
| 10. **linq** · Query a collection | collections, records, lookups | Filter, transform, count and group with LINQ. Predict when a query runs. | open-titles, minutes-by-owner, long-titles | R3 |
| 11. **interfaces** · Share a contract | classes, records | Implement an interface, extend a base type, and call different types through one contract. | fixed-source, urgent-card, estimates | R3 |
| 12. **patterns** · Choose by type and shape | interfaces, records | Pick a result by record type and property values with a switch expression, with the arms in a correct order. | describe-update, lane, apply-edit, repair-caption, sensor-display | R3 |
| 13. **exceptions** · Recover from errors | patterns, nulls | Throw and catch a specific exception. Choose between a result value and an exception for an expected failure. | checked, parse-minutes, safe-load | R3 |
| 14. **generics** · Keep a type relationship | interfaces, collections | Write a generic method and type that keep the caller's type, with a constraint where one is needed. | last-or, outcome, largest | R4 |
| 15. **async** · Wait for local data | exceptions, methods | Return and await a `Task`, run reads in order, and handle a failed task. | total, count-or, counts | R4 |
| 16. **checks** · Read and write checks | linq, exceptions | Read expected and actual values, find an off-by-one bug, and write a check that catches it. | at-limit, count-check, order-check | R4 |
| 17. **tracker** · Assemble the tracker | async, generics, checks, patterns | Join task records, validation, edits and a local async reader into one working tracker. | valid-rows, apply-edit, open-titles | R4 |
| 18. **report** · Deliver an unfamiliar report | tracker | Independently combine validation, counting, error handling, async reading and a regression check. | audit | All take |

That is 57 lesson tasks. The four project checkpoints below join their modules when the pack is built, which gives 61. The four readiness checks sit outside the lessons.

## Changes from the brief's suggested outline

- C1: Interfaces and inheritance (11) comes before pattern matching (12). Type patterns need a base type with several derived records, so inheritance has to be taught first.
- C2: Module keys `nulls` and `lookups` replace "null" and "dictionaries and sets" as stable identifiers. The content is the same.

## Concept map

The manifest lists the concept IDs each module introduces and its direct prerequisites. Earlier concepts carry forward through those links.

- **Values and control.** save-run, read-output, compiler-error → variable, number-types, text, var-inference, interpolation → branch, comparison, boolean-logic → method, parameter-return, scope → array, list, loop.
- **Data shapes.** class, property, constructor → record, struct, value-reference, equality → nullable, null-check, null-coalescing → dictionary, set.
- **Working with data.** lambda, linq-query, deferred → interface, inheritance → switch-expression, type-pattern, property-pattern.
- **Failure and reuse.** throw-catch, result-type → generic → task, await, async-failure → tests, debugging.
- **Integration.** project → transfer.

## Experienced entry

Each readiness check is a fresh problem in `readiness/r1` to `readiness/r4`. A result suggests where to start. It does not mark any module passed.

| Group | Task | What it shows |
| --- | --- | --- |
| R1 · values through collections | `FinalCount` adds the changes that are 0 or more to a starting number. `AverageChange` returns the average of all changes as a `double`. | Loops, branches, and a division that keeps its fraction. Empty lists and negative values. |
| R2 · classes through lookups | `Renamed` returns a changed copy of a record. `CountByOwner` counts tasks per owner, with a null owner under "Unassigned" and an empty name kept as its own key. | Record copies, null against empty text, and dictionary updates. |
| R3 · linq through exceptions | `Summaries` turns update records into lines by type, leaves out other types, and throws for a negative duration. | Type patterns, order, and rejecting bad data instead of hiding it. |
| R4 · generics through tracker | `ReadOrAsync<T>` returns a reader's value or a fallback when it is offline. `LastOrCheck` is a check that tells a correct candidate from two faulty ones. | A generic async method, a failed task against a real zero, and choosing inputs that expose a bug. |

## Project sequence

The project is a small task tracker. Every checkpoint is a single-file task in `project/`.

1. **P1 · Methods.** `RemainingAfter` computes the board count after arrivals and completions.
2. **P2 · LINQ.** `CountByStatus` counts task records by status, including an empty list.
3. **P3 · Checks.** `RenameCheck` tells a correct rename from one that resets `Done` and one that keeps the old title.
4. **P4 · Tracker.** `LoadAsync` reads rows from a local async reader, validates them, and returns a result that separates a failed read from an empty success.
5. **P5 · Report.** The module's `audit` task: summarize an import, read it exactly once through a reader that can fail, and write a regression check.

## Scope

The core ends at composing a small typed program, diagnosing failures, writing a regression check and applying those skills to an unfamiliar task. Outside this course: spans, iterators, delegates and events beyond lambdas and `Func`, operator overloading, reflection, ASP.NET, Entity Framework, file and network I/O, NuGet packages and project files.
