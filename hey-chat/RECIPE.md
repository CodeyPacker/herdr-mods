# Hey, chat

A pane for chatting with Claude Code or Codex in a Messenger-style conversation, with
every chat grouped by the folder it runs in. The design it follows is
[Hey, chat on claude.ai](https://claude.ai/artifact/Dro245hBgKy5FC98g9WrC2), and
[`SCOPE.md`](SCOPE.md) has the decisions behind it.

## What you see

Two cards side by side, 10 px apart, each with 14 px corners and a 1 px `border`.
The card with the keyboard has a faint `foreground` border (20%), a little lighter than `border`.

The sidebar (320 px):

- No title (Herdr's pane header names the mod). At the top, a search box with a
  pencil to its right that starts a new chat in the open chat's folder. Typing
  in the search box filters chats by title, last message and folder name,
  hides Recent, and opens every folder with a match. "No chats match." when
  none do.
- Recent: the two chats with the newest messages, from any folder. Each preview
  starts with the folder's name.
- One row per folder: a chevron, a folder icon, its name, its chat count, a
  `+` that starts a chat there, and a trash button that asks to delete all its
  chats. Folders are sorted by their newest chat.
- Under an open folder, its chats, newest first: the agent's picture (34 px),
  the title, the time ("9:46 AM" today, "Yesterday", "Mon", "Nov 12"), a
  preview of the last message ("You: ..." for yours), and an unread dot. The
  open chat has the `selected` fill. While the agent works the preview reads
  "Thinking…" in `working`, and "Waiting for you" in `blocked` while it waits
  on a permission.
- At the bottom, a button that hides the sidebar (left) and the Settings gear
  (right). Only the gear opens Settings.
- While the sidebar has the keyboard, the cursor's row has a `foreground` outline (35%)
  and the kit's key legend shows above the bottom row.

The chat:

- A header: while the sidebar is hidden, a button that shows it, then the agent's picture (40 px) with a status dot, the chat title,
  "Claude · Ready" (or "Thinking…", "Waiting for you", "Loading…"), a chip with
  the folder's path, search and details buttons (not wired yet), and a trash
  button that asks to delete the chat.
- Messages. Back-to-back messages from one sender form a group: 2 px apart,
  18 px corners with 5 px on the joined side, the sender's picture (28 px)
  beside the group's last one. Groups are 14 px apart, with a day divider
  ("Today 9:41 AM") when a new day or an hour-long gap starts.
  - Yours: `accent` bubbles on the right, `accent_foreground` text.
  - The agent's: `raised` bubbles on the left, rendered as Markdown.
  - Tool calls: a card with an icon (read, edit, run), a title ("Running
    git status" while it runs, then "Ran git status", "Edited main.js +14
    −3"), and a chevron. A click shows the files, or the command and its
    output. A tool cut off by a stop reads "(stopped)".
  - Permission cards: "Claude wants to run git push origin staging", the
    command or a diff (+ lines `ansi2`, − lines `ansi1`), and how it was
    answered. While it waits, a `blocked` border and the three answers as buttons.
  - Errors in a bubble with a `blocked` border. "Stopped." under a stopped turn.
  - Your last message, when nothing follows it, shows "Delivered", then "Read
    <time>" once the agent starts on it.
  - Three dots in a bubble while the agent works.
- The message box: a `+` (attach, not wired yet), a rounded input with
  "Message Claude" (or Codex) and a `⌃j ⌃k scroll` hint, and a round send
  button, `accent` when there's text. While the agent works the button is a
  stop button and the hint adds `⌃c stop`. While a permission waits, the box
  is a bar with the question and Allow once, Always allow and Deny.
- A new chat shows the agent's picture (72 px), "New chat in <folder>" and a
  Claude / Codex switch. The first message picks the title (its first 32
  characters) and the agent.

The delete question, a `raised` card with a `blocked` border above the sidebar's
bottom row: "Delete “<title>”?", "Its Claude session is deleted for good."
(or Codex), and Delete (filled `blocked`, with a ring: it has the focus, so
`enter` or `y` presses it) and Cancel (`n`). For a folder: "Delete all 12
chats in “herdr-mods”?", "Their Claude and Codex sessions are deleted for good.
The folder on your disk isn't touched.", and "Deleting 3 of 12…" while it runs. "Deleting…"
while it runs, and the reason in `blocked` if it fails.

Settings, a solid `popover` card above the bottom row: your picture (72 px)
with Upload photo and Use initials, six built-in pictures (sunset, mountains,
waves, orbit, bloom, blocks) with a ring on the chosen one, an initials box, and
six initials colors. Dropping an image on the card uses it as your photo.
Below a line, a "Show key hints" switch (on by default, shared state
`hey-chat.keyHints`). Off, it hides the sidebar's key legend, the message box's
`⌃j ⌃k scroll` hint, and the key letters on the permission and delete buttons.
The keys still work.

Claude's picture is a `#D97757` circle with a white 12-ray starburst. Codex's
is a near-black circle with a faint ring and a white `>_`, not OpenAI's logo.

Opacity follows the kit: the mod's own background is `paneBackground(...)`
(clear over the background picker's see-through panes), fills come from
`colors()` so bubbles, cards, rows and boxes fade with the panes, and `accent`,
`border` and `popover` stay solid.

## How it behaves

- `ctrl-a c` (from `keys.json`) opens a tiny overlay copy that toggles: it closes
  the Hey, chat pane in the shown tab, or splits the focused pane right with
  one, passes the focused terminal's folder as `props.folder`, and zooms it to
  fill the tab (`ctrl-shift-z` gives the split back).
- The pane opens on a new chat in that folder, with the message box focused.
  A new chat you leave without writing in is dropped.
- Keys (the view's `on_key_down`, so only while Hey, chat has the keyboard):
  - `ctrl-h` sidebar (showing it if it's hidden), `ctrl-l` message box, `ctrl-b`
    hides or shows the sidebar, `ctrl-j` / `ctrl-k` scroll the chat
    one message from anywhere (holding repeats), `ctrl-c` stops a turn.
  - Sidebar: `j`/`k` or the arrows move, `l`, `enter` or right opens a chat or
    a folder (`enter` on an open folder closes it), `h` or left closes the
    cursor's folder, `g`/`G` first and last row, `d` asks to delete the
    cursor's chat (on a folder row: every chat in that folder),
    `v` starts or ends a selection, `esc` back to the message box. The list scrolls to keep the
    cursor in view.
  - A selection: `v`, or shift with `j`/`k` or the arrows, starts one at the
    cursor. `j`, `k`, `g`, `G` (and the shifted keys) extend it, `d` asks to
    delete every chat it covers ("Delete 7 chats?"), `esc` or `v` ends it, and
    any other key ends it first. Shift-click on a chat selects from the cursor
    to it. Selected chats have the `selected` fill. Folder rows inside a
    selection are skipped, and a chat in both Recent and its folder counts once.
    The key legend reads `j k extend · d delete · esc cancel`.
  - The delete question: `enter` or `y` deletes, `n` or `esc` cancels. Other keys wait.
  - A waiting permission: `y` allow once, `a` always allow, `n` deny.
  - Settings: `esc` closes it.
  - Inside the message box `ctrl-h` and `ctrl-k` would delete text. The view
    handles them first.
- Hiding the sidebar gives the chat the pane's whole width. It stays hidden
  across panes and restarts (shared state `hey-chat.sidebarHidden`). Hiding it
  while it has the keyboard moves the keyboard to the message box. The delete
  question shows it again.
- Folders you open or close stay that way (shared state `hey-chat.collapsed`).
  A folder you've never touched starts closed, except the one you opened from.
- Opening a chat with a session shows its last 40 messages you sent and what
  followed, read from the session file. If its bridge is still running, the
  file gives what came before the bridge started and the bridge replays the rest.
- Sending: the first message in a chat starts its bridge (below), then each
  message is one turn. The agent's text, tool calls and permission questions
  arrive as they happen, one message at a time (not word by word).
- Permissions: the agent does what your own settings allow (Claude's
  `.claude/settings*.json`, Codex's `config.toml` and sandbox) and asks for the
  rest. When a question arrives in a pane that isn't in front, Herdr's
  `blocked` sound plays.
  - Claude's Always allow writes a rule to the folder's
    `.claude/settings.local.json`: `Bash(<first word>:*)`, or the first two
    words for `git`, `gh`, `npm` and the like, or the tool's name for other
    tools. It also applies at once for the rest of the bridge's run.
  - Codex's Always allow is `acceptForSession`: that exact command, for the
    rest of the session.
- Stop: Claude gets SIGINT, ends the turn, and is let go. The next message
  starts it again with `--resume`. Codex gets `turn/interrupt`.
- Deleting a chat ends its bridge, then removes its session for good: Claude's
  `<id>.jsonl` and the `<id>/` folder beside it, or `codex delete --force <id>`.
  The next chat in its folder opens, or a new one there. A chat with no messages
  is only dropped.
- Deleting a folder deletes its chats one at a time, the same way. Once none are
  left, the folder leaves the sidebar. A chat that can't be deleted stays, and
  the question shows why. The folder on disk is never touched.
- A chat in the background that finishes a turn gets an unread dot.
- Times are formatted by hand: Herdr's JavaScript ignores
  `toLocaleTimeString`'s options.

## Built from

- `mods/hey-chat/main.js`: the `View`, its state, the launcher, chats and folders,
  focus, sending, permissions and Settings. It uses:
  - `agent.js`: finding `node`, `claude` and `codex` (one `command -v` loop),
    listing and reading sessions through `sessions.mjs`, and `Bridge`, one
    chat's link to its bridge.
  - `bridge.mjs`: the bridge, a Node program (below).
  - `sessions.mjs`: a Node program, `list` and `read` (below).
  - `messages.js`: bridge events to messages, the words for tool and permission
    cards, and times.
  - `store.js`: `<appHome>/data/hey-chat/chats.json`, the chats made here
    (id, folder, agent, title, session id, time) and their folders. Messages
    aren't copied.
  - `me.js`: your picture, in shared state `hey-chat.me`, and copying a photo in.
  - `pictures.js`: the round pictures. `keys.js`: the keys and chat scrolling.
  - `views/`: `tree.js` (the sidebar), `chat.js` (the chat), `settings.js`.
  - `icons/`, `pictures/` (the six built-in pictures), and `kit/` (this repo's
    kit, copied in by `node scripts/sync-kit.mjs`: theme colors, the legend).
- `mod.json`: `{ "place": "none", "focusable": true, "title": "Hey, chat", "overlay": { "kind": "popup", "width": 1, "height": 1, "frame": "none" } }`.
- The bridge. `exec` stops after 30 s and a turn can wait on you much longer,
  so each chat gets `node bridge.mjs serve --chat <id> --agent claude|codex
  --cwd <folder> --state <appHome>/data/hey-chat/bridges [--resume <session>]`,
  started with `hc run --bg --no-parent --outlive-parent --label
  hey-chat=bridge`. It listens on `127.0.0.1`, writes `{ port, pid, cwd,
  agent, startedAt }` to `<state>/<chat>.json`, and the pane talks to it over
  the `net` module, one JSON object per line. A pane that connects gets every
  event since the bridge started. The bridge ends on `quit`, or after 30
  minutes with no pane connected and no turn running.
  - Claude: `claude -p --input-format stream-json --output-format stream-json
    --verbose --permission-prompt-tool mcp__heychat__approve --mcp-config
    <json>`, one process for many turns. The MCP config starts `node
    bridge.mjs mcp --port <port>`, a stdio MCP server with one tool,
    `approve`, which asks the bridge and answers `{ behavior: "allow",
    updatedInput }` or `{ behavior: "deny", message }`.
  - Codex: `codex app-server`, JSON-RPC over stdio: `initialize`,
    `thread/start` or `thread/resume`, `turn/start`, `turn/interrupt`. The
    server's `item/commandExecution/requestApproval` and
    `item/fileChange/requestApproval` requests become permission cards, answered
    `accept`, `acceptForSession` or `decline`. Other server requests are turned
    down. Tested with codex-cli 0.162.1.
- `sessions.mjs list` reads the first 1 MB and last 256 KB of each
  `~/.claude/projects/<folder>/<session>.jsonl` and
  `~/.codex/sessions/**/rollout-*.jsonl`, with Codex's titles from
  `~/.codex/session_index.jsonl`. It leaves out sessions in temporary folders,
  `~/Library`, Herdr's own data folder and folders that no longer exist,
  sessions with nothing you typed, and Codex helper threads. `sessions.mjs read`
  turns one file into the bridge's event shapes. `sessions.mjs delete` removes a
  session: Claude's only when the file is `<id>.jsonl` directly inside a
  `~/.claude/projects/<folder>/`, Codex's with `codex delete --force <id>`. All
  three run through `exec node`.
- `herdr`: `exec`, `hc`, `readTextFile`, `writeTextFile`, `appHome`, `home`,
  `panes`, `focused`, `props`, `run`, `shared`/`setShared`, `playSound`,
  `nextCommand`, `closeOverlay`, `window().platform`, `checking`.
- `gpui-base`: `InputState`/`Input`, `ScrollHandle`, `TextView.markdown`.

## Watch out

- Needs `node`, and `claude` or `codex` on `PATH`, signed in. Each turn uses your
  plan's usage, like the CLI does.
- The agent works with your normal permissions in that folder, not a read-only
  mode. What your settings allow runs without asking.
- Claude's Always allow writes to the folder's `.claude/settings.local.json`,
  as Claude's own "don't ask again" does. Remove a rule there to be asked again.
- `codex app-server` is experimental, so a Codex update can change its protocol.
  A refused call shows as an error in the chat.
- Windows isn't supported: the bridge and session reader are started with `sh`.
- Upload photo uses `osascript` on macOS (cropped square with `sips`, saved as a
  192 px JPEG in `<appHome>/data/hey-chat/`) and `zenity` on Linux (copied as it
  is). Dropping an image on Settings works everywhere.
- Deleting a chat can't be undone: `claude --resume` and Codex can't open the
  session again.
- History shows the last 40 messages you sent in a chat.
- A bridge keeps running after the pane closes, so a turn can finish. It ends
  itself after 30 idle minutes. `hc ls` shows them, labelled `hey-chat=bridge`.
- Panes that are already open keep the old code after an edit. Close the pane
  and reopen it.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/hey-chat` passes.
- `ctrl-a c` opens the pane full screen on a new chat in the current folder, and
  the sidebar fills with your sessions.
- Sending "create a file called test.txt" in a new Claude chat shows a
  permission card. `y` allows it and the file exists. The same for Codex with a
  command outside its sandbox.
- Opening an older session shows its history, and a follow-up message
  continues it.
- `ctrl-h`, `j`, `k`, `l` move through the sidebar, and `ctrl-j`/`ctrl-k` scroll
  a long chat.
