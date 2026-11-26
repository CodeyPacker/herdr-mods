# Practice Range learning release checklist

Status: not ready to release. The TypeScript course still needs the P7 learner pilot, and the C# course still needs its first learner, the owner. Everything below except learner observation can be rerun before release.

## Release scope

Ship the TypeScript course preview (content version 0.1.0-preview.2) the C# course preview and the SQL course preview (both content version 0.1.0-preview.1), with existing C#, TypeScript and SQL direct practice unchanged. Tutor is a separate mod and is not affected.

## Requirements

| Feature | Needs |
| --- | --- |
| Reading lessons, quizzes, readiness results, project list | Node.js 20 or newer. No compiler, repo or AI. |
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
| V1 | Course pack: manifest, IDs, prerequisites, concepts, file references, compiler version | `node practice-range/course-drafts/typescript/verify.mjs` | Passed. 64 course tasks (60 in lessons, 4 readiness checks) and 3 pilot tasks, 19 examples, 2 diagnostics, 85 references, 85 alternatives, 135 wrong-answer witnesses. |
| V1, V2 | C# course pack and every C# example, reference, starter and wrong answer | `node practice-range/scripts/verify-course.mjs csharp` (about 20 minutes) | Passed on Windows. 65 tasks (61 in lessons, 4 readiness checks), 24 examples, 11 diagnostics, 85 references, 85 alternatives, 134 wrong-answer witnesses. |
| V1, V2 | SQL course pack and every SQL example, reference, starter and wrong answer | `node practice-range/scripts/verify-course.mjs sql` (about 5 minutes) | Passed on Windows. 60 tasks (56 in lessons, 4 readiness checks), 40 examples, 12 expected errors, 72 references, 72 alternatives, 122 wrong-answer witnesses. |
| V1 | Rebuild is unchanged | `node practice-range/scripts/build-course.mjs` then `git status` | Passed. preview.1 is archived under `courses/packs/archive/`. Ship that archive. |
| V2 | Examples, references, starters, wrong answers | Same as the course verifier | Passed. |
| V3–V7 | All Practice Range tests, including editors, catalogs, sessions, courses, version updates, sync and AI flows | `env TMPDIR=/private/tmp node --test --test-concurrency=3 practice-range/tests/*.test.mjs` | macOS: passed 129 of 129, before the C# course. Windows, with the C# course: passed 128 of 131. Two Neovim editor tests failed and the 800-drill C# reference test hit its 10-minute limit. All 44 course and sync tests passed. |
| V5 | Version update rehearsal: real preview.1 enrollment to preview.2 | Included above in `tests/course-migration.test.mjs` | Passed. |
| V6 | Sync includes portable course data and excludes local paths and builds | Included above in `tests/sync.test.mjs` | Passed. |
| V7 | Native course panels | `node practice-range/tests/check-courses.mjs` | macOS: passed all 35. Windows: the six new C# fixtures and three existing ones passed. The other 32 were not rerun. A full run can stop on the SQL catalog load. Rerun the named fixture. |
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

- **Courses.** Practice Range has a TypeScript course preview with 18 modules, 60 lesson tasks, a five-step tracker project and four readiness checks. Lessons work without a repo or AI.
- **C# course.** A C# course preview with 18 modules, 61 lesson tasks, a five-step tracker project and four readiness checks. It teaches C# on its own terms and needs a .NET SDK 8 or newer for coding checks.
- **SQL course.** A SQL course preview with 18 modules, 56 lesson tasks, a five-step sales report project and four readiness checks. It runs on the practice database and needs the pinned PGlite engine for checks.
- **Setup.** Setup and every language card offer that language's course. Reading works before the compiler is installed.
- **Updates.** A newer compatible course version is offered from the module list. Progress moves only when you choose Update. The earlier version stays available.
- **Optional AI.** With AI help on, lessons can add checked extra practice, repo examples and architecture reading.
- **Unchanged.** C#, TypeScript and SQL direct practice, review, scratch, compare, editors and sync work as before.
