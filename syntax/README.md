# Practice Range

C#, TypeScript and SQL repetition in its own tab: 800 short exercises per language, checked when you save, with Neovim or VS Code as your editor.

C#, TypeScript, and SQL repetition in its own tab, with an automatic 50/50 Neovim split or VS Code as your editor.
Choose a language and topic, write a short exercise, save, and check it. Each language has 800 exercises across
20 topics, from variables and loops to generics, async, and advanced patterns or mapped and conditional types.
SQL runs on real PostgreSQL, from SELECT and joins to window functions, recursive CTEs, JSON, and MERGE.
Each hint adds a little more help. Another exercise stays in the same topic until you choose to switch.

```sh
herdr-app do tab.new '{"name":"Practice Range","mod":"syntax","props":{"practiceTab":true}}'
```

Needs Node.js 20 or newer, plus a .NET SDK 8 or newer for C#, or the pack's pinned TypeScript compiler
(`npm ci` in `languages/typescript`) for TypeScript, or the pack's pinned PGlite (`npm ci` in `languages/sql`) for SQL.
PGlite is PostgreSQL compiled to WebAssembly, so there's no database server to install. Setup and controls are explained in the app.

Copy or symlink `syntax/mods/syntax` into your Herdr `mods` folder. The setup screen guides you through language requirements, your editor, and the optional AI tutor.

Every check shows what your code produced: what it printed, the value a failed check got, or for SQL the rows your query returned.

- **Scratch** (`x`): a free-form file per language. Save it to run it. Nothing is checked, and runs don't count toward progress. `x` or `esc` returns to your exercise.
- **Send to scratch** (`s`): copies your current answer into scratch, with any tables or types the exercise supplies, and runs it, so you can experiment without touching your saved attempt.
- **Compare** (`d` after a pass): opens your answer beside the read-only reference in your editor's diff view (a new Neovim tab that closes when you move to another file, or VS Code's diff editor). If they differ only in formatting or comments, the panel says so instead.
- **Review** (`v` on the Topics screen): optional. Up to eight exercises from topics you've practiced, weakest and longest unseen first, no more than three per topic, each from a blank file. Your saved answers stay untouched. A clean first try waits longer before coming back; one you needed help with returns sooner. The Topics screen shows how many are ready.

## Updating an existing install

1. Pull the latest `main`, or apply the patch.
2. If the installed mod is a copy rather than a symlink, copy `syntax/mods/syntax` over it again.
3. For SQL, install its engine once: `npm ci --prefix ~/.config/herdr-app/mods/syntax/languages/sql`. TypeScript's `npm ci` is only needed again if its `package.json` changed.
4. Run `herdr-app check ~/.config/herdr-app/mods/syntax`, then reopen the Practice Range tab.
5. To add SQL, open Languages and choose it. Your C# and TypeScript progress, answers, and editor settings carry over.

Another mod can open Practice Range at a topic by adding `"startTopic": { "languageId": "csharp", "topicId": "linq" }`
to the tab's props. Tutor does this. `node syntax/mods/syntax/topics.mjs` prints every language and topic as JSON.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/syntax
```

By hand: copy `mods/syntax` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.
