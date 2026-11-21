# jump

tmux's `prefix+w` with vimium-style letters: press a key, type a letter, and you are on that tab.

![jump](preview.png?v=1ba145764264)

tmux's `prefix+w`, with vimium-style letters. Press `ctrl-shift-k`, type a letter, you're on that tab.

`j`/`k` move, `enter` goes, `x` closes the selected tab, `r` renames the selected tab or space, `t` new tab, `n` new space.
Want fixed letters for your spaces? Put them in `~/.config/herdr-app/hints.json`:

```json
{ "spaces": { "Logos": "l", "Component Library": "c" } }
```

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/jump
```

By hand: copy `mods/jump` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.

[`RECIPE.md`](RECIPE.md) has the full details, including what it runs on your machine.
