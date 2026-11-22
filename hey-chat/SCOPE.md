# Hey, chat: scope

A Herdr pane for chatting with Claude Code or Codex in a Messenger-style
conversation instead of a terminal. Chats are grouped by project folder, each
agent has its own profile picture, and you can set yours.

Design: [Hey, chat on claude.ai](https://claude.ai/artifact/Dro245hBgKy5FC98g9WrC2).
It is a working prototype: press Play on the artboard to try the keys, tree
and settings. Where this file and the design disagree, this file wins.

## 1. Layout

Two cards side by side inside one mod pane, 12 px apart, each with 14 px
corners and a 1 px `border`.

- **Sidebar (left, 320 px):** a search box with a new-chat button to its
  right (no title: Herdr's pane header names the mod), the project tree, and
  a bottom row with a button that hides the sidebar and a settings gear.
- **Chat (right, fills the rest):** a header, the message list, and the
  message box.

The card with the keyboard gets a faint text-color border. The other keeps the
plain `border` color.

## 2. Project tree

- **Recent** sits at the top: the two chats with the newest messages, from any
  project. Each row is the same as a chat row below, with the project name
  added to the preview line ("herdr-mods · You: ..."). A chat in Recent also
  stays in its project.
- One row per project folder: a chevron, a folder icon, the folder's name and
  its chat count. Clicking the row opens or closes it. Hovering shows a **+**
  that starts a new chat in that folder.
- Under an open project, one row per chat, newest first: the agent's picture
  (34 px), the chat title, the time of the last message, a one-line preview
  and an unread dot.
- The preview reads "You: ..." for your last message, the tool title for a
  tool call, "Sent a code snippet" for code, and "Thinking..." in the
  `working` color while the agent runs.
- The open chat's row has the `selected` fill.
- A project is a folder an agent has worked in. The list comes from Hey,
  chat's own chats plus the existing Claude and Codex sessions on this machine
  (section 8).
- Search filters chats by title and message text across every project.
- `d` on a chat (or the trash button in its header) asks "Delete …?" with
  `y` / `n`. Deleting removes the session for good: Claude's session file and
  folder, or `codex delete --force` (D5). `d` on a folder (or its trash
  button) deletes every chat in it the same way. The folder on disk is never
  touched. `v` (or shift with `j`/`k`, the arrows or a click) selects a run of
  chats, and `d` deletes them all after one question.

## 3. Chat view

**Header:** the agent's picture (40 px) with a status dot, the chat title,
"Claude · Active now" (or "Thinking..." in `working` while it runs), a chip
with the project path, and search and details buttons.

**Messages:**

| Kind | Looks like |
|---|---|
| Your message | Accent-filled bubble on the right, white text, your picture at the end of a group |
| Agent text | `raised` bubble on the left, agent picture at the end of a group |
| Code | `raised` card with a language label, a copy button and a monospace block |
| Tool call | Card with an icon (read, edit, run), a title like "Read 2 files" or "Edited main.js +14 −3", and a chevron. Clicking shows the files or command |
| Day divider | Centered dim text, "Today 9:41 AM" |
| Typing | Agent bubble with three bouncing dots while the agent runs |

- Back-to-back messages from the same sender form a group: 2 px apart, with
  5 px corners on the joined side and 18 px elsewhere. Groups are 14 px apart.
- Hovering a message shows reply and copy buttons.
- Your last message shows "Delivered" until the agent starts working on it,
  then "Read <time>" (D3).
- Agent text renders markdown (bold, lists, inline code, links). `path:line`
  links open the file, as in Tourist.
- The list scrolls to the bottom on a new message.

**Message box:** a + button (attach a file, later), a rounded text input with
the placeholder "Message Claude" and a `⌃j ⌃k scroll` hint, and a round send
button that is accent-filled only when there is text. Enter sends.

**New chat:** an empty screen with the agent's picture, "New chat in
<project>", and a Claude / Codex switch. The first message picks the title
(its first 32 characters) and locks the agent for that chat.

## 4. Profile pictures

- **Claude:** a `#D97757` circle with a white 12-ray starburst.
- **Codex:** a near-black circle with a faint ring and a white `>_` prompt.
  It must not copy OpenAI's logo.
- **You:** set in Settings. Upload a photo (cropped to a square, saved at
  192 px), pick one of six built-in pictures (sunset, mountains, waves, orbit,
  bloom, blocks), or use one or two initials on one of six colors. The default
  is "Me" on violet.

## 5. Settings

Opened by the bottom row of the sidebar (your picture and a gear icon). A
solid `popover` card above the row with:

1. Your picture: preview, Upload photo, Remove photo.
2. "Or pick one": the six built-in pictures.
3. Initials and initials color.

Saved in `localStorage` (the photo as a small JPEG data URL).

## 6. Opacity rules

Follow the kit (`kit/theme.js`), so the pane matches the background picker's
see-through panes:

- The mod's own background is `paneBackground(...)`: clear when the panes are
  see-through, because the pane frame already draws the theme background at
  the panes' opacity.
- Fills come from `colors()`, so `background`, `raised`, `hover`,
  `selected` and `input` (bubbles, cards, rows, the message box) fade with the
  panes.
- `accent` (your bubbles, the send button), `border` and `popover` (the
  settings card) stay solid.
- No blur. Herdr can't draw one.
- Theme colors only, no hard-coded hex, except the two agent pictures and the
  built-in pictures.

## 7. Keys

| Key | Where | Does |
|---|---|---|
| `ctrl-h` | anywhere | Focus the tree |
| `ctrl-l` | anywhere | Focus the message box |
| `ctrl-b` | anywhere | Hide or show the sidebar (remembered). `ctrl-h` shows it too |
| `ctrl-j` / `ctrl-k` | anywhere | Scroll the chat down / up. Holding repeats. The message box keeps focus |
| `j` / `k`, arrows | tree | Move the cursor |
| `l`, `enter`, right | tree | Open the chat (focuses the message box) or open the project |
| `h`, left | tree | Close the project the cursor is in |
| `g` / `G` | tree | First / last row |
| `esc` | tree | Back to the message box |
| `enter` | message box | Send |

- The message box is focused when the pane opens, when a chat opens and when
  a new chat starts.
- With the tree focused, the cursor row gets a faint text-color outline and a key hint
  strip shows above the bottom row (the kit's legend).
- These are mod keys (`on_key_down` in the view), not `keys.json` bindings,
  so they only act while Hey, chat has the keyboard. Inside the text input,
  `ctrl-h` and `ctrl-k` would normally delete text. The mod takes them first.
- `ctrl-a c` (your `ctrl-a` prefix, free today) opens and closes the pane, as
  `ctrl-a t` does for Tourist (D2). It goes in `hey-chat/keys.json` as
  `"ctrl-a c": "mod.open:hey-chat"`.

## 8. Running the agents

Both agents run through their own CLIs, signed in with your subscription
(`claude` with your Claude account, `codex` with your ChatGPT account). No API
keys.

- Find `claude` and `codex` with one `command -v` call, as Tourist does
  (`tourist/mods/tourist/agent.js`). Hide the switch for a missing one. With
  neither, the pane says the CLI is needed.
- `exec` stops anything over 30 s, and a turn that waits on your permission
  can take much longer. So each chat gets a small Node program, `bridge.mjs`,
  started in a hidden terminal with `hc run --bg --no-parent --outlive-parent
  --cwd <project>`. The bridge runs the agent, keeps it alive between turns,
  and talks to the mod over a local socket (the `net` module, as Portal uses).
  It ends when the chat closes or after 30 minutes idle.
- **Claude:** `claude -p --input-format stream-json --output-format
  stream-json --verbose --permission-prompt-tool mcp__heychat__approve
  --mcp-config <file>`, plus `--resume <session_id>` for an existing chat. The
  MCP config points at the bridge itself as a stdio MCP server with one tool,
  `approve`.
- **Codex:** `codex app-server` (JSON-RPC over stdio, the protocol Codex's own
  apps use). `codex exec` can't ask for permission, so it isn't used. The
  app-server is marked experimental, so pin the tested Codex version in the
  README and fail with a clear message on a protocol error.
- Stream: each event becomes one message kind from section 3 as it arrives
  (text, tool call, code), not only at the end.
- Stop: a stop button replaces send while the agent runs, and `ctrl-c` in the
  message box stops the turn. The chat stays open.

**Permissions (D1):** the agent works with your normal settings for that
folder (`.claude/settings.json` allow rules, Codex's `config.toml`). Anything
those don't allow becomes a permission card in the chat:

- An agent-side card with the tool and what it wants, for example "Run `git
  push origin staging`" or "Edit `tourist/mods/tourist/main.js`" with a
  collapsed diff.
- Buttons **Allow once**, **Always allow** (Claude: this command pattern for
  the folder; Codex: this exact command, for the rest of the session) and
  **Deny**, with keys `y`, `a` and `n`
  while the card is the newest message.
- The status line reads "Waiting for you" in the `blocked` color, the tree
  row shows the same, and Herdr's attention sound plays if the pane isn't
  focused.
- The bridge holds the agent until you answer. Claude's `approve` tool returns
  `{"behavior":"allow"}` or `{"behavior":"deny","message":...}`. Codex gets
  the matching app-server approval reply.

**Existing sessions:** list Claude's from `~/.claude/projects/<folder>/*.jsonl`
and Codex's from `~/.codex/sessions/**/rollout-*.jsonl` (the folder is in the
`session_meta` line). Opening one shows its history and resumes it on send.

## 9. Saved data

- `<appHome>/data/hey-chat/chats.json`: per chat, the id, project folder,
  agent, title, agent session id, unread flag and last-message time.
- Messages are not copied. They are read back from the agent's own session
  file.
- `localStorage`: your picture, initials, color, and the open/closed state of
  each project.

## 10. Files

Follows the repo's mod layout:

- `hey-chat/README.md`, `RECIPE.md`, `keys.json`, `preview.png`,
  `thumbnail.png`
- `hey-chat/mods/hey-chat/`: `mod.json`, `main.js` (view, state, keys),
  `agent.js` (find the CLIs, talk to the bridge), `bridge.mjs` (runs one
  chat's agent, the `approve` MCP tool and the socket), `sessions.js` (existing sessions),
  `messages.js` (events to message kinds), `pictures.js` (agent and built-in
  pictures), `views/` (tree, chat, settings), and `kit/` from
  `node scripts/sync-kit.mjs`.

## 11. Not in this scope

- Attaching files and images (the + button stays, disabled).
- Reactions, replies to a single message, editing or deleting messages.
- Chats with more than one agent.
- Light-theme tuning beyond what theme colors give.
- Syncing chats between machines.

## 12. Build order

1. **A1:** Pane, layout and opacity rules with sample data, matching the design.
2. **A2:** Keys and focus.
3. **A3:** Settings and profile pictures.
4. **A4:** The bridge and Claude: run, stream, resume, stop, permission cards.
5. **A5:** Codex through `codex app-server`: the same.
6. **A6:** Existing sessions in the tree, Recent, and search.
7. **A7:** README, RECIPE, preview images, root README entry.

## 13. Decisions

- **D1:** The agent does whatever your settings allow and asks in the chat
  for the rest (section 8). It works with both subscription logins.
- **D2:** `ctrl-a c` opens and closes the pane. It opens zoomed to fill the
  tab (`pane.zoom`, so `ctrl-shift-z` gives the split back).
- **D3:** "Read" means the agent started working on your message.
- **D4:** A Recent section with the last two chats sits above the projects.
- **D5:** Deleting a chat removes its Claude or Codex session for good, after a
  y/n question.
