---
name: update-herdr-mods
description: Update Herdr mods and layouts installed from github.com/CodeyPacker/herdr-mods (tourist, islands, jump, run, zen, portal and any added later). Lists what's installed, shows which have updates, and lets the user pick one, several or all. Use when the user asks to update, upgrade or pull the latest herdr mods, layouts, or any mod from that repo by name.
---

# Update Herdr mods

Update the mods and layouts that came from https://github.com/CodeyPacker/herdr-mods to what's on `main`. Herdr's home is `~/.config/herdr-app` unless `HERDR_APP_HOME` is set. On Windows, use the PowerShell equivalents of the commands below.

## 1. Read Herdr's rules

Read `<herdr home>/AGENTS.md` before changing anything.

## 2. Get the latest main

Shallow-clone into a new temp folder: `git clone --depth 1 https://github.com/CodeyPacker/herdr-mods <tmp>`.

## 3. Find what's installed

The repo is grouped into packages. A package is a top-level folder holding `mods/<mod>/mod.json` and maybe `layouts/<name>.json` and `keys.json`. For example, `islands` is six mods plus the `islands` layout, and `tourist` is one mod.

For each package, find what's installed:
- Mods: `<herdr home>/mods/<mod>`.
- Layouts: `<herdr home>/layouts/<name>.json`, plus any `.svg` preview next to it.

Skip packages with nothing installed. For each installed mod, note how it's installed:
- **Linked:** a symlink into a git clone of herdr-mods. Note the clone's path.
- **Copied:** a plain folder.

Compare each installed item with the temp clone (`diff -rq` for folders, `diff` for files) and mark it **up to date** or **update available**. For a linked mod, compare the clone's checkout with `origin/main` after `git fetch`. Ignore `settings.json` in this comparison (see step 5).

## 4. Let the user pick

Show one row per package with its installed mods and layouts and its status. If nothing has updates, say so and stop.

Ask which to update. With four or fewer packages that have updates, use AskUserQuestion with `multiSelect: true`, one option per package. Otherwise list them numbered and ask the user to reply with numbers or "all". Offer "all" either way.

## 5. Update each picked package

- **Linked mods:** run `git pull` in the clone. If the clone has uncommitted changes or isn't on `main`, stop and show the user before pulling. One pull covers every linked mod in that clone.
- **Copied mods:**
  1. Back the folder up to `<herdr home>/backups/<mod>-<YYYYMMDD-HHMMSS>`.
  2. Replace its contents with the temp clone's `<package>/mods/<mod>`, deleting files that no longer exist upstream.
  3. Keep the user's `settings.json` if the mod folder had one. It holds their own tuning.
- **Layouts:** Herdr rewrites a layout file when the user resizes or tweaks it, so the installed copy often differs for harmless reasons. Show the diff and ask before overwriting. Back up the old file to `<herdr home>/backups/` first.
- **Keys:** never overwrite `<herdr home>/keys.json`. If the package's `keys.json` binds a command the user has no binding for, offer to add it, and leave existing bindings as they are.
- **Never touch** `<herdr home>/data/`. It holds the mods' saved state, for example Tourist's saved tours and comments.

## 6. Check and report

Run `herdr-app check <herdr home>/mods/<mod>` for every updated mod. Report the results with any failures first, then:
- What was updated, and where each backup went.
- What was skipped and why.
- Open panes of an updated mod keep running the old code until they're closed and reopened. A layout change shows the next time that layout is applied.
- Tourist also needs `gh` and the `claude` or `codex` CLI signed in. If Tourist was updated, check `gh auth status` and `command -v claude codex`, and say if either is missing.

Delete the temp clone.
