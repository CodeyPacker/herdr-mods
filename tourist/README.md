# tourist

Claude or Codex gives you a guided tour of your code: branch changes, the last commit, a pull request, the whole repo, or a feature you describe.

![tourist](preview.png?v=68814ec14e94)

Claude or Codex gives you a guided tour of your code. Press `ctrl-shift-g`, pick what to tour (branch changes, the last commit, an open pull request, the whole repo, or a feature you describe), pick a depth, and the agent walks you through it file by file. A pull request tour is a guided review: the stops are grouped by the problem or feature each change serves, most important first, and each one shows that file's diff. Click a diff line to leave a comment. On a peer's PR, `p` posts your comments to GitHub as one review (Comment, Approve or Request changes). On your own PR, `f` has the agent fix your comments in a separate worktree, and you review its diff before pushing it to the PR's branch or discarding it.

`j` next, `k` back, `shift-j`/`shift-k` scroll the code, `d` deeper, `t` more technical, `a` ask, `o` open in VS Code, `s` switches between split and stacked (wide panes start split), `z` zooms the pane to full size and back, `q` ends the tour. `a` on the setup screen switches between Claude and Codex. The gear (or `,`) opens the settings, where any shortcut can be switched off or moved to another key. Needs the `claude` or `codex` CLI signed in, and `gh` signed in for pull requests.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/tourist
```

By hand: copy `mods/tourist` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.

[`RECIPE.md`](RECIPE.md) has the full details, including what it runs on your machine.
