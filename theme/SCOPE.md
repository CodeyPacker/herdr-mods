# Scope: an Apple-style Herdr layout

Make Herdr look like PReview and Pensieve: lavender-grey canvas, white cards with
hairline borders, 14-18px corners, purple accent, SF-ish type. Light and dark.
Shipped as a Herdr **layout** (a layout is the only thing that can carry a look),
published from this repo so anyone can install it.

Source of truth for every value: `PReview/src/renderer/tokens.css`. Pensieve uses
the same tokens (it keeps a copy under `design/references/preview-2026-10-29/`),
so there is one palette to map, not two.

## What Herdr lets a layout change

From `~/.config/herdr-app/AGENTS.md` (0.1.13):

- Root `theme`: a preset or `themes/<name>.json`, or `{ "light": "...", "dark": "..." }`
  to follow the OS. `colors` overrides any theme color by name, but overrides
  apply in both appearances, so light/dark needs two theme files, not overrides.
- `themes/<name>.json`: `background`, `foreground`, `selection`, `cursor`,
  `ansi[16]`, plus `colors: {}` for the panel colors. All `#rrggbb`, no alpha.
- Theme color names (`theme()`): background, surface, canvas, chrome, popover,
  raised, hover, selected, border, input, foreground, muted, dim, accent,
  accent_foreground, solid, solid_foreground, ring, selection, working, blocked,
  done, idle, unknown, ansi0..15. Shipped mods (spaces, agents, tabs, pane,
  files, changes, status bar) draw only from these, so they restyle for free.
- Per node: `background` (solid, gradient or image), `border`, `radius`,
  `shadow` (`sm` | `md` | `lg` only), `padding`, `gap`, `divider`.
- Pane frame: `gap`, `radius`, `background`, `border`, `focus`, `header`, `lone`.
- Fonts: `font`, `font_size` (terminal), `ui_font` (mods). A layout can ship
  `.ttf`/`.otf` in a mod's `fonts/` folder.
- Only the root's look applies today. Per-block looks are "coming".

Can't do: backdrop blur (no glass), custom shadow colors or offsets, alpha
borders in a theme file, changing shipped mod sizes/radii without cloning the mod.

## Token map

PReview token -> Herdr color. Light / dark.

| Herdr | PReview | Light | Dark |
|---|---|---|---|
| background (terminal) | surface-solid | `#ffffff` | `#1b1a24` |
| canvas | canvas | `#f2f1f7` | `#0e0d14` |
| chrome (sidebar, bars) | surface flattened on canvas (no blur) | `#f8f7fc` | `#1c1a27` |
| surface | surface-solid | `#ffffff` | `#1b1a24` |
| raised | surface-raised | `#ffffff` | `#262433` |
| popover | surface-raised | `#ffffff` | `#262433` |
| hover | surface-hover | `#efedf6` | `#2a2837` |
| selected | surface-selected | `#f0ecff` | `#29234a` |
| border | border flattened on canvas (was `#2a1f6614` / `#ffffff14`) | `#e2e0eb` | `#212027` |
| input | surface-sunken | `#f5f4f9` | `#14131b` |
| foreground | ink | `#16141f` | `#f4f3f9` |
| muted | ink-secondary | `#5c5970` | `#aba8bd` |
| dim | ink-tertiary | `#86839a` | `#7a778d` |
| accent | accent | `#6b4ef6` | `#6b4ef6` |
| accent_foreground | on-accent | `#ffffff` | `#ffffff` |
| solid | ink | `#16141f` | `#f4f3f9` |
| solid_foreground | ink-inverse | `#ffffff` | `#16141f` |
| ring | focus-ring | `#6b4ef6` | `#9c88ff` |
| selection (terminal) | accent-soft | `#eeeaff` | `#2b2452` |
| cursor | accent | `#6b4ef6` | `#6b4ef6` |
| working | info-fill | `#3b82f6` | `#5b93f7` |
| blocked | warning-fill | `#f5a524` | `#e8a33a` |
| done | success-fill | `#18b47a` | `#2fc488` |
| idle | ink-tertiary | `#86839a` | `#7a778d` |
| unknown | ink-tertiary | `#86839a` | `#7a778d` |

Gaps and the proposed fill:

- **ANSI 16.** PReview has no terminal palette. Build one from its semantic and
  syntax colors so terminal output matches the UI:
  - Light 0-7: `#16141f` `#c2252c` `#0a7a51` `#a35406` `#1f5fd6` `#5235d6` `#0e7c66` `#5c5970`;
    8-15: `#86839a` `#ee4447` `#18b47a` `#f5a524` `#3b82f6` `#6b4ef6` `#20a68e` `#16141f`.
  - Dark 0-7: `#262433` `#ff7b7f` `#45d69a` `#f8c15a` `#86afff` `#b5a6ff` `#5fd3b0` `#aba8bd`;
    8-15: `#7a778d` `#f0565b` `#2fc488` `#e8a33a` `#5b93f7` `#c4a7ff` `#20a68e` `#f4f3f9`.
- **Glass.** `surface` is 72%/78% alpha with a 24px blur. No blur in Herdr, so
  chrome gets a flat tint instead. Keep PReview's canvas sky wash:
  root `background: { "gradient": ["#e6e9fa", "#f2f1f7"], "angle": 180 }`
  (dark: `["#17152b", "#0e0d14"]`). See Q3 on doing that per appearance.
- **Shadows.** PReview's `shadow-md` is `0 1px 2px #2a1f660a, 0 10px 30px #2a1f6614`.
  Herdr has only `sm | md | lg`. Use `"shadow": "sm"` on the pane block and leave
  it at that. Test whether pane frames accept `shadow` at all (not in the documented list).
- **Radius.** PReview panels 18, cards 14, controls 10. Pane cards: `radius: 14`.
  Shipped mods hardcode their own (tabs 7, buttons 6); leave them.
- **Spacing.** `work-body` padding 12, pane gap 12 (PReview `space-12`), terminal
  padding `[16, 14]`.
- **Fonts.** PReview uses the system stack (SF Pro on mac, Segoe UI Variable on
  Windows) and SF Mono / Cascadia Code. Leave `ui_font` and `font` unset in v1:
  Herdr's Geist / JetBrains Mono are close, and a font name missing on the other
  OS falls back anyway. Revisit if it reads wrong in the screenshot.
- **Unused PReview tokens.** accent-soft-hover, accent-text, accent-border,
  danger/success/warning/info text and soft variants, diff, syntax, chart colors.
  Herdr has no slot for them. Nothing to do.

## Files

Final folder name is the layout name. Working name `cupertino`, change it if
you want something else (rename the folder, the layout file, the theme files and
the `theme` references together). This `theme/` folder is just where the scope
lives until then.

```
cupertino/
├── RECIPE.md                    brief in the herdr.dev format (see AGENTS.md)
├── preview.png                  screenshot, light mode
├── layouts/cupertino.json       the layout (a clone of main with the look set)
├── layouts/cupertino.svg        picture for Herdr's settings screen
└── themes/
    ├── cupertino-light.json
    └── cupertino-dark.json
```

Same shape as `jump/` and `run/` plus `layouts/` and `themes/`, matching the
herdr-layout-examples repos. No `mods/` in v1: the layout points at the shipped
mods and they take the theme. Add a `mods/` folder only if a shipped mod needs
cloning (see Q2).

The layout file: `herdr-app do layout.clone '{"name":"main","as":"cupertino"}'`,
then edit the clone's root: `"theme": {"light": "cupertino-light", "dark": "cupertino-dark"}`,
the gradient background, pane `radius: 14`, `gap: 12`, `work-body` padding 12,
`terminal_padding: [16, 14]`, `"preview": "layouts/cupertino.svg"`. Drop the
`cloned_from` field before committing.

## Install and publish

Install, by hand:

1. Copy `layouts/cupertino.json` to `~/.config/herdr-app/layouts/`.
2. Copy `themes/*.json` to `~/.config/herdr-app/themes/`.
3. `herdr-app do layout.switch '{"name":"cupertino"}'`. `ctrl-shift-l` cycles back.

Install, by agent: same prompt pattern as the README has for jump and run,
pointing at `https://github.com/CodeyPacker/herdr-mods/tree/main/cupertino`.

Publish: the repo already has the `herdr-mod` topic. Add `herdr-layout` too
(`gh repo edit --add-topic herdr-layout`). herdr.dev picks it up within the hour.
One repo can hold mods and layouts side by side (herdr-layout-examples does).

## Split (2026-11-06)

The look turned out to be two things, so it ships as two folders:

- `islands/`: the card layout (IntelliJ Islands style) plus six mod clones. No
  `theme` of its own, so it takes whatever the picker says.
- `cupertino/`: the two theme files plus a copy of the stock `main` layout
  with them preselected. No mods.

Only one layout shows at a time, but a theme pick sticks per layout, so
islands + cupertino is `layout.switch islands` then `app.theme cupertino-dark`
and `cupertino-light`. The `cupertino/` folder is what this scope was for; the
card structure grew out of the Q2 answer.

## Open questions

- Q1. Does an agent following AGENTS.md's install steps copy `themes/`? The steps
  name `layouts/` and `mods/` only. If not, the RECIPE's install section has to say
  it, and the fallback is inlining the dark palette as `colors` in the layout
  (single appearance). Test with a fresh `HERDR_APP_HOME`.
  **Answer:** No. A literal read of the steps copies `layouts/` and `mods/` only, so the RECIPE and the README prompt both say to copy `themes/`. No inlining needed: see Q5, Herdr tells you what is missing.
- Q2. Do the shipped mods look right as-is? Tabs mod is 42px with 7px pills, status
  bar 28px. If they fight the look, clone `tabs` and `pane` and point the layout at
  the clones. Decide from the first screenshot, not up front.
  **Answer:** Sizes yes, corners no. The 42px tab bar and 28px status bar sit flat on the canvas and read fine. But Herdr doesn't clip a mod to its node's radius, so `spaces`, `agents` and the `pane` header painted square corners over the cards. Cloned all three as `cupertino-*` with one `.rounded(13).overflow_hidden()` (header: `.rounded_t(13)`) on the root. `files` and `changes` already round themselves.
- Q3. The canvas gradient is one value for both appearances. Either two layout
  files (`cupertino-light`, `cupertino-dark`), or a flat `"background": "canvas"`
  and give up the wash. Lean flat unless the gradient is what sells it.
  **Answer:** Flat `"background": "canvas"`. The light gradient showed up as a lavender strip around the dark cards in dark mode. One layout file, no wash.
- Q4. Pane frame `shadow`: documented on nodes, not on `pane`. Try it. If it
  doesn't take, drop shadows entirely.
  **Answer:** It doesn't take. `sm`, `md` and `lg` on the pane frame all render pixel-identical to no shadow in 0.1.13. Dropped.
- Q5. Does Herdr fall back cleanly when `theme` names a `themes/` file that is
  missing (someone skipped step 2)? Check what `layout.error` says.
  **Answer:** Cleanly. `layout.switch` answers ok, the cards show up in Herdr's default graphite/paper colors, and `layout.error` / `herdr-app status` say `layouts/cupertino.json was not applied: theme "cupertino-light" is not one of graphite, ink, moss, paper and there is no themes/cupertino-light.json`. Adding the files afterwards needs another `layout.switch`.

## Build plan

1. Write `themes/cupertino-light.json` and `-dark.json` from the table. `app.theme`
   each one on the stock `main` layout, `herdr-app shot`, fix contrast.
2. Clone `main` as `cupertino`, set the look fields, switch to it, screenshot light
   and dark. Answer Q2, Q3, Q4 from what you see.
3. Copy the three files into `cupertino/` here, strip `cloned_from`, draw
   `layouts/cupertino.svg`, save `preview.png`.
4. Write `RECIPE.md` (What you see, How it behaves, Built from, Watch out, Done when).
5. Test a clean install: point `HERDR_APP_HOME` at an empty folder, start Herdr,
   follow the RECIPE's install steps. Answer Q1 and Q5.
6. README section, add the `herdr-layout` topic, push.
