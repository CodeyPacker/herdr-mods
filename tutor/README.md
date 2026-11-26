# tutor

Learn a language from a codebase you pick: the agent plans a course from its real code, with lessons, quizzes and practice exercises.

Learn a language from a codebase you pick. Point Tutor at a git repo and the agent plans a 10 to 20 module course
from its real code, pinned to the current commit. Each module walks through 4 to 7 excerpts of the repo with an
explanation, then a 5-question quiz and up to three small practice exercises you write and run.
Modules are written the first time you open them.

Courses are moving to [Practice Range](../practice-range/). Open Practice Range, then **Courses → Import Tutor courses**, to copy a course with its progress and answers. Tutor keeps working, and the import never changes Tutor's files.

- **Languages:** C# and TypeScript (`l` on the setup screen).
- **What you know** (`w`): the languages you already know, for example `TypeScript, some SQL`. Lessons compare to the
  first one. Each course keeps its own list. If you list the course's own language, lessons skip the comparisons.
- **Editor** (`v`): Neovim opens files in a pane to the right, and VS Code opens them in its window. This is used
  for reading the repo (`o`) and for practice (`e`). Saving a practice file runs it.
- **Agent** (`a`): Claude or Codex. It only reads the repo and never changes it.
- **Practice Range** (`g`): when Practice Range is installed, a finished module opens it at the matching topic. Modules
  with no match, such as the repo's own architecture, show no key. Without Practice Range, Tutor works the same.

Needs git and the `claude` or `codex` CLI signed in. C# practice needs the .NET 10 SDK. TypeScript practice needs
Node.js 20 or newer and its pinned compiler (`npm ci` in `tutor/mods/tutor/lang/typescript`), or uses Practice Range's
copy if that is set up.
Copy or symlink `tutor/mods/tutor` into your Herdr `mods` folder.

Tests: `node --import ./tutor/tests/stubs/register.mjs --test tutor/tests/*.test.mjs`. To try the writing pipeline
on a real repo outside Herdr: `TUTOR_LANG=typescript node tutor/scripts/try-build.mjs <repo> <out> [module]`.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/tutor
```

By hand: copy `mods/tutor` (or symlink it) into `~/.config/herdr-app/mods/`.
