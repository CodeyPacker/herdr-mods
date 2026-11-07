# Tourist

A pane where Claude gives you a guided tour of code: your branch's changes, the
last commit, the whole repo, or a feature you describe. Claude picks the stops
and their order. You pick the depth, then go deeper, more technical or ask at
any stop.

![Tourist](preview.webp)

## What you see

Setup, in two steps:

1. What to tour: Branch changes (`b`), Last commit (`c`), Whole repo (`r`), A
   feature (`f`). Each row has a letter badge, a title and a hint (changed
   file count, the commit subject). Picking A feature shows a text box under
   the row for the description.
2. How deep: Overview, Normal, Deep. A "Touring: ..." line repeats step 1.

The highlighted row has the theme's `selected` background and an accent badge.
Row text wraps in narrow panes.

While Claude plans, a spinner. Then the tour: a header with "n / total", the stop
title and the tour title, the file and line range (click or `o` opens it in VS
Code), the code excerpt, and the explanation below it, capped at 680 px wide.
Stop 1 also shows the tour summary. Answers from Deeper, More technical and Ask
stack under the explanation. A button bar at the bottom repeats the keys.

## How it behaves

- Setup: `j`/`k` or the arrows move, a row's letter jumps to it, `enter` picks.
  In step 2, `enter` starts the tour and `esc` goes back to step 1.
- Feature box: `tab` on the feature row types into it, `tab` or `esc` gives the
  keys back to the list. `enter` in the box goes to step 2.
- Planning: `q` or `esc` cancels.
- Tour: `n`/`l`/right next, `b`/`h`/left back, `d` deeper, `t` more technical,
  `a` or `/` ask (the box only exists while asking), `o` open in VS Code, `q`
  ends the tour and returns to step 1.
- Error: `enter`, `q` or `esc` starts over.
- Branch changes is skipped (enter does nothing) when the branch has no
  changes. The default scope is commit or repo in that case.

## Built from

- `mods/tourist/main.js`, one `View`.
- `mod.json`: `{ "place": "none", "focusable": true, "title": "Tourist" }`.
- `keys.json` opens it in a split: `"ctrl-a t": { "command": "pane.split",
  "args": { "direction": "right", "mod": "tourist" } }`.
- The folder is the pane's `props().folder`, else the focused pane's cwd. Git
  finds the root, branch, base (`origin/HEAD`, `main` or `master`), merge-base
  and changed files.
- Claude runs as `claude -p --output-format json --allowedTools Read Grep Glob
  "Bash(git diff:*)" "Bash(git log:*)" "Bash(git show:*)" "Bash(git status:*)"`.
  Follow-ups add `--resume <session_id>` so Claude keeps the context.
- `exec` stops anything over 30 s, so Claude runs in a hidden terminal: `hc run
  --bg --no-parent --outlive-parent --cwd <root> --json -- pwsh -NoLogo
  -NoProfile -Command <script>` (`sh -c` off Windows). The prompt and reply go
  through files in `<appHome>/data/tourist/`. The mod polls `hc wait <address>
  --timeout 20` until it ends, then `hc rm`.
- The plan is the `{...}` JSON in Claude's reply: a title, a summary and stops
  with `file`, `start`, `end`, `title` and `body`.
- Code excerpts use `EditorState`/`Editor`, read-only, without line numbers.
  Text uses `TextView.markdown`.
- `herdr-app do tourist.<command>` drives it for testing: `scope-<id>`,
  `depth-<id>`, `down`, `up`, `pick`, `back`, `start`, `next`, `prev`,
  `deeper`, `technical`, `open`, `reset`.

## Watch out

- Needs the `claude` CLI on `PATH`, signed in. Claude only gets read tools and
  read-only git commands.
- Every tour and follow-up is a Claude call and uses your plan's usage. Whole
  repo is the slowest.
- `o` runs `code -g`, so it needs VS Code's `code` on `PATH`.
- Panes that are already open keep the old code after an edit. Close the pane
  and reopen it.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/tourist` passes.
- `ctrl-a t` opens the pane on step 1 with the current repo and branch.
- `c`, `enter`, `enter` plans a tour of the last commit, and the first stop
  shows the file, code and explanation.
- `d` adds a "Deeper" note that builds on the stop. `q` returns to step 1.
