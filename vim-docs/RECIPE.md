# Vim Docs

A small window of Vim commands to keep open while you work. Search by what
a command does or by its keys, browse by category, and star the ones you
are learning. Rows show the description on the left and the keys as
keycaps on the right.

![Vim Docs](preview.png?v=5bc3d4074bbd)

## What you see

A 360 × 480 px floating window with no frame: theme `popover` background,
12 px corners, a 1 px `border`, 10 px padding and 8 px gaps. Base text is
12.5 px.

1. **Header:** "Vim" in semibold, then two tab buttons, "All" and
   "★ n" (the starred count), then a "✕" close button. The active tab uses
   the theme's `selected` background.
2. **Search:** a 28 px input with an `accent` border and the placeholder
   "Search: delete word, ciw, macro".
3. **List:** a scrolling list. While the search is empty, small dim
   category labels split the rows: Movement, Jumps and marks, Insert, Edit,
   Text objects, Visual, Search and replace, Undo and repeat, Registers and
   macros, Windows, Buffers and tabs, Files, Folds. Each row has a star
   (☆ or an `accent` ★), the description (truncated) and the keys. The
   selected row uses `selected` and also shows its note, when it has one,
   in 11 px dim text under the description.
4. **Legend:** 10.5 px dim text: "↑↓ ctrl-j/k move · enter star ·
   tab starred · esc close".

Keycaps use the terminal font at 11 px. Each key is a small box with a
`raised` background and a 1 px `border`. `<C-w>` reads as ctrl, w. `<Esc>`,
`<CR>`, `<Tab>`, `<BS>` and `<Space>` read as esc, enter, tab, bksp and
space. Fill-ins such as `{motion}` are dim italic text with no box.
Commands typed on the command line (`:wq`, `/pattern`, `?pattern`) are one
box. Alternatives such as `i{ a{` sit 10 px apart.

## How it behaves

- `ctrl-shift-d` (`cmd-shift-d` on macOS) opens it. The search box always
  has the keyboard.
- Typing filters by every space-separated word across description, keys,
  category and note. A search drops the category labels and ranks rows:
  exact key match (case matters), then exact key ignoring case, then keys
  containing the query, then descriptions containing every word, then the
  rest.
- Up/down or `ctrl-k`/`ctrl-j` move and wrap. The selection scrolls into
  view. Clicking a row selects it.
- `enter` or clicking a star stars or unstars the row. `tab` or clicking a
  tab button switches between All and Starred. Starred shows an empty
  message until something is starred.
- `esc` clears a nonempty search, then closes.
- Drag the window by any empty spot. It opens where it was left.
- Closing saves the tab, search and selected row. Opening again restores
  them, with the search text selected so typing replaces it.

## Built from

- `mods/vim-docs/main.js` draws the view. `data.js` holds the 128 commands
  (category, description, keys, optional note), `search` and `keyParts`.
  `kit/` is the shared theme and UI parts.
- `mod.json`: `place: "none"`, title "Vim Docs", and an overlay of kind
  `window` with key `vim-docs`, 360 × 480, `frame: "none"`. `keys.json`
  maps `ctrl-shift-d` and `cmd-shift-d` to `mod.open:vim-docs`.
- Uses `props`, `closeOverlay`, `nextCommand`, `shared`, `setShared` and
  `settings` from `herdr`, and native `InputState`, `Input` and
  `ScrollHandle`.
- Stars are kept in shared state under `vim-docs.favorites`, in list
  order. The last view is kept under `vim-docs.view` as
  `{ tab, query, at }`, written from the View's `close()`.
- Commands: `herdr-app do vim-docs.<up|down|star|tab|cancel|focus>`.
- `preview.png` and `thumbnail.png` are the same artwork.

## Watch out

- The window is dragged by any press the mod doesn't stop. Tabs, the close
  button, the search box and the list stop left presses so they don't
  drag.
- The search box gets focus again 600 ms after opening, once the app has
  placed the window.
- A star is stored by an id built from category, keys and description.
  Editing any of those in `data.js` drops that star.
- Windows are not resizable. No network, no programs, no files outside
  Herdr's shared state.
- Edit kit files in the root `kit/`, then run `node scripts/sync-kit.mjs`.

## Done when

- `herdr-app check vim-docs/mods/vim-docs` passes.
- Searching `ciw`, `delete word` and `macro` puts the expected rows first.
- Starring a row shows it in Starred and survives a restart.
- Closing and reopening keeps the tab, search, selection and position.
