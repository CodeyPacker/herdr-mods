# Hey, chat

Chat with Claude Code or Codex in a Messenger-style pane instead of a terminal, with every chat grouped by the folder it's in.

Press `ctrl-a c` and Hey, chat opens full screen on a new chat in the folder you're in. The sidebar lists every Claude and Codex session on your computer by folder, with the two newest under Recent. Opening one shows its history, and sending a message picks it up where it left off. Search filters by title, last message and folder. Replies come in as bubbles, with a card for each file the agent reads, edits or command it runs. When the agent needs your permission, the message box turns into a question with Allow once (`y`), Always allow (`a`) and Deny (`n`). Claude and Codex each have their own picture, and the gear at the bottom of the sidebar sets yours: a photo, a built-in picture, or initials on a color. Settings can also hide the key hints.

`ctrl-h` moves to the sidebar and `ctrl-l` back to the message box. `ctrl-b` hides or shows the sidebar, as do the button at the bottom left of the sidebar and, while it is hidden, the one at the left of the chat header. In the sidebar, `j`/`k` move, `l` opens a chat or folder, `h` closes the folder, `g`/`G` jump to the top and bottom, and `d` deletes a chat (after `enter`). The trash button in a chat's header does the same. `d` on a folder, or its trash button, deletes every chat in it. `v` (or shift with `j`/`k`, the arrows or a click) selects several chats, and `d` deletes them all. Deleting removes the Claude or Codex sessions for good, and never touches the folder on your disk. `ctrl-j`/`ctrl-k` scroll the chat while you keep typing, and `ctrl-c` stops a turn. Needs `node` and the `claude` or `codex` CLI on `PATH`, signed in. macOS and Linux.

## Install

Tell your agent:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/CodeyPacker/herdr-mods/tree/main/hey-chat
```

By hand: copy `mods/hey-chat` (or symlink it) into `~/.config/herdr-app/mods/`, then add the key from [`keys.json`](keys.json) to your `~/.config/herdr-app/keys.json`.

[`RECIPE.md`](RECIPE.md) has the full details, including what it runs on your machine.
