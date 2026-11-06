# herdr-mods

Mods for the [Herdr](https://herdr.dev) desktop app. Each folder is one mod,
installable on its own.

| Mod | What it does |
| --- | --- |
| [jump](jump/) | tmux's prefix+w with vimium-style letters. Type a letter, land on that space or tab. |
| [procs](procs/) | mprocs for herdr. Declare your dev processes in `herdr.procs.json`, start/stop/restart/peek from one popup. |
| [leader](leader/) | A tmux-style prefix key. `ctrl-a` then one more key runs whatever you mapped. |

## Install

Copy (or junction/symlink) a mod folder into `~/.config/herdr-app/mods/`, then
check it loads:

```sh
herdr-app check ~/.config/herdr-app/mods/jump
```

Each mod's `keys.json` shows the binding it expects; merge it into your own
`~/.config/herdr-app/keys.json`. The RECIPE.md in each folder is the full
description, including what the mod runs on your machine.

## Config files

- `~/.config/herdr-app/hints.json`: your own hint letters for spaces and tabs (jump, procs).
- `~/.config/herdr-app/leader.json`: the leader's key mappings. `leader/leader.example.json` is a starting point.
- `herdr.procs.json` at a repo root: the processes procs manages for that repo.

## Hacking

Mods hot reload on save. `jump/tiles.js` and `procs/tiles.js` are the same
file; edit the one in `procs/` and copy it over. The app drops a `jsconfig.json`
and `gpui-kit.d.ts` into each folder for editor completions; those are
gitignored. Type-check with:

```sh
npx -p typescript tsc -p procs/jsconfig.json
```
