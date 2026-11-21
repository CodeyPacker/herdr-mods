# Portal

Every local TCP listener and UDP socket, grouped by the process that owns it. Favorite ports, open them in the browser, and end the process holding one.

![Portal](preview.png?v=a8cf8c175af2)

Open it with `ctrl-shift-u`. `j`/`k` move, `space` expands a process, `enter` opens a port in the browser, `f` favorites it, `n` adds a favorite by number, `e` sets a port's URL, `x` ends a process (it asks first), `c` copies. `t`/`u`/`m`/`a` toggle filters, `/` and `p` type a filter, `s` sorts, `r` refreshes. macOS and Windows.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/portal
```

By hand: copy `mods/portal` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.

[`RECIPE.md`](RECIPE.md) has the full details, including what it runs on your machine.
