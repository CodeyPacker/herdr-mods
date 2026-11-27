# Practice Range learning release checklist

Status: not ready to release. The TypeScript course still needs the P7 learner pilot, and the C# course still needs its first learner, the owner. Everything below except learner observation can be rerun before release.

## Release scope

Ship the TypeScript course preview (content version 0.2.0-preview.1), the C# course preview (0.2.0-preview.2) and the SQL course preview (0.2.0-preview.1), with existing C#, TypeScript and SQL direct practice unchanged. Tutor is a separate mod and is not affected.

## Requirements

| Feature | Needs |
| --- | --- |
| Reading lessons, quizzes, readiness results, and the whole of each reading course (API design, Docker, CI/CD, Networking, System design, Databases, Security) | Node.js 20 or newer. No compiler, repo or AI. |
| TypeScript course and practice checks | The pack's pinned TypeScript 6.0.3 (`npm ci` in `languages/typescript`, or Install on the Languages screen). |
| C# course and practice checks | .NET SDK 8 or newer. |
| SQL course and practice checks | The pack's pinned PGlite (`npm ci` in `languages/sql`). |
| AI questions, repo lessons, generated modules and exercises | The `claude` or `codex` CLI, signed in, with AI help turned on in Setup. |
| Repo examples and architecture lessons | git and a local clone containing the pinned commit. |
| Device sync | git and a private remote repo. |

## Tested platform

| Item | Version |
| --- | --- |
| OS | macOS 26.6.2 (Darwin 25.6.0) |
| Node.js | 25.2.1 |
| TypeScript | 6.0.3, pack-local |
| .NET SDK | 10.0.301 |
| Editors | Neovim 0.12.6 and VS Code, through the editor tests below |

The C# course was written and verified on a second machine: Windows 11, Node.js 26.13.0 and .NET SDK 10.0.404. The TypeScript results below are from the macOS machine.

Not tested: Linux, the TypeScript course on Windows, the C# course on macOS, Node.js 20 to 24 (the Homebrew `node@20` and `node@22` links on the test machine point to Node 25, so no older runtime was available without a download), .NET 8 or 9, and a live Claude or Codex request. Provider behavior is tested with controlled responses. Neither editor has been used by a learner through a whole course.

## Checks

Run from the repository root. The results column is the last recorded run.

| Code | Check | Command | Last result |
| --- | --- | --- | --- |
| V1, V2 | TypeScript course pack and every TypeScript example, reference, starter and wrong answer | `node practice-range/scripts/verify-course.mjs typescript` (about 20 minutes) | Passed on macOS, 2026-11-27. 63 course tasks (59 in lessons, 4 readiness checks) and 3 pilot tasks, 32 examples, 3 diagnostics, 84 references, 84 alternatives, 132 wrong-answer witnesses. |
| V1, V2 | C# course pack and every C# example, reference, starter and wrong answer | `node practice-range/scripts/verify-course.mjs csharp` (about 5 minutes on macOS) | Passed on macOS with .NET SDK 10.0.301, 2026-11-27. 57 tasks (53 in lessons, 4 readiness checks), 22 examples, 11 diagnostics, 77 references, 77 alternatives, 116 wrong-answer witnesses. |
| V1, V2 | SQL course pack and every SQL example, reference, starter and wrong answer | `node practice-range/scripts/verify-course.mjs sql` (about 5 minutes) | Passed on macOS, 2026-11-27. 52 tasks (48 in lessons, 4 readiness checks), 38 examples, 12 expected errors, 61 references, 61 alternatives, 104 wrong-answer witnesses. |
| V1 | Rebuild is unchanged | `node practice-range/scripts/build-course.mjs` then `git status` | Passed. Earlier versions are archived under `courses/packs/archive/`. Ship those archives. |
| V2 | Examples, references, starters, wrong answers | Same as the course verifier | Passed. |
| V3–V7 | All Practice Range tests, including editors, catalogs, sessions, courses, version updates, sync and AI flows | `env TMPDIR=/private/tmp node --test --test-concurrency=3 practice-range/tests/*.test.mjs` | macOS, 2026-11-27, after the course redesign: passed 141 of 141. |
| V5 | Version update rehearsal: real preview.1 enrollment to preview.2 | Included above in `tests/course-migration.test.mjs` | Passed. |
| V6 | Sync includes portable course data and excludes local paths and builds | Included above in `tests/sync.test.mjs` | Passed. |
| V7 | Native course panels | `node practice-range/tests/check-courses.mjs` | macOS, 2026-11-27: all 49 passed. A full run can stop with "interrupted" while loading the SQL catalog. Rerun the fixtures it did not reach by name. |
| V7 | Native practice panels | `node practice-range/tests/check-panels.mjs` | Passed all 47. |
| V7 | Herdr mod checks | `herdr-app check practice-range/mods/practice-range` | Passed. |
| V7 | Type and whitespace checks | `node practice-range/mods/practice-range/languages/typescript/node_modules/typescript/bin/tsc -p practice-range/mods/practice-range/tsconfig.json --pretty false` and `git diff --check` | Passed. |
| V8 | Learner observation | Run `course-drafts/typescript/pilot/PILOT.md` and record notes | Kit ready. Not run. Blocks release. |

Native checks verify that panels build and selected navigation works. They do not verify layout, paint or a real learner session.

## Before release

1. The owner takes the C# course on the experienced path and records what was unclear.
1. Finish the P7 TypeScript pilot using `course-drafts/typescript/pilot/PILOT.md` and fix the blocking confusion it finds.
2. Rerun every check above and update the results column.
3. If course content changed, bump `runtimeContentVersion`, declare `compatibility.fromVersions` and any ID replacements, rebuild, and ship the new archive file.

## Tutor

Tutor stays a separate mod and is unchanged. Practice Range does not import Tutor courses. Practice Range teaches a fixed foundation course and adds repo examples and architecture lessons. It does not plan a new course from an arbitrary repo the way Tutor does.

## Release notes draft

- **Courses.** Courses teach one concept at a time, with no project theme. The header has two tabs, Practice and Courses. A course page has one Up next box and a numbered module list. Lessons are Markdown with coloured code, shown one step at a time beside a step list. Course settings hold known languages, the attached repo and older versions.
- **TypeScript course.** A preview with 18 modules, 59 lesson tasks and four skip-ahead tests, including unions, utility types, and mapped and conditional types.
- **C# course.** A preview with 16 modules, 53 lesson tasks and four skip-ahead tests. It teaches C# on its own terms and needs a .NET SDK 8 or newer for coding checks.
- **SQL course.** A preview with 16 modules, 48 lesson tasks and four skip-ahead tests. It runs on the practice database and needs the pinned PGlite engine for checks.
- **API design course.** A reading course preview with 15 modules on designing APIs: resources, methods, status codes, bodies, errors, lists, safe writes, versioning, access, limits, slow work, styles and review. It has diagrams, questions and design exercises, no code to write, and needs no compiler, repo or AI.
- **Docker, CI/CD, Networking, System design, Databases and Security courses.** Six more reading course previews, with 16, 16, 15, 16, 15 and 15 modules. The Security course marks its advice as general guidance and has not been reviewed by a security specialist. Each module has explanations, plain-text diagrams, two questions, and an exercise on paper with one possible answer. No command, workflow or SQL statement in them is run by the app, and none was run while writing them.
- **Data structures and algorithms course.** A second TypeScript course preview with 14 modules, 42 lesson tasks and three skip-ahead tests. Where speed is the point of a task, a check counts array reads or comparisons, so a correct but slow answer fails. It uses the TypeScript pack's pinned compiler.
- **Setup.** Setup and every language card offer that language's course, as a Course button beside Practice. Reading works before the compiler is installed.
- **Updates.** A newer compatible course version is offered on its catalog card. Progress moves only when you choose Update. The earlier version stays available.
- **Optional AI.** With AI help on, lessons can add checked extra practice, repo examples and architecture reading.
- **Unchanged.** C#, TypeScript and SQL direct practice, review, scratch, compare, editors and sync work as before.
