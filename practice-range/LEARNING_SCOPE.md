# Practice Range learning project scope

Practice Range becomes the single learning mod for structured courses, direct practice, and review. It takes Tutor's teaching ideas and optional repo examples. Tutor stays a separate mod. The default course requires no repo and no model. Premade, reviewed course packs provide the foundation. The user's model provides optional personal help.

Status: in progress. Phase acceptance criteria below define completion, rather than promises about learning effectiveness. `LEARNING_PROGRESS.md` holds test evidence for each capability.

## Completion status

| Phase | Status | Completed | Remaining |
| --- | --- | --- | --- |
| P0 | Done | Baselines and test commands recorded. | None. |
| P1 | Done except learner review | TypeScript outline, concept map, schema and samples verified with the real checker. | Learner observation of pacing and clarity. |
| P2 | Done | Loader, pinned enrollment, retained versions, shared checker adapter and lesson flow. | None. |
| P3 | Done except learner review | All 18 modules and 60 tasks pass reference, alternative and wrong-answer checks. Four tracker checkpoints and the final audit form a listed project. Four readiness checks (R1–R4) serve the experienced entry path. | Learner pacing review. |
| P4 | Done except learner review | Course UI, setup and language-card entry, linked practice, optional AI, known-language preferences, shared editor opening, and explicit progress migration to a newer compatible pack version. | Real editor flow with a learner. |
| P5 | Done except learner review | Pinned repo excerpts, repo module and architecture lessons, and source browsing. Tutor import was built, then removed (D8). | Learner review of generated explanations. |
| P6 | Done except learner review | Course review, assistance tracking, explained recommendations, module evidence combining course exercises with linked drills, recommendations for due linked drills, and optional validated AI extra practice for bundled courses. Fixtures cover hinted passes, revealed solutions, later independent passes, overdue review, changed versions and mixed sessions. | Learner review of the evidence rules and generated exercises. |
| P7 | C# course written, owner test next | TypeScript pilot kit ready but not run. The C# course is written, verified and registered: 18 modules, 61 lesson tasks including four project checkpoints, and four readiness checks. | The owner takes the C# course on the experienced path. TypeScript pilot later. No other testers are available. |
| P8 | Prepared, blocked on P7 | `RELEASE.md` records requirements, the tested platform, every check with its last result and release notes. All 129 tests and 82 native panel checks passed. | Rerun checks after the pilot, then release. |

## Product decisions

| Code | Decision |
| --- | --- |
| D1 | Build inside `practice-range/mods/practice-range`. Preserve the mod ID, existing launch commands, language packs, and data paths. Tutor is the source of features to move, not the destination. |
| D2 | Provide Course, Practice, and Review as entry points in one mod. Direct practice never requires enrollment, a repo, or a model. |
| D3 | Ship optional, separately versioned course packs alongside language packs. Offer Practice only or Practice and course during language setup. For the first release, course files are bundled with the mod and enabled locally. No remote marketplace or separate download service is required. |
| D4 | A course teaches the whole planned foundation using default examples. A repo supplies additional examples and its own architecture section. Missing repo features never remove foundational lessons. |
| D5 | Use Astra during development to design and critique course content. Review, execute, and version that content before shipping. Runtime AI answers questions, explains errors, compares familiar languages, and optionally supplies repo examples or additional exercises. |
| D6 | Preserve lesson completion and demonstrated skill as separate records. Keep recommendations optional and explain why a lesson or review is suggested. |
| D7 | Pilot TypeScript first. Preserve C# and SQL practice throughout. Add their courses after validating the TypeScript teaching format. |
| D8 | Do not import Tutor courses. Tutor stays a separate, unchanged mod. Tourist stays separate. Changed on 2026-11-26: the import was built, then removed, because only the project owner had Tutor data and did not need it. |
| D9 | A course teaches its language on its own terms. Lesson text, hints and feedback never compare it with another language or assume the learner knows one. The experienced entry path and readiness checks stay, because they only let a learner skip modules. Decided on 2026-11-26. |

## Current implementation

| Code | Existing behavior | Consequence |
| --- | --- | --- |
| F1 | Tutor supports TypeScript and C#, generates modules on demand, and runs its own exercises. | Reuse its course views and teaching features, but consolidate execution in Practice Range. |
| F2 | Tutor course listing, prompts, validation, and code excerpts assume a git repo and pinned commit. | Add a real bundled content source. Removing the folder picker alone is insufficient. |
| F3 | Practice Range has three language packs, save checks, hints, optional AI help, scratch, answer comparison, review, and optional git sync. | Preserve these capabilities while adding courses. |
| F4 | Tutor opens Practice Range at a topic through tab props. Results do not flow back into the course through that link. | Replace the separate-tab handoff with course context in the existing practice session. Preserve external topic launch compatibility. |
| F5 | The two mods store different progress and exercise formats. | Add explicit adapters and migration. Do not relabel old quiz passes as independent coding success. |
| F6 | Existing code checks generated reference answers and starters. | Add incorrect-answer and teaching review criteria. A passing reference does not establish sufficient test coverage. |

Relevant code: `tutor/mods/tutor/{course,build,prompts,validate,practice,progress,learner}.js`, `tutor/mods/tutor/views/`, and `practice-range/mods/practice-range/{main,start-topic,review,types}.js`, `languages/`, `tutor/`, and `runner.mjs`. These paths describe the current implementation. Inspect it again when each phase starts because other changes may land meanwhile.

## Learner experience

### Starting without a repo

Choose a language, enable its course, identify whether programming itself is new, and optionally name familiar languages. Complete the existing runtime and editor setup. Open the first lesson immediately from bundled content. Existing developers can skip foundation modules or take an optional readiness check. Skipping is not recorded as passing.

Each module introduces a small concept, asks the learner to predict behavior, demonstrates a runnable example, provides a guided modification, and ends with independent work. Later modules revisit earlier ideas. A small task tracker supplies continuity without becoming a prerequisite for unrelated drills.

### Starting with a repo

The same course remains available. Attach a local repo during setup or later and select a pinned commit. Match suitable excerpts to course concepts. Show their origin explicitly. Keep bundled examples available when an excerpt is confusing, missing, or unavailable. Put architecture teaching in a repo section with its own progress.

### Practicing and returning

Lessons open relevant exercises with a return destination. A result offers Retry, Next exercise, Ask for help, or Return to lesson as appropriate. Direct practice retains its selected topic and exercise independently of the course. Review combines eligible course exercises and existing drills without overwriting saved answers.

### Using optional AI

Core reading, quizzes, checking, hints, comparison, and review work with no model connection. Claude or Codex can provide questions and answers, error explanations, familiar-language comparisons, and repo teaching. Failed requests preserve the current lesson and answer. Additional generated exercises remain local, are labeled as generated, and are excluded until validation passes. They do not replace shipped assessment tasks.

## Course pack and data boundaries

### Course pack contract

Course packs are immutable content installed under the existing mod. User files and results live in the existing Practice Range data root. Proposed source layout is `courses/<course-id>/` for the manifest, module JSON, bundled examples, exercises, and project fixtures. Final filenames are settled with the sample in P1, before full authoring.

| Code | Record | Required information |
| --- | --- | --- |
| C1 | Manifest | Schema version, stable course ID, content version, language ID, supported runner/compiler range, title, audience, outcomes, ordered modules, entry paths, and prerequisite concepts. |
| C2 | Module | Stable ID, explicit prerequisites and outcomes, lesson steps, example references, question IDs, exercise references, and links to later review. |
| C3 | Lesson step | Explanation, prediction, walkthrough, modification, or independent task. References a bundled file or repo excerpt where relevant. No arbitrary executable UI markup. |
| C4 | Exercise | Stable course-local ID, concept IDs, prompt, starter, supplied fixtures, reference answer, progressive hints, runtime/type checks, any justified syntax rules, and known wrong answers. Use the existing language runner's actual format through an adapter. |
| C5 | Project | Ordered checkpoints, isolated workspace files, allowed edits, trusted tests, and final acceptance tasks. Distinguish supplied code from learner work. |
| C6 | Content source | Bundled file and content version, or local repo path, commit, file, range, and anchor. Repo attachments belong to the learner, not the shipped manifest. |
| C7 | Compatibility map | Explicit replacements for changed module/exercise IDs and whether prior completion remains valid. No match means new material, not an inferred pass. |

Use namespaced IDs so course exercises cannot collide with `topic/exercise` drill IDs. A module may teach several concepts and reference several practice topics. Replace AI-only one-topic matching for shipped courses with reviewed mappings.

Do not import arbitrary runner modules named by a course pack. Execution remains restricted to registered language runners. Pinned tools and trusted checks ship through the repository release process.

### Progress and content updates

Keep existing drill progress and answer paths intact. Add course enrollment, content version, module position, question results, attempts, assistance, timestamps, and project checkpoints. Preserve the difference between an answer shown, a pass after hints, and an independent pass. Record concept evidence without claiming that one passing exercise establishes mastery.

Updates affect new enrollments by default. Existing enrollments remain pinned until the learner chooses an available compatible update. Preserve the previous content needed for those enrollments. Apply ID mappings explicitly, keep removed answers recoverable, and request a retake where assessment meaning changed. Disable a course without erasing progress. Do not offer uninstall where it would strand a pinned enrollment.

Extend optional sync to course progress, and learner answers. Exclude checker artifacts, dependency folders, local machine setup, absolute repo paths, and transient chat. Preserve existing sync conflict behavior. Repo attachment paths are configured per machine. Bundled pack content is supplied by the mod version, not copied into every progress commit.

### Exercise execution

Keep Practice Range's save checking, compiler diagnostics, source mapping, bounded processes, latest-save handling, and editor lifecycle. Restrict syntax checks only when the requested syntax is itself the learning goal. Behavioral and type checks should accept equivalent correct solutions.

Start with isolated snippets and supplied local module fixtures. Add a bounded project workspace for later checkpoints with an explicit file manifest, trusted checks outside editable files, stale-result handling, and workspace reset. This is a course feature, not a general IDE or arbitrary package runner. Use local fixtures instead of network calls. No dependency installation during answer checks.

## Delivery phases

### P0 Confirm boundaries and establish baselines

Inspect current work in progress before modifying shared files. Capture existing language setup, topic launches, editor behavior, progress formats, sync behavior, and relevant test commands. Inventory Tutor lesson chat, quizzes, comparisons, course generation, navigation, and settings so migration covers the complete teaching flow.

Deliver a field-by-field data map and a behavior checklist tied to existing tests. Keep this scope as the project reference.

Acceptance: baseline failures are identified separately from new failures, the migration fixtures cover both Tutor languages and all three practice languages, and implementation file ownership is clear. Depends on no other phase.

### P1 Design the TypeScript course and approve a sample

Use `TYPESCRIPT_COURSE_BRIEF.md` with Astra to produce the complete outline, concept map, proposed manifest, and two representative modules. Include an early module suitable for a programming beginner and a later module involving narrowing or async behavior. Include sample project checkpoints and known wrong solutions.

Review beginner prerequisites, pacing, quiz ambiguity, feedback, and task independence. Map reusable drills by their actual IDs. Validate the sample against the existing compiler and runner before choosing the final course schema. Freeze schema version 1 after review.

Acceptance: every outcome has an assessment, samples have no undeclared prerequisites, reference answers pass, known wrong answers fail for the intended reasons, and the schema can express both samples and project checkpoints. Depends on P0. Full course authoring starts after this gate.

### P2 Implement course loading and shared execution

Add the manifest loader, compatibility checks, bundled source resolution, enrollment, and course exercise adapter. Reuse the language registry and process runner. Add only the new lesson views and navigation state required for the sample. Retain independent direct-practice state. Integrate both sample modules.

Acceptance: a user with no repo and no AI can read a sample, answer a question, edit an exercise, see mapped results, restart the app, and resume correctly. Invalid packs produce an actionable error without breaking practice. Depends on P1.

### P3 Complete and verify the TypeScript course

Author the remaining modules in reviewed batches using the approved format. Include JavaScript runtime basics for new programmers, TypeScript's type system, debugging, testing, modules, async behavior, and practical composition. Advanced type techniques are optional extension material. Implement the bounded project workspace as the project samples require.

Run all examples and exercise checks, validate links and IDs, inspect wrong-answer coverage, and review explanations separately from code. Preserve deliberate compile-error examples with explicit expected diagnostics. Supply static hints and explanations for users without AI.

Acceptance: the complete course is usable without generating missing lessons, every promised outcome has runnable evidence, and the final unfamiliar task combines concepts without prescribing a solution. Depends on P2. Content batches may proceed independently once the schema is stable.

### P4 Integrate setup and the learning interface

Add Course, Practice, and Review navigation, optional course activation beside language setup, a course list, resume, and per-course progress. Move Tutor's teaching interactions into the course views and connect them to Practice Range's AI provider settings. Keep explanation depth, familiar-language context, and course questions available.

Preserve scratch, compare, progressive hints, solution reveal, Neovim and VS Code behavior, layout preferences, external `startTopic` launches, and optional sync. Course enrollment is separate from installing external compiler dependencies. Course navigation must not reset a drill or discard edits.

Acceptance: verify the whole course-to-practice-to-course flow in both editors, restart/resume, unavailable AI, disabled courses, and language switches. Existing C# and SQL direct practice remain usable. Depends on P2, with final acceptance after P3.

### P5 Add repo teaching

Move Tutor's pinned-repo reading, lesson chat, learner comparisons, and repo architecture teaching into Practice Range. Generate repo supplements against the fixed foundation curriculum. Tutor courses are not imported (D8).

Acceptance: missing repos fall back to bundled teaching, and saved repo lessons keep their excerpts. Depends on P4.

### P6 Connect review and learning recommendations

Reuse Practice Range's review scheduling for eligible course exercises. Preserve fresh review workspaces and assistance tracking. Define concept evidence from independent passes across varied tasks and later reviews. Distinguish skipped, read, practiced with help, and demonstrated independently. Incomplete evidence must not count as independent success.

Show a small next-action recommendation with its reason, such as repeated failed checks or a concept due for review. Let users continue or skip freely. Ship explicit scheduling rules rather than requiring an AI decision for every next step. Generated exercises are optional additional practice and must be validated and labeled.

Acceptance: deterministic fixtures cover hinted passes, revealed solutions, later independent passes, overdue review, changed course versions, and mixed drill/course sessions. No unnecessary attempt counts from duplicate save events. Depends on P4 and P5 data compatibility.

### P7 Validate learning and expand language courses

Pilot the full TypeScript course with learners new to programming and learners coming from another language. Ask them to solve a new task without hints, explain a type error, debug broken behavior, and return for delayed review. Record concrete confusion points and assistance, not just completion counts. Local pilot notes are sufficient. No analytics service is required.

Correct content and interface problems before multiplying the course. Build C# next, then SQL, with language-specific outcomes and projects. Reuse the course framework, not TypeScript's lesson sequence. SQL exercises keep the existing PostgreSQL engine and isolated data fixtures.

Acceptance: reviewed pilot tasks demonstrate the intended skills, known blocking confusion is resolved, and each additional course passes the same automated and editorial checks. Depends on P3 through P6. TypeScript may release before additional course packs are ready.

### P8 Release

Complete targeted regression checks, native panel checks, pack validation, version-update rehearsal, and documentation for changed setup behavior. Document tested platforms and requirements. Ship TypeScript first with existing C# and SQL practice intact. Add later course packs as they pass P7. Tutor is not changed.

Acceptance: users can install, learn without a repo/model, attach a repo, sync supported data, and update compatible content. The release checklist names any untested editor/platform combinations. Depends on P7 for TypeScript release.

## Release checks

| Code | Check |
| --- | --- |
| V1 | Validate manifests, stable IDs, prerequisites, concept mappings, references, file paths, and compatible compiler versions. Reject missing and cyclic prerequisites. |
| V2 | Run bundled examples and reference answers. Check starters, intended compile errors, known wrong answers, edge cases, and acceptable alternative solutions. |
| V3 | Verify save checking, stale runs, resets, workspace isolation, source mapping, bounded output/timeouts, scratch, and compare. |
| V4 | Verify restart/resume, independent navigation state, language switches, missing tools, and no-repo/no-model use. |
| V5 | Rehearse partial/corrupt data, old practice sessions, and version updates. |
| V6 | Verify optional sync includes portable course data and excludes local paths and generated build files. |
| V7 | Run relevant existing Practice Range tests, mod type checks, native panel checks, and whitespace checks. Add tests for new behavior rather than mirroring implementation details. |
| V8 | Review course explanations and observe learner transfer tasks. Automated tests establish code correctness, not teaching effectiveness. |

## Boundaries and risks

| Code | Risk | Handling |
| --- | --- | --- |
| R1 | Generated content compiles but teaches badly. | Review prerequisite order, explanations, wrong answers, and observed learner tasks before release. |
| R2 | A complete beginner is asked to use unexplained JavaScript. | Include a true programming foundation and a separate entry path for experienced developers. |
| R3 | Consolidation loses existing answers or features. | Preserve IDs and paths where possible, rehearse recovery, and check the feature inventory. |
| R4 | Course updates invalidate progress or orphan work. | Pin enrollments, retain required content, and migrate through explicit compatibility mappings. |
| R5 | Repo teaching produces gaps or becomes unavailable. | Keep the complete bundled curriculum and distinguish repo supplements from foundations. |
| R6 | Building all three courses delays validating the design. | Finish one vertical sample and one complete TypeScript course before expanding. |

Excluded: Tourist changes, remote course marketplace, community course upload, model training, a general IDE, arbitrary external dependencies in exercises, cloud execution, certificates, competitive scoring, and automatic edits to the learner's source repo. No unrelated kit refactor or cleanup is part of this project.

## Implementation order and Astra handoff

Critical path: P0, P1 sample, P2 working sample, P3 and P4 completion, P5, P6, P7 TypeScript pilot, then P8 TypeScript release. Additional language authoring follows the pilot gate. Estimate implementation effort after P1 and P2 expose content conversion and project workspace costs.

Next action: finish the remaining P3 to P6 items in the completion table, then run the P7 TypeScript learner pilot.
