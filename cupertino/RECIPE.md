# Cupertino

Herdr's default window, but every panel is its own rounded card floating on a
lavender-grey canvas, with a purple accent and a palette that follows your
system's light or dark mode. Think IntelliJ's Islands look with Apple-ish
colors. No mods of its own: it points at the shipped ones and they take the
theme.

![Cupertino](preview.png)

## What you see

Everything sits 12 px in from the window edge on a flat `canvas` background
(`#f2f1f7` light, `#0e0d14` dark), with 12 px between cards.

Left column, 268 px wide, four pieces stacked with 12 px gaps:

- The brand row (46 px, Herdr logo, search, sidebar toggle) sits straight on
  the canvas. It drags the window.
- The Spaces list is a card: `surface` fill, 14 px corners, 1 px `border`.
  The shipped `spaces` mod paints it `chrome` (`#f8f7fc` / `#1c1a27`) inside,
  the selected row `selected` (`#f0ecff` / `#29234a`).
- The Agents list is the same kind of card, below it. The two share the
  column's height equally, 90 px minimum each.
- The footer (69 px, Settings, Add machine) sits flat on the canvas.

Right of that, the work column:

- The tab bar (42 px) is flat on the canvas. Tabs are the shipped pills:
  `surface` fill, 1 px `border`, 7 px corners, `+`, Files and Changes, and
  the window buttons on Windows and Linux.
- The focused tab's panes are white cards (`background`, `#ffffff` /
  `#1b1a24`), 14 px corners, 1 px `border`, 12 px apart. The focused pane's
  border turns `accent` (`#6b4ef6`). Each pane has the shipped 30 px `pane`
  header on top: program icon, name, folder. A tab's only pane is framed too.
- Text inside a terminal is inset 16 px top and bottom, 14 px left and
  right.
- Files and Changes, when open, are one more card on the right: 368 px,
  `surface`, 14 px corners, 1 px `border`. Hidden until a tab-bar button
  opens one.
- The status bar (28 px) sits flat on the canvas at the bottom.

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

Three files, no mods:

- `layouts/cupertino.json`: a clone of Herdr's `main` (0.1.13) with
  `cloned_from` dropped and the look set.
- `themes/cupertino-light.json`, `themes/cupertino-dark.json`: Herdr theme
  files, `background`, `foreground`, `selection`, `cursor`, `ansi[16]` and a
  `colors` block that names every panel color from the table above.
- `layouts/cupertino.svg`: the 160x100 picture the settings screen shows.

The layout root (`row`, `titlebar: "none"`, `traffic_lights: [12, 16]`):

```json
"theme": { "light": "cupertino-light", "dark": "cupertino-dark" },
"background": "canvas", "padding": 12, "gap": 12,
"terminal_padding": [16, 14], "preview": "layouts/cupertino.svg"
```

No `divider` on the root or the sidebar: the gaps do that job.

- `sidebar` (`column`, 268 px, min 44, max 480, `resizable: false`, `gap: 12`):
  `brand` block (46 px, `workspace-chrome`, `window_drag`), `sidebar-lists`
  column (`gap: 12`) holding `spaces` and `agents` blocks (`weight: 1`,
  `min: 90`, each with `background: "surface"`, `radius: 14`, `border:
  {width: 1, color: "border"}`), then `sidebar-footer` (69 px,
  `workspace-chrome` with `props: {footer: true}`).
- `work` (`column`, `resizable: false`): `tabs` block (42 px, `tabs` mod,
  `window_drag`), `work-body` row (`padding: 0`, `gap: 12`), `status` block
  (28 px, `workspace-status`).
- `work-body` holds `main` (`content.tab: "active"`) and `panel` (`column`,
  368 px, min 280, max 900, `hidden: true`, `surface` / 14 / 1 px border)
  with a `panel-body` stack of `files` and `changes`.
- The pane frame on `main`:

```json
"pane": { "gap": 12, "radius": 14, "background": "background", "lone": true,
          "border": { "width": 1, "color": "border" },
          "focus": { "width": 1, "color": "accent" },
          "header": { "content": { "mod": "pane" }, "height": 30,
                      "position": "top", "reveal": "always" } }
```

Shipped mods used: `workspace-chrome`, `spaces`, `agents`, `tabs`, `pane`,
`files`, `changes`, `workspace-status`. Nothing runs on the machine beyond
what those already do.

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
- A root `background` gradient is one value for both appearances, so a light
  wash shows up around dark cards at night. That's why the canvas is flat.
- The `spaces` and `agents` mods paint their own `chrome` background over the
  card's `surface`, so those two cards read a shade greyer than the panes.
  That's by design here. The corners still clip.
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
  `themes/cupertino-light.json` and `themes/cupertino-dark.json` are in place
  and `herdr-app status` lists no errors after
  `herdr-app do layout.switch '{"name":"cupertino"}'`.
- `herdr-app shot` in light mode shows a `#f2f1f7` canvas with a 12 px
  margin, white pane cards with 14 px corners, a `#6b4ef6` border on the
  focused pane, and separate Spaces and Agents cards on the left.
- Setting `"appearance": "dark"` in settings.json flips the whole window to
  the dark palette (`#0e0d14` canvas, `#1b1a24` panes) within a second.
- Clicking Files or Changes opens a third card on the right with the same
  corners and border.
- Settings > Look shows Cupertino with the picture from `cupertino.svg`.
