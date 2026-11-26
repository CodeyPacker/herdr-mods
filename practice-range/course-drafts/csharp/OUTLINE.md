# C# foundations

The beginner follows all 18 modules in order. The experienced path starts with the same save/run check and offers the readiness tasks below. A learner can open any module or practice drill directly. The manifest expands each module key below with `course:cs-foundations/module/`. Position is independent of identity.

Status: sample gate. Only **values** and **patterns** have lesson content. Every other row is a plan.

## Outcome-to-assessment map

| Module | Prior modules | What the learner can do | Assessment | Experienced entry |
| --- | --- | --- | --- | --- |
| 1. **save** · Save, run, read output | None | Save a short program, read its output, and find the line a compiler error names. | Change a printed message, find a missing semicolon from CS1002, then run again. | Setup for both |
| 2. **values** · Values, types and text | save | Trace assignments, choose whole-number or fractional division, build text from values, and repair a type mismatch. | arrival-log, share-hours, shelf-label, repair-count and delayed seat-snapshot. | R1 |
| 3. **decisions** · Make a decision | values | Choose a branch with `if`, comparisons and boolean operators, including the edge values. | Implement a priority rule covering the threshold, zero, empty text and both boolean values. | R1 |
| 4. **methods** · Give a calculation a name | decisions | Write a static method with parameters and a return value. Explain why a name is out of scope. | Implement a count method, call it twice, and repair an out-of-scope variable. | R1 |
| 5. **collections** · Work through a list | methods | Build and walk an array and a `List<T>` with loops and a running total. | Sum durations for empty and filled lists, and fix a counter that resets inside the loop. | R1 |
| 6. **classes** · Describe a task with a class | methods, collections | Write a class with properties, a constructor and methods. Predict what two names for one object share. | Build a task class, rename through a method, and show that a second variable sees the change. | R2 |
| 7. **records** · Records, structs and copies | classes | Tell a copy from a shared reference, change a record with `with`, and predict `==` for records, structs and classes. | Produce a renamed copy that leaves the original intact, and predict three equality results. | R2 |
| 8. **nulls** · Handle a missing value | classes, decisions | Mark a value that may be missing with `?`, check it before use, and supply a fallback with `??`. | Format an optional owner and due day while keeping zero and empty text as real values. | R2 |
| 9. **lookups** · Look up and de-duplicate | collections, nulls | Count and group with a `Dictionary`, read a key that may be missing, and collect unique values with a `HashSet`. | Count tasks per owner with repeats and an empty list, then list unique owners. | R2 |
| 10. **linq** · Query a collection | collections, records, lookups | Filter, transform, count and group with LINQ. Predict when a query runs. | Titles of open tasks in order, counts by status, and a trace of a query that runs after its source changed. | R3 |
| 11. **interfaces** · Share a contract | classes, records | Implement an interface, extend a base type, and call different types through one contract. | Add a second source type behind a supplied interface and repair a missing member (CS0535). | R3 |
| 12. **patterns** · Choose by type and shape | interfaces, records | Pick a result by record type and property values with a switch expression, with the arms in a correct order. | describe-update, lane, apply-edit, repair-caption and delayed sensor-display. | R3 |
| 13. **exceptions** · Recover from errors | patterns, nulls | Throw and catch a specific exception. Choose between a result value and an exception for an expected failure. | Repair a loader that hides an empty success, and handle a bad format without catching everything. | R3 |
| 14. **generics** · Keep a type relationship | interfaces, collections | Write a generic method and type that keep the caller's type, with a constraint where one is needed. | A first-or-fallback for numbers and strings, and a generic result type used with two payloads. | R4 |
| 15. **async** · Wait for local data | exceptions, methods | Return and await a `Task`, run two reads in order, and handle a failed task. | Read two supplied local sources, one completed and one faulted, with no clocks or I/O. | R4 |
| 16. **checks** · Read and write checks | linq, exceptions | Read expected and actual values, find an off-by-one bug, and write a check that catches it. | Write a check that fails on a supplied faulty method and passes on the corrected one. | R4 |
| 17. **tracker** · Assemble the tracker | async, generics, checks, patterns | Join task records, validation, queries and a local async reader into one working tracker. | Run the project checkpoints with varied sources, then repair a failing integration case. | R4 |
| 18. **report** · Deliver an unfamiliar report | tracker | Independently combine validation, reporting, error handling, async reading and a regression check. | Implement a new import-audit request as a single-file task with trusted acceptance cases. | All take |

## Changes from the brief's suggested outline

- C1: Interfaces and inheritance (11) now comes before pattern matching (12). Type patterns need a base type with several derived records, so inheritance has to be taught first.
- C2: Module keys `nulls` and `lookups` replace "null" and "dictionaries and sets" as stable identifiers. The content is the same.

## Concept map

The manifest lists the concept IDs each module introduces and its direct prerequisites. Earlier concepts carry forward through those links.

- **Values and control.** save-run, read-output, compiler-error → variable, number-types, text, var-inference, interpolation → branch, comparison, boolean-logic → method, parameter-return, scope → array, list, loop.
- **Data shapes.** class, property, constructor → record, struct, value-reference, equality → nullable, null-check, null-coalescing → dictionary, set.
- **Working with data.** lambda, linq-query, deferred → interface, inheritance → switch-expression, type-pattern, property-pattern.
- **Failure and reuse.** throw-catch, result-type → generic → task, await, async-failure → tests, debugging.
- **Integration.** project → transfer.

## Experienced entry

Each readiness check is a fresh problem. A result suggests where to start. It does not mark any module passed.

| Group | Task | Evidence and return point |
| --- | --- | --- |
| R1 · values through collections | Given a list of changes, compute the final count with a method that starts from a supplied number, ignores negative changes and returns the average change as a `double`. | Empty, mixed and repeated inputs. Revisit Values for division, Decisions for branches, Methods for scope, or Collections for loops. |
| R2 · classes through lookups | Given task records with an optional owner, return a renamed copy of one task and a count of tasks per owner, with unowned tasks grouped under a fallback name. | Original record unchanged, empty owner text kept, missing owner handled. Revisit the first shape, copy, null or dictionary skill missed. |
| R3 · linq through exceptions | Given mixed update records behind one base type, produce summary lines for the valid ones with a query and a switch expression, and report a malformed one without catching every exception. | Arm order, a deferred query, and one expected failure. Return to the matching module on a miss. |
| R4 · generics through tracker | Adapt a supplied async reader with a generic fallback, then write a check that tells a faulty reader from a correct one. | Empty case, two payload types, a faulted task, and the check on both readers. Take the final assessment regardless of entry path. |

## Project sequence

The project is a small task tracker. Every checkpoint is a single-file task.

1. **P1 · Methods.** Compute a board count after arrivals and completions.
2. **P2 · LINQ.** Task records with an ID, title, status and owner. Count by status with repeated owners and an empty list.
3. **P3 · Checks.** Write a check that tells a broken edit from the correct behavior.
4. **P4 · Tracker.** Read tasks from an in-memory async source, validate them, and separate an expected outcome from an exception.
5. **P5 · Report.** A new request to audit an import, attempted from a fresh starter with the earlier types supplied.

## Scope

The core ends at composing a small typed program, diagnosing failures, writing a regression check and applying those skills to an unfamiliar task. Outside this course: spans, iterators, delegates and events beyond lambdas, operator overloading, reflection, ASP.NET, Entity Framework, file and network I/O, NuGet packages and project files.
