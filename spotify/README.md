# spotify

Spotify in Herdr: a now-playing slot for your bar, a hover card with the controls, and a dialog you drive from the keyboard.

![spotify](preview.png?v=a7f0b43c8f6a)

Spotify in Herdr. A now-playing slot for your bar, a hover card with the controls, and a dialog you drive from the keyboard. Press `ctrl-shift-m` (`cmd-shift-m` on macOS).

`h`/`l` switch between Queue, Playlists, Search and Devices, `j`/`k` move, `enter` plays. `space` play/pause, `n`/`b` next/previous, `[`/`]` seek, `-`/`=` volume, `z` shuffle, `r` repeat, `s` search, `a` adds to the queue.

It controls your Spotify, it plays nothing itself. Needs Spotify Premium, Spotify open on some device, and a free Spotify developer app of your own. The first open walks you through that.

For the slot, add a block to your layout (`"card": "above"` opens the hover card upward, for a bottom bar):

```json
{ "id": "spotify", "type": "block", "size": { "px": 220 }, "content": { "mod": "spotify", "props": { "slot": true } } }
```

Built and tested on Windows. The macOS sign-in helper has not been run yet: if it misses the login, the dialog asks you to paste the browser's address instead.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/spotify
```

By hand: copy `mods/spotify` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.

[`RECIPE.md`](RECIPE.md) has the full details, including what it runs on your machine.
