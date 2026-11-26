# Practice Range learning implementation progress

Implement the approved scope in `LEARNING_SCOPE.md`. Practice Range is the destination. Keep Tutor and its user data available until import and feature parity are verified. Commit coherent checked changes without co-author attribution. Preserve work outside this scope.

## Working implementation

| Code | Capability | Evidence |
| --- | --- | --- |
| I1 | Bundled TypeScript preview with 18 authored modules and 56 tasks, including a two-file final assessment. | `course-drafts/typescript/verify.mjs` passed 19 runnable examples, two intentional diagnostics, 74 reference runs, 74 alternatives, and 113 named wrong-answer witnesses across 149 case runs. |
| I2 | Course catalog, module navigation, predictions, runnable examples, reading position, save checks, hints, solution reveal, and reset backups. No repo or AI required. | `tests/course-pack.test.mjs` and `tests/course-session.test.mjs`. |
| I3 | Bounded project workspaces with complete file snapshots, trusted supplied files, stale-result detection, and backups of both editable files. | `tests/course-project.test.mjs`. The final assessment checks both implementation correctness and the learner's regression test against correct and faulty candidates. |
| I4 | Course review in fresh files, original-answer preservation, assistance tracking, review intervals, and explained next-action recommendations. | `tests/course-review.test.mjs` and the review session test. Reuses existing practice scheduling rules. |
| I5 | Lesson links to matching language practice topics. Returning to Courses restores the lesson. | Native navigation assertions in `tests/check-courses.mjs`. |
| I6 | Optional AI questions in lessons and course exercises using existing provider settings, cancellation and tool restrictions. Successful on-task AI help is recorded as assistance. | `tests/course-help.test.mjs` and existing `tests/tutor.test.mjs` pass using stubbed providers. |
| I7 | Optional sync includes course enrollment, answers, review files inside answers, and backups. The selected enrollment version also syncs. Checker artifacts and local repo attachments are excluded. | `tests/sync.test.mjs` verifies two-device transfer and exact upgrade of the prior generated ignore file. Custom ignore files stay untouched. |
| I8 | Immutable content versions, retained prior packs, pinned enrollment selection, and separate starts for newer versions. | `tests/course-version.test.mjs` rejects same-version content edits and verifies retained content and preserved enrollment data. |
| I9 | Optional local repo attachment for bounded, pinned source excerpts in course questions. Missing or damaged attachments fall back to bundled material. | `tests/course-repo.test.mjs` preserves dirty files, verifies pinned content and Unicode paths, bounds excerpts, and checks missing/corrupt attachments. |
| I10 | Previewable Tutor import for C# and TypeScript, including original lessons, quizzes, reading positions, historical results, primary answers, unmatched answers, and optional compatible preferences. | `tests/course-import.test.mjs` checks read-only preview, atomic publication, repeated imports, separate revised enrollments, stale previews, damaged data, path restrictions, interrupted staging, strict C# checks, legacy TypeScript DOM settings, and repo recovery. |
| I11 | Optional generated repo reading for a module or sampled architecture. Saved lessons retain verified pinned excerpts without changing the standard course or exercise evidence. | `tests/course-supplements.test.mjs` checks source validation, dirty-file preservation, immutable reuse, missing repos, cancellation, provider errors, changed attachments and damaged saved data. Sync tests include the portable supplemental record. Native fixtures cover saved reading and generation states. |
| I12 | Source navigation from imported lessons and repo supplements. The reader pages through the pinned file, marks referenced lines, and returns to the original lesson. Missing, binary and oversized files fall back to saved excerpts. | `tests/course-source.test.mjs` verifies pinned content, bounded pages, invalid selectors, unchanged evidence and dirty files, and cached fallback. Import recovery tests exercise original lesson references. |

The course remains a preview. Compiler correctness and native materialization do not establish teaching effectiveness or verify layout and paint.

## Phase status and next work

| Phase | Status | Remaining work |
| --- | --- | --- |
| P0 | Baselines recorded below. | Use the migration map below when implementing Tutor import. Reinspect current code before each phase. |
| P1 | Outline, concept map, sample format and sample execution complete. | Learner observation still required before claiming the course teaches effectively. |
| P2 | Loader, pinned enrollment, retained pack versions, shared checker adapter and native lesson flow implemented. | Keep archived packs in releases when rebuilding to a new content version. |
| P3 | All 18 modules and the final project execute through the real checker. | Expose intermediate standalone project checkpoints, finish experienced-learner readiness assessments, and review pacing with learners. |
| P4 | Core course UI, linked practice, optional AI and shared editor opening implemented. | Add course activation to language setup, known-language preferences/comparisons, compatible progress migration between pack versions, and verify real editor flows with a learner. |
| P5 | Optional pinned repo context, saved module/architecture supplements, source navigation and previewable Tutor course import implemented. Existing settings and original Tutor files are preserved. | On-demand writing of unfinished Tutor modules remains. Generated explanations need learner review. Keep Tutor available until that authoring flow and launch compatibility move. |
| P6 | Course review and deterministic recommendations implemented. | Combine drill/course evidence and review entry points, add optional validated generated exercises, and test content-version transitions. |
| P7 | Not started. | Learner pilot and corrections, then C# and SQL course packs. Their existing direct practice remains supported. |
| P8 | Not started. | Final release checks, install/migration documentation, compatibility launch transition, and release. No source mod removal in the first release. |

## Verification record

The full Practice Range Node suite ran with concurrency 3. It passed 94 of 96 tests, including the existing language reference-answer checks. The two editor tests failed under the sandbox's local-socket restrictions. Both editor files then passed all four tests outside the sandbox with `TMPDIR=/private/tmp`, avoiding macOS `/var` versus `/private/var` alias assertions.

All original native panel states passed across the full run and targeted reruns. Some attempts were interrupted while loading the large SQL catalog. The native harness now accepts state names so only unresolved states need repeating. The expanded course harness passed all twenty-five fixtures across full and targeted checks, including project, review and optional AI states. Native checks require access to macOS window services, which the sandbox denies even for an empty panel.

The migration integration run passed 55 tests. The existing C# and TypeScript catalogs each passed all 800 reference answers after compatibility changes. Nine native import fixtures passed, including previews, optional preferences, damaged records, original lessons and quizzes, and imported answers. The four earlier type errors in `kit/open-as.js` are fixed. The saved tab location is validated with an explicit type guard, and the canonical kit was propagated through `scripts/sync-kit.mjs`. Practice Range type checking and the kit consistency check now pass.

The repo supplement integration run passed all 46 course, AI and sync tests. Native checks passed the new saved-repo-lesson and generation states plus existing lesson and attachment states. Type checking and whitespace checks passed. Provider behavior is tested with controlled responses, not live model calls. Source validation checks locations and captures actual code. It cannot establish that generated explanations are correct.

Source navigation passed nine focused repo/source/supplement tests and an 18-test source/import/session run. Five native fixtures passed for source reading, cached/missing excerpts, supplemental reading and imported lessons. Type checking and whitespace checks passed. The reader shows pinned content inside Courses. Opening live files in an external editor is not part of this change.

Tutor's baseline suite passed 14 of 18 tests. Its four TypeScript runner tests report that Tutor's own compiler dependency is absent. Tutor code and dependencies have not been changed to hide this baseline limitation.

Useful commands from the repository root:

```sh
node practice-range/course-drafts/typescript/verify.mjs
node practice-range/scripts/build-course.mjs
node --test practice-range/tests/course-*.test.mjs practice-range/tests/tutor.test.mjs practice-range/tests/sync.test.mjs
node practice-range/tests/check-courses.mjs
node practice-range/tests/check-panels.mjs tutor-off tutor-chat tutor-thinking tutor-error tutor-setup
env TMPDIR=/private/tmp node --test practice-range/tests/editor.test.mjs practice-range/tests/compare.test.mjs
node practice-range/mods/practice-range/languages/typescript/node_modules/typescript/bin/tsc -p practice-range/mods/practice-range/tsconfig.json --pretty false
git diff --check
```

Only broaden checks when a new change, failure, or unresolved concern justifies it. No real provider calls are required for the question-flow tests. Do not download dependencies during answer checks.

## Tutor migration map

| Existing Tutor record | Intended destination or rule |
| --- | --- |
| `data/tutor/courses/<slug>/course.json` | Import as a namespaced legacy repo course. Preserve language, root attachment, pinned commit, created time, parts, original module order, known languages and repo-specific summary. Do not replace its sequence with the new foundation course. |
| `modules/<id>.json` intro and stops | Preserve explanation text and repo excerpt metadata: file, start/end, anchor and pinned commit. Add repo source resolution alongside bundled sources. Missing source must be recoverable. |
| Module quiz records | Preserve question IDs, choices, correct indices, explanations and linked stop. Treat stored quiz passes as quiz evidence only. |
| `exercises/<id>.json` | Add adapters for legacy TypeScript and C# exercise formats. Preserve source references and stable imported IDs. Run through registered language tooling. |
| `progress.json` modules seen and last position | Preserve read positions and reading completion. Never convert them into independent coding passes. |
| Module `quiz` best, attempts and passed | Preserve historical quiz evidence, including unknown timing or assistance. Retired module records remain in legacy history, and each available imported module retains its own resume position. |
| Module `practice` passed, runs, hints, gaveUp and at | Preserve known fields. Do not infer independent passes when assistance cannot be established. |
| Module `doneAt` | Preserve as legacy module completion, separate from demonstrated coding ability. |
| `data/tutor/work/<slug>/<exercise-id>/` | Copy learner work to the imported course's own answer directories. Preserve originals and prevent collisions with bundled course and drill IDs. |
| `data/tutor/settings.json` editor, agent and known | Offer compatible preferences only where Practice Range has no explicit value. Copy no credentials. Keep repo paths local to each machine. |
| Import provenance | Record source identity and imported content revision. Repeated imports must not duplicate courses or overwrite newer destination work. Preview before applying. |

## Continuing work

Astra completed the initial samples and two additional batches, then reached its account usage limit. Its remaining draft files were verified before registration. Compose, Tracker and Report were completed afterward using the same checker and wrong-answer criteria. Do not assume a provider is available for more authoring.

No automation or automatic restart has been configured. Resuming a paused chat requires an available session. Continue from the phase table and current Git state rather than regenerating the existing course.

## Tutor import implementation

`courses/importer.mjs` builds a read-only source snapshot and a preview fingerprint. Apply checks the fingerprint and source stability, stages under the ignored `.tutor-imports/` directory, then publishes an immutable version. Repeated imports reuse existing data. Revised content becomes a separate enrollment. Copied packs and import receipts sync with progress. Repo paths stay in excluded machine attachments. Missing source excerpts can be recovered from an attached clone without rewriting the imported pack.

Imported course folders use plain names because MSBuild interprets percent escapes in project paths. Existing bundled TypeScript folder paths are unchanged. C# imports preserve nullable warnings as errors and SDK implicit usings. TypeScript imports preserve ES2023 and DOM library settings, while regular practice keeps its existing compiler settings. Unknown earlier assistance prevents independent credit until a fresh start.

Tutor remains installed and unchanged. The importer moves already-written material. It does not yet generate unwritten lessons or replace the full repo course authoring flow. Native checks verify eager element materialization and selected navigation assertions, not layout, paint, or a real learner session.
