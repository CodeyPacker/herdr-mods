# keybinds

A dialog that lists every key in your `keys.json`, grouped by what the keys act on, with a filter you type into.

Open it with `ctrl-a ?`. The rows come from `~/.config/herdr-app/keys.json`, so a key bound with named arguments shows them. Type to narrow the list. `up`/`down` or `ctrl-j`/`ctrl-k` move, `esc` clears the filter, then closes.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/keybinds
```

By hand: copy `mods/keybinds` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.
