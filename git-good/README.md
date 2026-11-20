# Git Good

A dialog for everyday git work: the changed files with their diff beside them, staging by file or by hunk, commits with a message Claude can write, pull, push, stash and branches.

Open it with `ctrl-a g`. The changed files are on the left in two lists, staged and not staged, with tests, `package.json`, generated files and lock files sorted to the bottom. The selected file's diff is on the right, with syntax colors, in one column or two.

`j`/`k` move through the files or scroll the diff (`ctrl-h` and `ctrl-l` choose which). `space` stages or unstages a file, `a` stages all, `u` unstages all, `d` discards (it asks first). Click a hunk's heading to stage only that hunk. `c` writes a commit message, `g` has Claude write one from the staged changes, `ctrl-enter` commits, `m` amends. `b` opens the branches, `l` pulls (fast-forward only), `p` pushes (never forced), `s` stashes, `o` pops. `v` switches the diff view, `f` fills the window, `?` shows the key list.

The gear (or `,`) opens the settings: open in full screen, hide the key hints, and switch any shortcut off or move it to another key.

With [tourist](../tourist/) installed, `t` closes Git Good and opens a tour of everything on the current branch.

Generating a message needs the `claude` CLI signed in.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/git-good
```

By hand: copy `mods/git-good` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.
