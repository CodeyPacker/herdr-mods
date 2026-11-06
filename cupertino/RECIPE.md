# Cupertino

Herdr's default window, but every panel is its own rounded card floating on a
lavender-grey canvas, with a purple accent and a palette that follows your
system's light or dark mode. Think IntelliJ's Islands look with Apple-ish
colors. Six small mod clones round off the shipped bars and lists so nothing
pokes out of a card, and turn the tab bar's controls into neutral pills.

![Cupertino](preview.png)

## What you see

Everything sits 12 px in from the window edge on a flat `canvas` background
(`#f2f1f7` light, `#0e0d14` dark), with 12 px between cards.

Left column, 268 px wide, four cards stacked with 12 px gaps, each with
`chrome` fill (`#f8f7fc` / `#1c1a27`), 14 px corners and a 1 px `border`:

- The brand row (46 px, Herdr logo, search, sidebar toggle). It drags the
  window.
- The Spaces list, the selected row `selected` (`#f0ecff` / `#29234a`).
- The Agents list. The two lists share the column's height equally, 90 px
  minimum each.
- The footer (72 px, Settings, Add machine).

Right of that, the work column, 12 px between its three pieces:

- The tab bar (30 px) has no fill: the canvas shows through. Every control
  on it is a pill with `surface` fill and a 1 px `border`: each tab (29 px,
  7 px corners), `+` (26 px square, 6 px corners), Files and Changes (26 px,
  6 px corners). The active tab and the open panel button go `selected` fill,
  `accent` border and `accent` text. Hover is `hover` on all of them. The
  window buttons on Windows and Linux stay plain glyphs.
- The focused tab's panes are white cards (`background`, `#ffffff` /
  `#1b1a24`), 14 px corners, 1 px `border`, 12 px apart. The focused pane
  looks the same as the others: no accent ring. Each pane has a 30 px header
  on top (program icon, name, folder, split/zoom/close on hover) with its
  top corners rounded to match. A tab's only pane is framed too.
- Text inside a terminal is inset 16 px top and bottom, 14 px left and
  right. The terminal paints no background of its own (`terminal_opacity: 0`),
  so the card's rounded fill shows through, bottom corners included.
- Files and Changes, when open, are one more card on the right: 368 px,
  drawn by the shipped mods themselves (`background` fill, 10 px corners,
  1 px `border`). Hidden until a tab-bar button opens one.
- The status bar (32 px) is one more `chrome` card at the bottom, 12 px
  below the panes. Its icons carry color on muted text: the machine icon
  `working` blue, the branch icon `accent`, and the agents dot `done` green
  while agents run, `blocked` orange when one needs you, `dim` with none.

Type is Herdr's own: Geist for the panels, JetBrains Mono 14 px for
terminals. Nothing is set, so settings.json still wins there.

Colors, light / dark:

| name | light | dark |
|---|---|---|
| canvas | `#f2f1f7` | `#0e0d14` |
| chrome | `#f8f7fc` | `#1c1a27` |
| background, surface | `#ffffff` | `#1b1a24` |
| raised, popover | `#ffffff` | `#262433` |
| hover | `#efedf6` | `#2a2837` |
| selected | `#f0ecff` | `#29234a` |
| border | `#e2e0eb` | `#212027` |
| input | `#f5f4f9` | `#14131b` |
| foreground | `#16141f` | `#f4f3f9` |
| muted | `#5c5970` | `#aba8bd` |
| dim | `#86839a` | `#7a778d` |
| accent | `#6b4ef6` | `#6b4ef6` |
| ring | `#6b4ef6` | `#9c88ff` |
| selection (terminal) | `#eeeaff` | `#2b2452` |
| cursor | `#6b4ef6` | `#6b4ef6` |
| working | `#3b82f6` | `#5b93f7` |
| blocked | `#f5a524` | `#e8a33a` |
| done | `#18b47a` | `#2fc488` |
| idle, unknown | `#86839a` | `#7a778d` |

Terminal ANSI, light 0-15: `#16141f #c2252c #0a7a51 #a35406 #1f5fd6 #5235d6
#0e7c66 #5c5970 #86839a #ee4447 #18b47a #f5a524 #3b82f6 #6b4ef6 #20a68e
#16141f`. Dark: `#262433 #ff7b7f #45d69a #f8c15a #86afff #b5a6ff #5fd3b0
#aba8bd #7a778d #f0565b #2fc488 #e8a33a #5b93f7 #c4a7ff #20a68e #f4f3f9`.

## How it behaves

- It follows the system appearance: `cupertino-light` in light mode,
  `cupertino-dark` in dark. `appearance` in settings.json pins one.
- Agent status comes from the shipped mods, in the theme's colors: a
  spinner for working, orange `blocked`, green `done`, grey `idle`. Space
  and tab rows carry the dot, the agents card lists them.
- Everything else is stock Herdr: `ctrl-shift-b` folds the sidebar to a
  44 px rail (the cards narrow with it), `ctrl-shift-l` cycles layouts,
  panes split, zoom, close and drag like the default layout, Files and
  Changes open from the tab bar and stay open per space.
- The theme picker in Settings overrides the layout's own theme and sticks to
  this layout, like any other.

## Built from

- `layouts/cupertino.json`: a clone of Herdr's `main` (0.1.13) with
  `cloned_from` dropped, the look set, and six mod references swapped for
  the clones below.
- `mods/cupertino-*`: `mod.clone` of the shipped `spaces`, `agents`, `pane`,
  `tabs`, `workspace-chrome` and `workspace-status`, each with a few lines
  changed in `main.js`, the rest shipped code:
  - `spaces`, `agents`, `workspace-chrome` (both its brand row and its footer)
    and `workspace-status`: `.rounded(13).overflow_hidden()` before the root's
    `.bg(t.chrome)`, and their `.border_t(1)` / `.border_b(1)` dividers removed.
    13 because they sit inside a 14 px card with a 1 px border. The footer's
    padding becomes `px(8).py(8)`.
  - `pane`: `.rounded_t(13)` before the header's `.bg(t.background)`.
  - `tabs`: the root loses `.bg(t.chrome).border_b(1)`. The `button` helper
    takes a `pill` flag that adds `.bg(t.surface).border(1).border_color(t.border)`,
    used for `+` only. Tab items get `.border_color(c.active ? t.accent : t.border)`,
    `.bg(c.active ? t.selected : t.surface)` and `.text_color(c.active ? t.accent : t.muted)`.
    Panel buttons get the same three with `on` in place of `c.active`, plus `.border(1)`.
  - `workspace-status`: its `label(icon, text)` helper takes a third `color`
    for the icon (`t.working` for the machine, `t.accent` for the branch), and
    the agents dot is `needs > 0 ? t.blocked : list.length > 0 ? t.done : t.dim`.
- `themes/cupertino-light.json`, `themes/cupertino-dark.json`: Herdr theme
  files, `background`, `foreground`, `selection`, `cursor`, `ansi[16]` and a
  `colors` block that names every panel color from the table above.
- `layouts/cupertino.svg`: the 160x100 picture the settings screen shows.

The layout root (`row`, `titlebar: "none"`, `traffic_lights: [12, 16]`):

```json
"theme": { "light": "cupertino-light", "dark": "cupertino-dark" },
"background": "canvas", "padding": 12, "gap": 12,
"terminal_padding": [16, 14], "terminal_opacity": 0,
"preview": "layouts/cupertino.svg"
```

No `divider` on the root or the sidebar: the gaps do that job.

Card paint, used on six blocks: `"background": "surface", "radius": 14,
"border": { "width": 1, "color": "border" }`.

- `sidebar` (`column`, 268 px, min 44, max 480, `resizable: false`, `gap: 12`):
  `brand` block (46 px, `cupertino-workspace-chrome`, `window_drag`, card),
  `sidebar-lists` column (`gap: 12`) holding `spaces` (`cupertino-spaces`)
  and `agents` (`cupertino-agents`) blocks (`weight: 1`, `min: 90`, cards),
  then `sidebar-footer` (72 px, `cupertino-workspace-chrome` with
  `props: {footer: true}`, card).
- `work` (`column`, `resizable: false`, `gap: 12`): `tabs` block (30 px,
  `cupertino-tabs`, `window_drag`, no paint), `work-body` row (`padding: 0`,
  `gap: 12`), `status` block (32 px, `cupertino-workspace-status`, card).
- `work-body` holds `main` (`content.tab: "active"`) and `panel` (`column`,
  368 px, min 280, max 900, `hidden: true`, no paint of its own) with a
  `panel-body` stack of `files` and `changes`.
- The pane frame on `main`:

```json
"pane": { "gap": 12, "radius": 14, "background": "background", "lone": true,
          "border": { "width": 1, "color": "border" },
          "focus": { "width": 1, "color": "border" },
          "header": { "content": { "mod": "cupertino-pane" }, "height": 30,
                      "position": "top", "reveal": "always" } }
```

Shipped mods used as-is: `files`, `changes`, and everything the clones open
(`new-menu`, `menu`, `picker`, `machine-add`). The clones run the same code
as their originals: nothing reaches the network or runs programs beyond what
those already do (`git` for branch and worktree info).

## Watch out

- Both theme files have to be in `~/.config/herdr-app/themes/`. AGENTS.md's
  install steps only mention `layouts/` and `mods/`, so say it. With a theme
  missing, `layout.switch` answers ok and the cards show up, but in Herdr's
  default graphite or paper colors: `layout.error` and `herdr-app status` say
  `layouts/cupertino.json was not applied: theme "cupertino-light" is not one
  of graphite, ink, moss, paper and there is no themes/cupertino-light.json`.
  Copying the themes in afterwards doesn't clear it by itself: run
  `layout.switch` again.
- `app.theme {name}` only sets the half (light or dark) that matches the
  theme's own lightness. To see the other half set `"appearance"` in
  settings.json. Theme picks are saved as clicks in `layouts/.state/` and
  beat the layout file.
- `shadow` on the pane frame does nothing in 0.1.13 (`sm`, `md`, `lg` all
  render the same as none). Leave it out.
- The terminal's own background fill is square and Herdr draws it, so no mod
  can round it. `terminal_opacity: 0` is the fix: the terminal paints no
  background and the rounded pane frame shows through. Programs that set
  their own colors (an editor theme) still paint theirs.
- A root `background` gradient is one value for both appearances, so a light
  wash shows up around dark cards at night. That's why the canvas is flat.
- Herdr doesn't clip a mod to its node's `radius`. A mod that paints a
  full-size background (every shipped bar and list does) draws square corners
  over the card's rounded ones. That's the whole reason the clones exist. The
  shipped `files` and `changes` already round themselves
  (`.rounded(10).overflow_hidden()`), so the panel node carries no paint and
  those two keep their 10 px corners.
- The clones never update with Herdr. After an app update, diff each against
  its shipped original and re-apply the few lines above.
- The tab bar block is 30 px with a 12 px column gap under it, which adds up
  to the stock 42 px. Making the block taller leaves the pills floating in
  empty canvas.
- `spaces` and `agents` paint `chrome`, so those two cards read a shade
  greyer than the white panes. By design.
- `layout.clone` copies `main`'s click state (panel width, active panel,
  theme pick) into `layouts/.state/cupertino.json`. Harmless, but a theme
  pick there hides whether the layout file's `theme` works.
- Light mode shows terminal programs that assume a dark background (an
  editor with a dark colorscheme) on white. That's the program, not the
  theme: the 16 ANSI colors and `foreground` are picked for white.
- Fonts are left unset on purpose. Setting `ui_font` to a font the other OS
  lacks just falls back, so there's nothing to gain in v1.

## Done when

- `~/.config/herdr-app/layouts/cupertino.json`, `layouts/cupertino.svg`,
  `themes/cupertino-light.json`, `themes/cupertino-dark.json` and the six
  `mods/cupertino-*` folders are in place, `herdr-app check` passes on each
  mod, and `herdr-app status` lists no errors after
  `herdr-app do layout.switch '{"name":"cupertino"}'`.
- `herdr-app shot` in light mode shows a `#f2f1f7` canvas with a 12 px
  margin, white pane cards with 14 px corners, four cards down the left
  (brand, Spaces, Agents, footer), a status card along the bottom, and a tab
  bar with no fill whose tabs, `+`, Files and Changes are bordered pills, the
  active tab in `#6b4ef6`. Zoomed in, every card corner is a clean arc with
  canvas outside it, the pane's bottom corners included.
- Setting `"appearance": "dark"` in settings.json flips the whole window to
  the dark palette (`#0e0d14` canvas, `#1b1a24` panes) within a second.
- Clicking Files or Changes opens a third card on the right with the same
  corners and border.
- Settings > Look shows Cupertino with the picture from `cupertino.svg`.
