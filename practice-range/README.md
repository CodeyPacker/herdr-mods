# Practice Range

C#, TypeScript and SQL repetition in its own tab: 800 short exercises per language, checked when you save, with Neovim or VS Code as your editor.

C#, TypeScript, and SQL repetition in its own tab, with an automatic 50/50 Neovim split or VS Code as your editor.
Choose a language and topic, write a short exercise, save, and check it. Each language has 800 exercises across
20 topics, from variables and loops to generics, async, and advanced patterns or mapped and conditional types.
SQL runs on real PostgreSQL, from SELECT and joins to window functions, recursive CTEs, JSON, and MERGE.
Each hint adds a little more help. Another exercise stays in the same topic until you choose to switch.

Courses are available from **Courses** in the header. The bundled TypeScript preview has 18 modules and 56 tasks, including runnable examples and a two-file final project. Lessons need no repo or AI connection. Coding checks use the language pack’s compiler. Reading position, answers, hints, and review progress are saved separately from direct practice. Course updates preserve older enrollments and their content.

Each module in the module list shows how far you've gone, from Read and Practiced with help to Shown independently. Shown independently means you passed two different exercises or linked practice drills without hints or the solution, or passed one and later passed it again in a clean review. Reading, skipping and passes with help never count. When linked practice drills are due, the suggested next step opens Practice topics, where **Review** includes them.

With AI help enabled, a lesson's **Write extra practice** adds up to six short AI-written exercises to that lesson. Each one is saved only after its reference answer passes and its starter and known wrong answers fail. Extra practice is labeled, syncs with your progress, and does not count toward module status or course review. The shipped course is never changed.

Setup also offers **Browse courses**, and the TypeScript language card offers **Start or resume course**. Reading is available before installing a compiler or choosing an editor. Coding checks still require the compiler. Back returns to the setup or language screen you came from.

In the course catalog or module list, save the languages you already know to give AI questions familiar-language context. Leave the list empty if you are new to programming. These preferences sync between devices and do not change course progress. Imported Tutor comparisons remain available until you save your own preferences.

You can optionally attach a local repo from the course’s module list. When AI help is enabled, **Explain repo architecture** creates supplemental reading from a bounded sample. From a lesson, **Explain this topic using my repo** adds examples for that module. Generation sends those source excerpts to your configured model. File paths and line ranges are checked against the pinned commit, but explanations still need your judgment. Saved lessons retain their source excerpts and travel with device sync, even if the repo later becomes unavailable. The repo is never edited, and its local path does not sync. C# and SQL course packs are still in development. Their existing direct practice remains available.

Use **Read source file** beside a repo excerpt to browse the pinned file inside Courses. Referenced lines are marked, and you can page through surrounding code. This reads committed content and leaves local edits alone. If the repo or commit is unavailable, the reader shows the saved excerpt when one exists. Files larger than 256 KB and binary files use the same fallback.

```sh
herdr-app do tab.new '{"name":"Practice Range","mod":"practice-range","props":{"practiceTab":true}}'
```

Needs Node.js 20 or newer, plus a .NET SDK 8 or newer for C#, or the pack's pinned TypeScript compiler
(`npm ci` in `languages/typescript`) for TypeScript, or the pack's pinned PGlite (`npm ci` in `languages/sql`) for SQL.
PGlite is PostgreSQL compiled to WebAssembly, so there's no database server to install. The Languages screen runs that `npm ci` for you when you choose Install. Setup and controls are explained in the app.

Copy or symlink `practice-range/mods/practice-range` into your Herdr `mods` folder. Setup checks this computer for you and shows one card each for languages, your editor, the layout (panel side, width, and a compact mode), and the optional AI tutor.

Every check shows what your code produced: what it printed, the value a failed check got, or for SQL the rows your query returned.

- **Scratch** (`x`): a free-form file per language. Save it to run it. Nothing is checked, and runs don't count toward progress. `x` or `esc` returns to your exercise.
- **Send to scratch** (`s`): copies your current answer into scratch, with any tables or types the exercise supplies, and runs it, so you can experiment without touching your saved attempt.
- **Compare** (`d` after a pass): opens your answer beside the read-only reference in your editor's diff view (a new Neovim tab that closes when you move to another file, or VS Code's diff editor). If they differ only in formatting or comments, the panel says so instead.
- **Review** (`v` on the Topics screen): optional. Up to eight exercises from topics you've practiced, weakest and longest unseen first, no more than three per topic, each from a blank file. Your saved answers stay untouched. A clean first try waits longer before coming back; one you needed help with returns sooner. The Topics screen shows how many are ready.

## Importing Tutor courses

Open **Courses → Import Tutor courses**, choose a course, and review **Preview import** before copying. Practice Range looks for Tutor next to its own data folder. Enter Tutor's data folder when it lives elsewhere.

The import preserves the original module order, parts, explanations, quizzes, read positions, historical scores, and saved C# or TypeScript answers. Unwritten modules stay Planned. Answers without a matching exercise are copied into imported history. Tutor's original files are never changed.

Earlier practice results remain historical evidence. An imported answer does not earn independent credit until you use **Start fresh** and solve it again. Optional editor and AI preferences fill only missing settings. Existing choices and credentials are not replaced.

Reimporting unchanged content reopens the existing copy without overwriting newer work. Revised lessons get a separate enrollment, and the earlier version stays available. If a repo was missing, attach a local clone from the imported course's module list to restore its pinned excerpts. With device sync enabled, imported course content and progress travel together. Local repo paths and incomplete import staging stay on this computer.

Planned imported modules can be written from the module list with **Write lesson and quiz** when AI help is enabled and a clone containing the course's pinned commit is attached. This writes reading and a quiz only, never coding exercises. Source references are checked against the pinned commit. The result is saved as a new course version that carries your progress and answers. The original version stays available. Repeating the request for the same module reopens the saved version.

Imported modules with reading but no exercises offer **Write practice exercises**. Each generated exercise is a small program checked by its printed output. Before anything is saved, the reference answer must pass, and the starter and each known wrong answer must fail, using the language's own compiler. Exercises that fail this are discarded. Saved exercises are labeled as AI-generated and also go into a new course version.

## Updating an existing install

1. Pull the latest `main`, or apply the patch.
2. If the installed mod is a copy rather than a symlink, copy `practice-range/mods/practice-range` over it again.
3. For SQL, install its engine once: `npm ci --prefix ~/.config/herdr-app/mods/practice-range/languages/sql`. TypeScript's `npm ci` is only needed again if its `package.json` changed.
4. Run `herdr-app check ~/.config/herdr-app/mods/practice-range`, then reopen the Practice Range tab.
5. To add SQL, open Languages and choose it. Your C# and TypeScript progress, answers, and editor settings carry over.

Another mod can open Practice Range at a topic by adding `"startTopic": { "languageId": "csharp", "topicId": "linq" }`
to the tab's props. Tutor does this. `node practice-range/mods/practice-range/topics.mjs` prints every language and topic as JSON.

## Sync between computers (optional)

Off by default. When on, Practice Range pulls your progress from a git repo as it opens, pushes it a few seconds
after each check, and pushes again as it closes. A failed push shows in the panel and is retried by the next push.
Only each language's progress, answers and backups are committed. Checker builds and per-computer setup stay local.

1. Create an empty private repo, for example on GitHub.
2. On the computer that has your progress:
   ```sh
   cd ~/.config/herdr-app/data/practice-range
   git init -b main && git remote add origin <your repo URL>
   ```
3. On each other computer, move any old `data/practice-range` folder aside, then clone the repo into its place:
   `git clone <your repo URL> ~/.config/herdr-app/data/practice-range`
4. On every computer, add `"sync": true` to `~/.config/herdr-app/practice-range.json`.

Practice on one computer at a time. If both change before syncing, the pull shows git's error in the panel and
practice keeps working locally until you resolve it in that folder.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/practice-range
```

By hand: copy `mods/practice-range` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.
