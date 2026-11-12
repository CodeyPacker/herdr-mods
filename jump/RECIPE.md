# Jump

A popup that lists every space with its tabs and jumps to one when you type
its letter. tmux's prefix+w with vimium's hints, in place of the built-in picker.

![Jump](preview.png)

## What you see

A 560 px popup at the top of the window, in the shared kit's frame: popover
background, 16 px round corners, its own border, 22 px padding. Top line:
"Jump to…" (16 px semibold) and "Esc" at the right in the dim color.

Every row is 32 px with 8 px round corners and starts with its letter badge.
A space's tabs, agents and their labels are set in 33 px from it, behind a 1 px
border-color line that drops from under the space's badge, so the space letters
form one column and the tab letters a second. Each space is a block: its own row with
the name in 14 px semibold and "Space" at the right, then a dim "Tabs" label and
one row per tab (the tab's name, then what runs in it at the right in 11 px dim
text: program names joined by " · ", or "empty"), then an "Agents" label and one
row per agent (its title, then its tab and program at the right). Rows show a
status mark only when there is a status. Spaces with the same name also show
their folder in dim text, and their branch when the folders match too. The
selected row has the `selected` background and an accent badge. A thin line
separates one space's block from the next.

Bottom, after a thin line: one row of key hints, `j/k`, `x` and `r` in
accent/dim pairs, `R` set key, then `t` new tab and `n` new space, which are also buttons.
## How it behaves

- Opens on the active tab of the active space.
- The status dot, when there is a status, follows the tab's agent status: a spinner for working,
  `blocked`, `done` and `idle` in the theme's colors.
- Typing a row's letter goes to that tab and closes. A space's letter goes
  to its active tab. Hints are single letters while they fit, two beyond,
  never starting with a chosen letter. Chosen letters draw in the accent
  color and come from `~/.config/herdr-app/hints.json`.
- `j`/`k`, arrows and `ctrl-n`/`ctrl-p` move; `Enter` goes; `x` closes
  the selected tab with no confirm and the popup stays open; `t` new tab here; `n` new space; `r` renames the selected tab or
  space (the space, on a one-tab row) in a name box above the list (`Enter` saves, `Esc` cancels, the popup
  stays open; an empty name goes back to Herdr's default); `q` or `Esc` closes.
- Every space is always listed; nothing folds away.

## Built from

- `mods/jump/main.js`, and `mods/jump/kit/`, this repo's shared kit: the frame,
  list rows, letter badges and their navigation, the key legend.
- `mod.json`: `{ "place": "none", "overlay": { "kind": "popup", "at": "top", "offset": 40, "width": 560, "height": 0.9, "frame": "none" } }`.
- `keys.json` opens it: `"ctrl-shift-k": "mod.open:jump"`.
- Data: `spaces()` for spaces and tabs, `panes()` for what each tab runs
  (`program.name`, or `mod`), `agents()` for status, `shared("space.colors")`
  for the avatar colors the shipped mods assign.
- Commands: `tab.select {id}`, `space.select {id}`, `tab.new`, `space.new`,
  `tab.close {id, confirmed: true}`, `tab.rename {id, name}`, `space.rename {id, name}`.
- `hints.json`: `{ "spaces": { "Logos": "l" }, "tabs": { "Code": "c", "Logos/Tests": "e" } }`,
  read with `readTextFile(appHome() + "/hints.json")`. A tab is named alone
  (every space) or as "space/tab" (one space, and it wins). Names match in any
  case. An agent row uses its tab's letter.
- Chosen letters may repeat, so every space's Code tab can be `c`. A letter
  one row has jumps there. A letter several rows have moves to the next of
  them, and `Enter` opens it. A space whose tabs share letters with other rows
  does not jump on its letter: `l` selects Logos and waits, `c` then goes to
  Logos/Code, `Enter` goes to Logos itself, `Esc` stops waiting. With no
  repeated letters nothing waits, so an older `hints.json` behaves as before.
- A space's letter badge has no border, so only tabs and agents are outlined.
  `"spaceColor"` in `hints.json` sets the color of a space's letter: a theme
  color's name (`"ansi3"`), a plain color name (`"yellow"`, mapped to the
  theme's `ansi0`..`ansi7`), or a hex color. Without it the letter is accent
  when chosen or selected, muted otherwise.
- `shift-r` sets the selected row's letter in a box above the list and saves
  it to `hints.json` with `writeTextFile`: a space by name, a tab as
  "space/tab". An empty value removes the entry.
- Theme colors only.

## Watch out

- Type-clean under the jsconfig the app writes (`checkJs`, `strict`): every
  function carries JSDoc types, `colors()` in kit/theme.js casts `theme()` to the
  builders' color type. Check with `npx -p typescript tsc -p jsconfig.json`.
- Elements are single-use: collect each space's rows before building its
  section.
- A popup is sized by content; the list gets an estimated height, capped
  at 90% of the window's height (`window.viewport_size()`, read in render)
  less 130 px for the title, legend and padding. Past that it scrolls, so the
  key hints stay on screen. The cap is 470 px if the size cannot be read.
- Reserved letters, never hints: `t n q j k x r`.
- The built-in picker stays installed; this mod has its own key instead.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/jump` passes.
- Opening shows every space and tab with a letter each; the active tab is
  selected.
- Typing a tab's letter switches to it; typing a space's letter switches to
  that space; `t` makes a new tab; `n` a new space.
- A space named in `hints.json` shows that letter in the accent color.
