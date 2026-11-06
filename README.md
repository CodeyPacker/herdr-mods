# herdr-mods

A few mods for the [Herdr](https://herdr.dev) desktop app. Grab the ones you want.

## jump

tmux's `prefix+w`, with vimium-style letters. Press `ctrl-shift-k`, type a letter, you're on that tab.

![jump](jump/preview.png)

`j`/`k` move, `enter` goes, `x` closes the selected tab, `r` renames the selected tab or space, `t` new tab, `n` new space.
Want fixed letters for your spaces? Put them in `~/.config/herdr-app/hints.json`:

```json
{ "spaces": { "Logos": "l", "Component Library": "c" } }
```

## run

mprocs, but inside Herdr. Drop a `herdr.procs.json` in your repo:

```json
{
  "procs": [
    { "name": "web", "cmd": "npm run dev", "cwd": "apps/web" },
    { "name": "api", "cmd": "dotnet run --project services/api", "env": { "PORT": "5000" } }
  ]
}
```

Press `ctrl-shift-r`, hit `u`, everything starts in the background. Each row has a letter.

![run](run/preview.png)

`s` start, `x` stop, `r` restart, `enter` to watch the output, `o` to turn it into a tab, `a` to see every space. Things that crash go red and you get a toast.

## Install

### Tell your agent

jump:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod:
https://github.com/CodeyPacker/herdr-mods/tree/main/jump
```

run:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod:
https://github.com/CodeyPacker/herdr-mods/tree/main/run
```

### By hand

Copy a mod's `mods/<name>` folder (or symlink it) into `~/.config/herdr-app/mods/` and check it loads:

```sh
herdr-app check ~/.config/herdr-app/mods/jump
```

Then add the key from that mod's `keys.json` to your `~/.config/herdr-app/keys.json`.
Each folder has a `RECIPE.md` with the full details, including what it runs on your machine.

## Hacking

Mods hot reload on save. `jump/mods/jump/tiles.js` and `run/mods/run/tiles.js` are the same file;
edit the one in `run/` and copy it over. Type-check with
`npx -p typescript tsc -p run/mods/run/jsconfig.json`.
