# Practice Range learning implementation progress

Implement the approved scope in `LEARNING_SCOPE.md`. All courses live inside Practice Range. Tutor stays a separate, unchanged mod, and its courses are not imported (D8). Commit coherent checked changes without co-author attribution. Preserve work outside this scope.

## Working implementation

| Code | Capability | Evidence |
| --- | --- | --- |
| I1 | Bundled TypeScript preview with 18 authored modules and 60 lesson tasks, including four project checkpoints and a two-file final assessment, plus four readiness checks outside the lessons. | `course-drafts/typescript/verify.mjs` passed 19 runnable examples, two intentional diagnostics, 82 reference runs, 82 alternatives, and 129 named wrong-answer witnesses across 165 case runs. |
| I2 | Course catalog, module navigation, predictions, runnable examples, reading position, save checks, hints, solution reveal, and reset backups. No repo or AI required. | `tests/course-pack.test.mjs` and `tests/course-session.test.mjs`. |
| I3 | Bounded project workspaces with complete file snapshots, trusted supplied files, stale-result detection, and backups of both editable files. | `tests/course-project.test.mjs`. The final assessment checks both implementation correctness and the learner's regression test against correct and faulty candidates. |
| I4 | Course review in fresh files, original-answer preservation, assistance tracking, review intervals, and explained next-action recommendations. | `tests/course-review.test.mjs` and the review session test. Reuses existing practice scheduling rules. |
| I5 | Lesson links to matching language practice topics. Returning to Courses restores the lesson. | Native navigation assertions in `tests/check-courses.mjs`. |
| I6 | Optional AI questions in lessons and course exercises using existing provider settings, cancellation and tool restrictions. Successful on-task AI help is recorded as assistance. | `tests/course-help.test.mjs` and existing `tests/tutor.test.mjs` pass using stubbed providers. |
| I7 | Optional sync includes course enrollment, answers, review files inside answers, and backups. The selected enrollment version also syncs. Checker artifacts and local repo attachments are excluded. | `tests/sync.test.mjs` verifies two-device transfer and exact upgrade of the prior generated ignore file. Custom ignore files stay untouched. |
| I8 | Immutable content versions, retained prior packs, pinned enrollment selection, and separate starts for newer versions. | `tests/course-version.test.mjs` rejects same-version content edits and verifies retained content and preserved enrollment data. |
| I9 | Optional local repo attachment for bounded, pinned source excerpts in course questions. Missing or damaged attachments fall back to bundled material. | `tests/course-repo.test.mjs` preserves dirty files, verifies pinned content and Unicode paths, bounds excerpts, and checks missing/corrupt attachments. |
| I11 | Optional generated repo reading for a module or sampled architecture. Saved lessons retain verified pinned excerpts without changing the standard course or exercise evidence. | `tests/course-supplements.test.mjs` checks source validation, dirty-file preservation, immutable reuse, missing repos, cancellation, provider errors, changed attachments and damaged saved data. Sync tests include the portable supplemental record. Native fixtures cover saved reading and generation states. |
| I12 | Source navigation from saved repo lessons. The reader pages through the pinned file, marks referenced lines, and returns to the original lesson. Missing, binary and oversized files fall back to saved excerpts. | `tests/course-source.test.mjs` verifies pinned content, bounded pages, invalid selectors, unchanged evidence and dirty files, and cached fallback. |
| I13 | Course entry from setup and language cards, including before compiler/editor installation. Language cards filter the catalog, and Back returns to the original screen without ending a paused review. | Eight pack/version/setup tests and nine native fixtures passed. UI registration is checked against the actual course language. |
| I14 | Portable known-language preferences for familiar-language context in course and practice AI questions. | `tests/learning-profile.test.mjs`, question context checks and sync transfer pass. Saved and damaged preference states pass native checks. |
| I17 | Module evidence combining course exercises and linked practice drills: not started, started, read, skipped, practiced with help, passed once without help, shown independently. Shown independently needs independent passes on two different exercises or drills, or one confirmed by a clean later review. Hinted and revealed passes never count. Due linked drills become a recommendation that opens Practice topics. | `tests/course-evidence.test.mjs` covers hinted passes, revealed solutions, later independent passes, clean and failed reviews, mixed drill/course evidence, overdue drills, the current practice topic, changed course versions and damaged practice sessions. Two native fixtures cover status labels, the drill recommendation and the damaged-session banner. Duplicate saves were already covered in `tests/course-session.test.mjs`. |
| I18 | Optional AI extra practice for bundled course lessons. Up to six output-checked exercises per lesson, saved in the enrollment's `extra-practice.json` only after the reference passes and the starter and wrong answers fail. The shipped pack is unchanged. Extras are labeled, sync between devices, and never count toward module evidence or course review. A damaged file hides extras and preserves their progress. | `tests/course-extras.test.mjs` runs real TypeScript validation, checks an unchanged bundled pack, evidence and review exclusion, continued numbering, failed validation, unvalidated saves, cancellation and damaged-file recovery. Sync tests transfer the file. Four native fixtures cover the lesson section, generation, the damaged-file banner and an extra task. |
| I19 | Tracker project checkpoints (board count, group by status, catch a broken edit, read and validate local tasks) as tasks inside their modules, listed with the final audit on the module page. They count as evidence for their module. | Verifier runs each checkpoint with concepts limited to its module and earlier. `tests/course-migration.test.mjs` checks the ordered list and module evidence. |
| I20 | Readiness checks R1–R4 for the experienced entry path. Each is a fresh problem stored outside any lesson. A result names modules to skim or revisit. It never counts as module evidence, never enters course review, and offers no AI help. | Verifier limits concepts to each group. The readiness test checks hidden references, unchanged lesson position, unchanged module evidence and review exclusion. Two native fixtures cover results and the task view. |
| I21 | Explicit update of an enrollment to a newer compatible pack version. The new version declares accepted earlier versions and ID replacements. Progress, reading, question results, answers, backups and extras carry over. Replaced assessments that changed meaning keep history but need a fresh pass. Unmatched work is retired, never credited. The old enrollment stays unchanged and selectable. | `tests/course-migration.test.mjs` migrates a real 0.1.0-preview.1 enrollment to preview.2 and covers replacements, retired work, dropped reading positions, removed questions, active reviews and repeated updates. Sync tests transfer the receipt. Two native fixtures cover the update banner and an incompatible version. |

The course remains a preview. Compiler correctness and native materialization do not establish teaching effectiveness or verify layout and paint.

## Phase status and next work

| Phase | Status | Remaining work |
| --- | --- | --- |
| P0 | Baselines recorded below. | Reinspect current code before each phase. |
| P1 | Outline, concept map, sample format and sample execution complete. | Learner observation still required before claiming the course teaches effectively. |
| P2 | Loader, pinned enrollment, retained pack versions, shared checker adapter and native lesson flow implemented. | Keep archived packs in releases when rebuilding to a new content version. |
| P3 | All 18 modules, four project checkpoints, the final project and four readiness checks execute through the real checker. Content version 0.1.0-preview.2. | Review pacing with learners. |
| P4 | Core course UI, setup/language entry points, known-language preferences for AI comparisons, linked practice, optional AI, shared editor opening and explicit version migration implemented. | Verification of real editor flows with a learner. |
| P5 | Optional pinned repo context, saved module/architecture supplements and source navigation implemented. Tutor import was built, then removed on 2026-11-26 (D8). | Generated explanations need learner review. |
| P6 | Course review, deterministic recommendations, combined module evidence, linked drill review recommendations and validated extra practice for bundled courses implemented. | Check with learners that the evidence rules match observed skill and that generated exercises are useful. |
| P7 | Pilot kit ready for TypeScript. C# course plumbing done: C# compiler rule and task modes in the loader, runnable C# examples, printed-output checks, and a shared verifier and builder (`scripts/verify-course.mjs`, `scripts/build-course.mjs`). A one-module C# draft verified and built. | Write the C# course from `CSHARP_COURSE_BRIEF.md`. The owner tests it. Running a C# course inside the app is not tested yet. |
| P8 | Release checklist, requirements, tested platform and release notes prepared in `RELEASE.md`. | Rerun checks after P7, then release. |

## Verification record

The full Practice Range Node suite ran with concurrency 3. It passed 94 of 96 tests, including the existing language reference-answer checks. The two editor tests failed under the sandbox's local-socket restrictions. Both editor files then passed all four tests outside the sandbox with `TMPDIR=/private/tmp`, avoiding macOS `/var` versus `/private/var` alias assertions.

All original native panel states passed across the full run and targeted reruns. Some attempts were interrupted while loading the large SQL catalog. The native harness now accepts state names so only unresolved states need repeating. The expanded course harness passed all twenty-five fixtures across full and targeted checks, including project, review and optional AI states. Native checks require access to macOS window services, which the sandbox denies even for an empty panel.

The four earlier type errors in `kit/open-as.js` are fixed. The saved tab location is validated with an explicit type guard, and the canonical kit was propagated through `scripts/sync-kit.mjs`. Practice Range type checking and the kit consistency check now pass.

The repo supplement integration run passed all 46 course, AI and sync tests. Native checks passed the new saved-repo-lesson and generation states plus existing lesson and attachment states. Type checking and whitespace checks passed. Provider behavior is tested with controlled responses, not live model calls. Source validation checks locations and captures actual code. It cannot establish that generated explanations are correct.

Source navigation passed nine focused repo/source/supplement tests and an 18-test source and session run. Native fixtures passed for source reading, cached/missing excerpts and supplemental reading. Type checking and whitespace checks passed. The reader shows pinned content inside Courses. Opening live files in an external editor is not part of this change.

The learning-profile integration run passed all 52 course, learning-profile, AI and sync tests. Five native fixtures passed for saved/damaged preferences, catalog, modules and language entry. Type checking and whitespace checks passed. Preferences live in portable `learning.json`, separate from machine configuration. Broken preference files remain preserved and do not block lessons. Provider tests use controlled responses, so explanation quality still needs learner observation.

The generated-exercise run passed all 63 course, learning-profile, AI and sync tests, including real TypeScript and .NET validation runs. Eleven native fixtures passed for exercise authoring, generated tasks and the existing generation states. Type checking and whitespace checks passed. Output-only checks cannot judge code style or approach.

The evidence run passed all 74 course, review, learning-profile, AI and sync tests. Four native fixtures passed for module evidence, damaged practice progress, modules and lessons. Type checking and whitespace checks passed. Practice progress is read only. Course actions never write drill progress. The native harness checks rendering, not the click that opens Practice topics.

The extra-practice run passed all 77 course, review, learning-profile, AI and sync tests. Nine native fixtures passed for extra practice and the related lesson, task and generated states. Type checking and whitespace checks passed.

The P3/P4 run passed 106 course, review, setup, TypeScript catalog, AI and sync tests. The course verifier passed every new task. Two full native runs passed all 53 course fixtures. One other full run stopped on `example-output` while loading the SQL catalog, the known interruption above, and that fixture passed on rerun. Type checking and whitespace checks passed. Readiness results suggest where to start. They have not been checked against learner judgment.

The Tutor import removal run passed all 129 Practice Range tests, all 35 remaining course panel fixtures and all 47 practice panel states. Type checking, whitespace and Herdr mod checks passed. The C# checker and TypeScript compiler settings match their state before the import, apart from an unrelated C# escape fix.

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

## Continuing work

Astra completed the initial samples and two additional batches, then reached its account usage limit. Its remaining draft files were verified before registration. Compose, Tracker and Report were completed afterward using the same checker and wrong-answer criteria. Do not assume a provider is available for more authoring.

No automation or automatic restart has been configured. Resuming a paused chat requires an available session. Continue from the phase table and current Git state rather than regenerating the existing course.
