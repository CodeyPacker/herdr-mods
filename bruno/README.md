# Bruno

Your Bruno Collections in one dialog: the tree of Collections, folders and Requests on the left, and the last Run's Response on the right. Requests are run with the Bruno CLI.

Open it with `ctrl-a b`. `j`/`k` move through the tree, `h`/`l` fold and unfold, and `enter` runs a Request. `r` runs the selected row: a folder or Collection asks first, then lists each Request's pass or fail with filters and a sort. `ctrl-l` puts the keyboard on the Response, where `j`/`k` move through a Run's Requests, and `ctrl-h` puts it back on the tree.

`e` picks the Collection's Environment, `o` shows the Request's file, `y` copies its URL, `b` opens Bruno desktop. `1`-`4` pick the Response, Headers, Timeline and Tests views, `/` searches a Run's Requests, `f` fills the window, `ctrl-r` reads everything again, `?` shows or hides the key list.

The gear (or `,`) opens the settings: open in full screen, hide the key hints, and switch any shortcut off or move it to another key.

## Needs

- The Bruno CLI on every Machine that holds a Collection: `npm i -g @usebruno/cli`. Herdr must be able to find `bru` on its own PATH, so a CLI installed under a Node version manager may not be seen.
- Bruno desktop is optional. Its workspace file is where Collections on this computer are found. Collections elsewhere are listed in `~/.config/herdr-app/bruno.json`.
- It runs `bru`, `node` and a file-listing command (`powershell` on Windows, `sh` elsewhere) on a Collection's Machine, and `cat` and `rm` on another Machine. It writes a temporary report per Run under `data/bruno` and deletes it. It never reads `.env`.
- A Run sends the Collection's requests to whatever they point at.

## Install

By hand: copy `mods/bruno` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.

## Credit

The Run logic, the parsers, the Response's views and the tests come from [Brunr](https://github.com/jbped/herdr-mods/tree/main/brunr) by Jake Pedigo, under the MIT license in [`LICENSE-brunr.txt`](LICENSE-brunr.txt). The single dialog, its keys and its settings are new here.
