# TypeScript foundations

The beginner follows all 18 modules in order. The experienced path starts with the same save/run check and offers the readiness tasks below. A learner can open any module or practice drill directly. The manifest expands each stable module key below with `course:ts-foundations/module/`. Position is independent of identity.

## Outcome-to-assessment map

Each row gives a core outcome and the evidence that would demonstrate it. Only **values** and **tagged** have complete lesson content in this draft. Their module JSON maps each smaller outcome to individual questions and tasks. Other assessments below are plans.

| Module | Prior modules | What the learner can do | Assessment | Experienced entry |
| --- | --- | --- | --- | --- |
| 1. **save** · Save, run, read output | None | Save a two-line script and identify the output and the line of an error. | Change a supplied console.log message, identify a missing closing quote, then run it again. | Setup for both |
| 2. **values** · Values, variables and inference | save | Trace assignments, compute a number, construct a label, and repair a type mismatch. | arrival-log, remaining, shelf-label, repair-count and delayed seat-snapshot. | R1 |
| 3. **decisions** · Make a decision | values | Choose a branch using equality, ordering and boolean operators. Distinguish empty text and zero from absent data. | Implement a priority rule covering the threshold, zero, empty text and both boolean values. | R1 |
| 4. **functions** · Give a calculation a name | decisions | Write a typed function with a return value and local state. Explain why a name is out of scope. | Implement remainingAfter, run it twice, and repair an out-of-scope variable in a separate function. | R1 |
| 5. **lists** · Work through a list | functions | Build and traverse an array with a for-of loop and an accumulator. | Sum durations for empty and populated lists and correct a counter reset inside the loop. | R1 |
| 6. **shapes** · Describe a task | functions, lists | Describe a task with a type alias or interface, read a property and update an object while keeping its input intact. | Build a renamed task from a supplied shape. Reject a missing identifier and show the original title after calling it. | R2 |
| 7. **missing** · Handle a missing value | shapes, decisions | Represent a missing owner or due date. Use string literal unions, null checks and typeof to narrow a value. | Read a string or numeric ticket ID, then format a nullable task field while preserving an empty label and zero. | R2 |
| 8. **collections** · Group and transform tasks | lists, shapes, missing | Select and transform tasks with callbacks. Build a Map of groups and a Set of unique owners. | Group repeated owners and produce titles for open tasks, preserving order and handling an empty list. | R2 |
| 9. **tagged** · Choose fields by case | missing, functions, shapes, decisions | Model tag/payload pairs, use the tag to compute a result, and repair a field read. | describe-update, model-delivery, apply-edit, repair-caption and delayed sensor-display. | R2 |
| 10. **boundary** · Read unknown data | tagged, collections | Accept unknown input, distinguish it from unchecked any, and inspect real properties before accepting a task. | Classify null, arrays, primitives, wrong fields and valid tasks. Explain why a type assertion alone lets malformed input through. | R2 |
| 11. **modules** · Split code into modules | functions, shapes | Import and export values and types. Locate strict and target in supplied compiler settings and predict their roles. | Repair a local named import and distinguish a strict-null diagnostic from a change in emitted JavaScript target. | R3 |
| 12. **checks** · Read and write checks | modules, collections | Interpret expected and actual values, isolate an off-by-one defect, and write a distinguishing test. | Add an edge test that fails on a supplied faulty implementation and passes on the corrected one. | R3 |
| 13. **errors** · Recover from errors | boundary, checks | Separate an expected business outcome from an exception and safely explain an unknown thrown value. | Repair a loader that drops an empty success and handle both an Error and a thrown string. | R3 |
| 14. **async** · Wait for local data | errors, modules | Return a promise, await a local source and handle fulfillment and rejection. | Load two supplied sources, one resolved and one rejected. Check the returned data and message without clocks or I/O. | R3 |
| 15. **generic** · Keep a type relationship | functions, missing, collections | Preserve input/output types with a generic function and describe task projections with Pick, Omit and Partial. | Write a reusable first-or-fallback for numbers and strings. Reject an invalid task patch and a forbidden projected property. | R4 |
| 16. **compose** · Connect small pieces | async, generic, checks | Read fields, constructors and methods in an existing class, then compose its local reader with pure functions. | Use a supplied in-memory TaskStore through its method, transform results, and test two independent instances. | R4 |
| 17. **tracker** · Assemble the tracker | compose, boundary, tagged | Join task edits, input checks and a local asynchronous reader through module boundaries. | Run the accumulated project checkpoints with varied sources, then repair a failing integration case. | R4 |
| 18. **report** · Deliver an unfamiliar report | tracker | Independently combine validation, reporting, error handling, local async behavior and regression tests. | Implement the new import-audit contract in project.json. Run trusted acceptance cases and a learner-authored test. | All take |

## Concept map

The manifest lists the concept IDs introduced at each node and its direct prerequisites. Prior concepts carry forward through these connections.

- **T1–T2.** Saving and reading output → bindings, primitive values and expressions → decisions and truthiness → function parameters, returns and scope → loops over arrays.
- **T3–T5.** Arrays and object shapes → optional fields, literal unions and null checks → transformations and tagged variants → runtime validation of unknown data. Inference starts at a single binding. Explicit types return when a function or module exposes a contract.
- **T6–T7.** Functions and shapes → modules and compiler settings → tests and debugger-style tracing → errors → local promises and async functions.
- **T8–T9.** Functions, collections and type narrowing → generics and utility types → class-reading and composition with an async reader → tracker checkpoints → independent import audit.

## Experienced entry

Use a fresh problem for each readiness check. The learner can decide whether to study a group after seeing the result. Record specific demonstrated outcomes individually. A readiness task does not imply passes on every module in its group.

| Group | Task | Evidence and return point |
| --- | --- | --- |
| R1 · values through lists | Given a list of changes, compute the final count with a function that starts from a supplied number, ignores negative changes and preserves zero. Explain the type of the changing count. | Compare empty, mixed and repeated inputs. Revisit Values for inference, Decisions for branches, Functions for scope, or Lists for traversal. |
| R2 · shapes through boundary | Accept an unknown local payload, identify valid tagged tasks, group their optional owners, and preserve empty owner text. | Compare valid and malformed objects, null and empty lists. Ask why the type alias cannot validate the input at runtime. Revisit the first missing shape, narrowing or validation skill. |
| R3 · modules through async | Repair a two-file local reader, add a distinguishing test, and handle a rejected promise. Identify which compiler setting checks null access. | Check the import, test on the broken and fixed reader, and exercise both promise outcomes. Return to the corresponding module on a miss. |
| R4 · generic through tracker | Adapt a supplied class-based reader using a typed generic fallback and a task projection. Compose it with an existing task transformation. | Check the empty case, two input types, forbidden patch fields and the integrated output. Take the independent final assessment regardless of entry path. |

## Project sequence

1. **P1 · Functions.** Compute a count after arrivals and completions. The supplied fixtures start with empty and occupied queues.
2. **P2 · Collections.** Introduce task IDs, titles and status. Gather counts by status and test repeated owners and empty lists.
3. **P3 · Checks.** Split types, edits and tests into local modules. Write a regression that distinguishes a broken edit from the correct behavior.
4. **P4 · Compose.** Use an in-memory asynchronous reader and a class-based fixture, validate input, and distinguish expected outcomes from exceptions.
5. **P5 · Report.** Accept a new request to audit an import. The final contract and acceptance cases live in `project/project.json`. It can be attempted from a fresh workspace with supplied earlier interfaces.

## Scope

The core ends at composing a small typed program, diagnosing failures, writing a regression check and applying those skills on an unfamiliar task. Optional extensions after the core cover custom conditional and mapped types, template-literal types, and more elaborate generic constraints. Browser UI, frameworks, package publishing, network services and professional-readiness claims are outside this course. Repo excerpts and model help may supplement the bundled content.
