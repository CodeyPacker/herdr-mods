# Jump

A popup that lists every space with its tabs and jumps to one when you type
its letter. tmux's prefix+w with vimium's hints, in place of the built-in picker.

![Jump](preview.png)

## What you see

A 760 px popup at the top of the window, popover background, 18 px padding.
Top line: "Go to…" (15 px semibold) and "? help   Esc" at the right in the
dim color. On first open a help box (raised background, 1 px border, 12 px
text) with four lines; `?` hides and shows it again.

One section per space: a header row with the space's colored avatar (18 px
square, its first letter), its name in the muted color, and its hint badge
at the right edge. Under it one 30 px row per tab: a status dot, the tab's
name, what runs in it in 11 px dim text (program names joined by " · ", or
"empty"), and the hint badge. The selected row has the `selected`
background. After a 1 px top border, two more rows: "new tab · in this
space" with the letter `t`, and "new space · on this computer" with `n`.

Bottom line: the key hints in accent/dim pairs.

## How it behaves

- Opens on the active tab of the active space.
- The status dot follows the tab's agent status: a spinner for working,
  `blocked`, `done` and `idle` in the theme's colors, a dim dot otherwise.
- Typing a row's letter goes to that tab and closes. A space's letter goes
  to its active tab. Hints are single letters while they fit, two beyond,
  never starting with a chosen letter. Chosen letters draw in the accent
  color and come from `~/.config/herdr-app/hints.json`.
- `j`/`k`, arrows and `ctrl-n`/`ctrl-p` move; `Enter` goes; `x` closes
  the selected tab; `t` new tab here; `n` new space; `q` or `Esc` closes.
- Every space is always listed; nothing folds away.

## Built from

- `mods/jump/main.js` and `mods/jump/tiles.js` (the same tiles file as the
  Run mod: hints, rows, headers, navigation, help box).
- `mod.json`: `{ "place": "none", "overlay": { "kind": "popup", "at": "top", "offset": 40, "width": 760, "height": 0.75 } }`.
- Data: `spaces()` for spaces and tabs, `panes()` for what each tab runs
  (`program.name`, or `mod`), `agents()` for status, `shared("space.colors")`
  for the avatar colors the shipped mods assign.
- Commands: `tab.select {id}`, `space.select {id}`, `tab.new`, `space.new`,
  `tab.close {id}`.
- `hints.json`: `{ "spaces": { "Logos": "l" }, "tabs": { "Logos/Code": "c" } }`,
  read with `readTextFile(appHome() + "/hints.json")`.
- Theme colors only.

## Watch out

- Type-clean under the jsconfig the app writes (`checkJs`, `strict`): every
  function carries JSDoc types, `colors()` in tiles.js casts `theme()` to the
  builders' color type. Check with `npx -p typescript tsc -p jsconfig.json`.
- Elements are single-use: collect each space's rows before building its
  section.
- A popup is sized by content; the list gets an estimated height, capped
  at 560 px with a scrollbar.
- Reserved letters, never hints: `t n q j k x`.
- The built-in picker stays installed; this mod only takes its key when
  `keys.json` says so (`"ctrl-shift-k": "mod.open:jump"`), or it opens from
  a leader popup.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/jump` passes.
- Opening shows every space and tab with a letter each; the active tab is
  selected.
- Typing a tab's letter switches to it; typing a space's letter switches to
  that space; `t` makes a new tab; `n` a new space.
- A space named in `hints.json` shows that letter in the accent color.
