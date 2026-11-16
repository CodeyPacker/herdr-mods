# Branch

A searchable dialog for the current space's Git branches. Switch, create,
rename and delete local branches, sync with remotes, and stash uncommitted
work from the keyboard. Runs Git on the space's machine.

![Branch](preview.png)

## What you see

A 640 px wide dialog, 70% of the window tall, using the shared kit's frame:
theme `popover` background, 16 px corners, a 1 px `border`, 22 px padding
and 14 px gaps. The title is "Branches" in 16 px semibold. Beside it,
11 px dim text shows the repo, current branch, changed files and stash
count. "Esc" sits at the right.

A 32 px filter box sits above a scrolling list with Local and Remote
sections. Rows are 32 px tall with 2 px gaps and 8 px corners. Each shows
a current-branch dot, the branch name, upstream marks (`↑N`, `↓N`, `gone`
or `local only`) and the last commit subject in dim text, capped at 260 px.
The selected row uses the theme's `selected` background. Local branches
come first, the current branch first, then newest commits. Remote branches
already represented by a tracking local branch are hidden.

A name box or confirmation appears above the list when needed. Errors and
action results appear below it. A divider and wrapping keyboard legend
finish the dialog. A spinner beside the repo details shows Git is busy.

## How it behaves

- `ctrl-shift-y` opens it. Typing filters branch names by every space-separated
  word, ignoring case. Arrows or `ctrl-j`/`ctrl-k` move and wrap. Clicking
  a row selects it. The selection scrolls into view.
- `enter` switches to the selection and closes the dialog. A remote row
  switches to a local branch of the same short name, creating a tracking
  branch if none exists. Git carries uncommitted work or refuses the switch.
- `ctrl-n` asks for a new branch name, starting from the selected branch
  or HEAD. It creates and switches to the branch. `ctrl-r` renames a local
  branch. Invalid names keep the input open with Git's error.
- `ctrl-d` asks before deleting a local branch. If Git says it is not fully
  merged, a second confirmation offers force deletion. Remote rows cannot
  be renamed or deleted.
- `ctrl-f` fetches all remotes with pruning. `ctrl-l` pulls the current
  branch with fast-forward only. `ctrl-p` pushes the selected local branch,
  never forced. Without an upstream it uses origin, else the first remote,
  and sets tracking. With an upstream it pushes to that remote branch.
- `ctrl-s` stashes tracked and untracked changes. `ctrl-o` pops the newest
  stash. Git keeps the stash if popping conflicts. Counts refresh afterward.
- `esc` cancels an input or question, then clears a nonempty filter, then
  closes. Actions are blocked while Git runs. Sync and stash actions keep
  the dialog open and refresh the list. A successful switch shows a toast.

## Built from

- `mods/branch/main.js` draws the view, `git.js` executes Git, `parse.js`
  parses, sorts and filters refs, and `kit/` contains the shared UI parts.
- `mod.json`: `place: "none"`, title "Branch", and a dialog overlay with
  width 640, height 0.7 and `frame: "none"`. `keys.json` maps
  `ctrl-shift-y` to `mod.open:branch`.
- `props.folder` selects an explicit local folder. Otherwise the active
  space's focused pane folder is preferred, then other panes in its active
  tab, then other tabs, then the space's original folder. Its machine is
  passed to `exec`. Optional `props.filter` initializes the search.
- Uses `spaces`, `panes`, `props`, `exec`, `nextCommand`, `notify` and
  `closeOverlay` from `herdr`, and native InputState and ScrollHandle.
  Commands are also available as `herdr-app do branch.<command>`.
- Git commands: `rev-parse`, `for-each-ref`, `switch`, `branch`, `remote`,
  `fetch --all --prune`, `pull --ff-only`, `push`, `status --porcelain`,
  `stash list`, `stash push --include-untracked` and `stash pop`.
  Arguments are separate array items, never shell strings. Network sync
  commands allow 120 seconds. Other commands use the app's default timeout.
- `preview.png` is the screenshot-based promotional image. `thumbnail.png`
  holds the same artwork.

## Watch out

- Requires Git on the space's machine. It reads repository files and can
  change branches, refs and working files. Fetch, pull and push contact
  the repo's configured remotes and use its existing authentication.
- Merge, rebase, commit editing and worktree navigation are not provided.
  Git refuses switching to a branch checked out in another worktree.
- Ahead/behind marks reflect the last fetched remote refs. The dialog
  loads when opened and after actions, with no periodic refresh.
- Status failures currently count as zero changed files or stashes.
- The filter retains keyboard focus, so action shortcuts use Ctrl. Plain
  letters always type into the filter. No per-row letter shortcuts.
- Editing kit files must happen in the root `kit/`, followed by
  `node scripts/sync-kit.mjs`.

## Done when

- `herdr-app check branch/mods/branch` passes.
- Opening inside a repo shows its branches, current dot, commit subjects
  and upstream marks. Opening outside one shows a clear error.
- Filtering and arrow/Ctrl navigation keep the selected row visible.
- Switching local and remote branches, creating and renaming branches,
  and canceling or confirming deletion behave as described.
- Fetch, fast-forward pull, push, stash and pop refresh the list and show
  errors without losing the dialog. Test mutations in a disposable repo.
