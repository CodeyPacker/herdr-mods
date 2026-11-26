# Practice Range learning release checklist

Status: not ready to release. The TypeScript course still needs the P7 learner pilot. Everything below except learner observation can be rerun before release.

## Release scope

Ship the TypeScript course preview (content version 0.1.0-preview.2) with existing C#, TypeScript and SQL direct practice unchanged. C# and SQL course packs are not part of this release. Tutor stays installed, launchable and unchanged except for its move notice. No Tutor data or source mod is removed.

## Requirements

| Feature | Needs |
| --- | --- |
| Reading lessons, quizzes, readiness results, project list | Node.js 20 or newer. No compiler, repo or AI. |
| TypeScript course and practice checks | The pack's pinned TypeScript 6.0.3 (`npm ci` in `languages/typescript`, or Install on the Languages screen). |
| C# practice and imported C# Tutor courses | .NET SDK 8 or newer for practice. Imported Tutor C# courses need .NET 10. |
| SQL practice | The pack's pinned PGlite (`npm ci` in `languages/sql`). |
| AI questions, repo lessons, generated modules and exercises | The `claude` or `codex` CLI, signed in, with AI help turned on in Setup. |
| Repo examples and Tutor repo excerpts | git and a local clone containing the pinned commit. |
| Device sync | git and a private remote repo. |

## Tested platform

| Item | Version |
| --- | --- |
| OS | macOS 26.6.2 (Darwin 25.6.0) |
| Node.js | 25.2.1 |
| TypeScript | 6.0.3, pack-local |
| .NET SDK | 10.0.301 |
| Editors | Neovim 0.12.6 and VS Code, through the editor tests below |

Not tested: Windows, Linux, Node.js 20 to 24 (the Homebrew `node@20` and `node@22` links on the test machine point to Node 25, so no older runtime was available without a download), .NET 8 or 9, and a live Claude or Codex request. Provider behavior is tested with controlled responses. Neither editor has been used by a learner through a whole course.

## Checks

Run from the repository root. The results column is the last recorded run.

| Code | Check | Command | Last result |
| --- | --- | --- | --- |
| V1 | Course pack: manifest, IDs, prerequisites, concepts, file references, compiler version | `node practice-range/course-drafts/typescript/verify.mjs` | Passed. 64 course tasks (60 in lessons, 4 readiness checks) and 3 pilot tasks, 19 examples, 2 diagnostics, 85 references, 85 alternatives, 135 wrong-answer witnesses. |
| V1 | Rebuild is unchanged | `node practice-range/scripts/build-course.mjs` then `git status` | Passed. preview.1 is archived under `courses/packs/archive/`. Ship that archive. |
| V2 | Examples, references, starters, wrong answers | Same as the course verifier | Passed. |
| V3–V7 | All Practice Range tests, including editors, catalogs, sessions, courses, import, migration, sync and AI flows | `env TMPDIR=/private/tmp node --test --test-concurrency=3 practice-range/tests/*.test.mjs` | Passed 150 of 150. |
| V5 | Tutor import rehearsal: partial and damaged courses, repeated and interrupted imports, untouched originals | Included above in `tests/course-import.test.mjs` | Passed with fixtures. No real Tutor data existed on the test machine. |
| V5 | Version update rehearsal: real preview.1 enrollment to preview.2 | Included above in `tests/course-migration.test.mjs` | Passed. |
| V6 | Sync includes portable course data and excludes local paths and builds | Included above in `tests/sync.test.mjs` | Passed. |
| V7 | Native course panels | `node practice-range/tests/check-courses.mjs` | Passed all 53. A full run can stop on the SQL catalog load. Rerun the named fixture. |
| V7 | Native practice panels | `node practice-range/tests/check-panels.mjs` | Passed all 47. |
| V7 | Herdr mod checks | `herdr-app check practice-range/mods/practice-range` and `herdr-app check tutor/mods/tutor` | Both passed. |
| V7 | Type and whitespace checks | `node practice-range/mods/practice-range/languages/typescript/node_modules/typescript/bin/tsc -p practice-range/mods/practice-range/tsconfig.json --pretty false` and `git diff --check` | Passed. |
| V7 | Tutor baseline | `node --import ./tutor/tests/stubs/register.mjs --test tutor/tests/*.test.mjs` | 14 of 18, unchanged. The four TypeScript runner tests need Tutor's own compiler install. |
| V8 | Learner observation | Run `course-drafts/typescript/pilot/PILOT.md` and record notes | Kit ready. Not run. Blocks release. |

Native checks verify that panels build and selected navigation works. They do not verify layout, paint or a real learner session.

## Before release

1. Finish the P7 TypeScript pilot using `course-drafts/typescript/pilot/PILOT.md` and fix the blocking confusion it finds.
2. Rerun every check above and update the results column.
3. If course content changed, bump `runtimeContentVersion`, declare `compatibility.fromVersions` and any ID replacements, rebuild, and ship the new archive file.
4. Repeat an import on a copy of real Tutor data if a tester has some. Confirm the original folder is byte-identical afterward.

## Tutor transition

| Step | When | State |
| --- | --- | --- |
| Tutor's setup and course screens say courses can move to Practice Range through Courses, then Import Tutor courses. | Now | Done. Tutor keeps working. |
| Tutor's page and the repository list say Practice Range can import Tutor courses. | Now | Done. |
| Stop recommending new Tutor installs. Point the repository list's Tutor entry to Practice Range. | At release, after the pilot | Not done. |
| Keep Tutor launchable, keep its data, and keep its source mod. | Initial release | Required. |
| Remove Tutor's launch path or source mod. | A later, separate release | Out of scope. |

Practice Range teaches a fixed foundation course and adds repo examples and architecture lessons. It does not plan a new course from an arbitrary repo the way Tutor does. This is the scope's intent (D4), and release notes should say it plainly.

## Release notes draft

- **Courses.** Practice Range has a TypeScript course preview with 18 modules, 60 lesson tasks, a five-step tracker project and four readiness checks. Lessons work without a repo or AI.
- **Setup.** Setup and the TypeScript language card offer the course. Reading works before the compiler is installed.
- **Importing Tutor.** Courses, then Import Tutor courses, previews and copies a Tutor course with its progress and answers. Tutor's files are not changed, and Tutor keeps working.
- **Updates.** A newer compatible course version is offered from the module list. Progress moves only when you choose Update. The earlier version stays available.
- **Optional AI.** With AI help on, lessons can add checked extra practice, repo examples and architecture reading. Imported Tutor courses can write unfinished modules and their exercises.
- **Unchanged.** C#, TypeScript and SQL direct practice, review, scratch, compare, editors and sync work as before.
