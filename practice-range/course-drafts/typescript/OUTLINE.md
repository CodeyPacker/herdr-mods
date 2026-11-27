# TypeScript foundations

Status: content version 0.2.0-preview.1, rewritten on 2026-11-27 (see `COURSE_REDESIGN.md`, Phase D). 18 modules, 59 lesson tasks and four skip-ahead tests, all passing `node scripts/verify-course.mjs typescript`. The course teaches TypeScript one concept at a time, with examples from everyday data and no project theme (D11, D12).

The beginner follows the modules in order. A learner who already knows some TypeScript can take the skip-ahead tests from the bottom of the course page. Each module is `modules/<key>/module.md` (format in `scripts/course-markdown.mjs`) with its tasks in `modules/<key>/tasks/`. The manifest expands each key with `course:ts-foundations/module/`.

## Modules

| Module | Prior modules | What the learner can do | Tasks | Skip-ahead test |
| --- | --- | --- | --- | --- |
| 1. **save** · Run code, read a type error | None | Save a two-line script and identify the output and the line of an error. | save-fix-message, save-board-sign, save-echo-card | Setup |
| 2. **values** · Types and inference | save | Trace assignments, compute a number, construct a label, and repair a type mismatch. | arrival-log, remaining, shelf-label, repair-count, seat-snapshot | R1 |
| 3. **decisions** · Narrowing with control flow | values | Choose a branch using equality, ordering and boolean operators. Distinguish empty text and zero from absent data. | decisions-limit, decisions-flag, decisions-empty-label | R1 |
| 4. **functions** · Function types | decisions | Write a typed function with a return value and local state. Explain why a name is out of scope. | functions-return-count, functions-extra-hours, functions-movement | R1 |
| 5. **lists** · Arrays and tuples | functions | Build and traverse an array with a for-of loop and an accumulator. | lists-sum, lists-long, lists-min-max, lists-count-zero | R1 |
| 6. **shapes** · Object types and interfaces | functions, lists | Describe an object with a type alias or interface, read a field, and copy an object without changing the original. | shapes-rename, shapes-ticket, shapes-move | R2 |
| 7. **missing** · null, undefined and optional | shapes, decisions | Represent a missing value with null, undefined and optional fields. Use ??, ?. and typeof to handle it. | missing-owner, missing-ticket-id, missing-status | R2 |
| 8. **unions** · Union and literal types | missing | Write union and literal types, predict widening, and narrow a union before using it. | unions-join-tags, unions-sizes, unions-lights | R2 |
| 9. **tagged** · Discriminated unions | missing, functions, shapes, decisions, unions | Model tag/payload pairs, use the tag to compute a result, and repair a field read. | describe-update, model-delivery, apply-edit, repair-caption, sensor-display | R2 |
| 10. **collections** · Transform arrays, maps and sets | lists, shapes, missing | Select and transform arrays with callbacks. Count with a Map and remove duplicates with a Set. | collections-titles, collections-owner-counts, collections-unique | R2 |
| 11. **boundary** · unknown and type guards | tagged, collections | Accept unknown input, tell it apart from any, and check real fields before trusting it, including with a type guard. | boundary-safe-title, boundary-valid-task, boundary-safe-list | R2 |
| 12. **modules** · Modules | functions, shapes | Import and export values and types. Locate strict and target in supplied compiler settings and predict their roles. | modules-named, modules-export-task, modules-config | R3 |
| 13. **checks** · Writing tests | modules, collections | Interpret expected and actual values, isolate an off-by-one defect, and write a distinguishing test. | checks-threshold, checks-choose-test, checks-test-order | R3 |
| 14. **errors** · Errors and failure | boundary, checks | Separate an expected business outcome from an exception and safely explain an unknown thrown value. | errors-error-text, errors-read-result, errors-lookup | R3 |
| 15. **async** · async and Promises | errors, modules | Return a promise, await a local source and handle fulfillment and rejection. | async-double, async-read-batch, async-in-order | R3 |
| 16. **generic** · Generics | functions, missing, collections | Preserve input and output types with a generic function, limit T with a constraint, and build types with Pick, Omit and Partial. | generic-first, generic-edit-shapes, generic-pair | R4 |
| 17. **utility** · Utility types | generic, shapes | Build types with Record, Required, Readonly and ReturnType. | utility-tally, utility-finalize, utility-promote | R4 |
| 18. **mapped** · Mapped and conditional types | utility | Write your own types with keyof, T[K], mapped types and conditional types. | mapped-get-field, mapped-flags, mapped-item-of | R4 |

## Skip-ahead tests

Each is a fresh problem stored outside the lessons. A result names modules to skim or revisit and never counts as module evidence.

| Test | Modules | Files |
| --- | --- | --- |
| R1 · Values through lists | values, decisions, functions, lists | `readiness/r1/` |
| R2 · Shapes through boundary | shapes, missing, unions, collections, tagged, boundary | `readiness/r2/` |
| R3 · Modules through async | modules, checks, errors, async | `readiness/r3/` |
| R4 · Generics through mapped types | generic, utility, mapped | `readiness/r4/` |

## Scope

The course ends at writing your own types with `keyof`, mapped types and conditional types. Outside this course: browser UI, frameworks, package publishing, network services, decorators, declaration files and build tooling. Repo lessons and AI help can add to the bundled content.
