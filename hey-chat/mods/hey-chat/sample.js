// Sample projects and chats, shown until the agents are connected (scope A4 to A6).
// Each chat: { id, project, agent, title, time, stamp, thread }. A thread item is a message:
//   { kind: "sep", text }                                  a day divider
//   { kind: "text", from: "me" | "agent", text, time? }    a bubble
//   { kind: "code", from: "agent", lang, text }            a code card
//   { kind: "tool", from: "agent", icon, title, lines, add?, del? }  a tool call card

/** @typedef {{ id: string, path: string }} Project */
/** @typedef {{ id: string, kind: string, from?: string, text?: string, time?: string, lang?: string, icon?: string, title?: string, lines?: string[], add?: string, del?: string }} Message */
/** @typedef {{ id: string, project: string, agent: string, title: string, time: string, stamp: number, thread: Message[] }} Chat */

/** @type {Project[]} */
export const PROJECTS = [
  { id: "herdr-mods", path: "~/projects/herdr-mods" },
  { id: "pensieve", path: "~/projects/pensieve" },
  { id: "dotfiles", path: "~/.dotfiles" },
];

/** @returns {Chat[]} a fresh copy, so a view can change its own */
export function sampleChats() {
  return [
    {
      id: "tour", project: "herdr-mods", agent: "claude", title: "Keep the open tour", time: "9:46 AM", stamp: 5,
      thread: [
        { id: "e0", kind: "sep", text: "Today 8:55 AM" },
        { id: "e1", kind: "text", from: "me", text: "Before the tour fix: where does Tourist keep its settings?" },
        { id: "e2", kind: "text", from: "agent", text: "In two places. Per-pane choices like the agent go in localStorage. The full screen switch is shared state, so the key's tiny overlay copy can read it." },
        { id: "e3", kind: "tool", from: "agent", icon: "file", title: "Read 3 files", lines: ["tourist/mods/tourist/main.js", "tourist/mods/tourist/constants.js", "kit/shortcuts.js"] },
        { id: "e4", kind: "text", from: "me", text: "Why can't the overlay copy read localStorage?" },
        { id: "e5", kind: "text", from: "agent", text: "Each mod copy gets its own localStorage. The overlay is a separate copy from the pane, so it would read an empty one." },
        { id: "e6", kind: "text", from: "agent", text: "Shared state is the one place every copy sees." },
        { id: "e7", kind: "text", from: "me", text: "Got it. And the keys?" },
        { id: "e8", kind: "text", from: "agent", text: "They live in constants.js as SHORTCUTS, and the settings panel lets you turn each one off or rebind it:" },
        { id: "e9", kind: "code", from: "agent", lang: "javascript", text: "export const SHORTCUTS = [\n  { id: \"next\", key: \"j\", label: \"Next stop\" },\n  { id: \"prev\", key: \"k\", label: \"Previous stop\" },\n  { id: \"zoom\", key: \"z\", label: \"Zoom the pane\" },\n];" },
        { id: "e10", kind: "text", from: "me", text: "Can a rebound key clash with another one?" },
        { id: "e11", kind: "text", from: "agent", text: "The panel refuses a key another shortcut already has, and says which one." },
        { id: "e12", kind: "text", from: "me", text: "Nice" },
        { id: "e13", kind: "text", from: "me", text: "What about the agent switch, is that saved per repo?" },
        { id: "e14", kind: "text", from: "agent", text: "No, it's one choice for every repo, saved under agent. Per repo would mean a key per root folder. Want that?" },
        { id: "e15", kind: "text", from: "me", text: "No, one is fine." },
        { id: "e16", kind: "tool", from: "agent", icon: "run", title: "Ran git log --oneline -5", lines: ["54a0ee4 tourist: the open tour is kept when its pane closes", "3481e18 tourist: its key closes the pane when it's open", "d1cc78a tourist: leaves its background clear"] },
        { id: "e17", kind: "text", from: "agent", text: "For context, the last three commits were all Tourist. The pane closing and zooming work landed yesterday." },
        { id: "c0", kind: "sep", text: "Today 9:41 AM" },
        { id: "c1", kind: "text", from: "me", text: "The tourist pane loses the open tour when I close it. Can you fix that?" },
        { id: "c2", kind: "text", from: "agent", text: "Yes. Closing the pane drops its state, so the tour is gone when it reopens. I'll keep it in shared state instead." },
        { id: "c3", kind: "tool", from: "agent", icon: "file", title: "Read 2 files", lines: ["tourist/mods/tourist/main.js", "kit/theme.js"] },
        { id: "c4", kind: "tool", from: "agent", icon: "edit", title: "Edited main.js", add: "+14", del: "−3", lines: ["tourist/mods/tourist/main.js"] },
        { id: "c5", kind: "text", from: "agent", text: "Done. Close the pane and reopen it. The tour is right where you left it." },
        { id: "c6", kind: "text", from: "me", text: "Works. Does it survive a restart?" },
        { id: "c7", kind: "text", from: "me", text: "Like if I quit Herdr" },
        { id: "c8", kind: "text", from: "agent", text: "Not yet. Shared state lives in memory, so a restart clears it. I can save it to disk:" },
        { id: "c9", kind: "code", from: "agent", lang: "javascript", text: "const file = `${appHome()}/data/tourist/open.json`;\nawait writeTextFile(file, JSON.stringify(tour));" },
        { id: "c10", kind: "text", from: "me", text: "Yes, do that.", time: "9:46 AM" },
      ],
    },
    {
      id: "sync", project: "herdr-mods", agent: "codex", title: "Kit sync", time: "Yesterday", stamp: 4,
      thread: [
        { id: "x0", kind: "sep", text: "Yesterday 4:12 PM" },
        { id: "x1", kind: "text", from: "me", text: "Run the kit sync and tell me which mods changed." },
        { id: "x2", kind: "tool", from: "agent", icon: "run", title: "Ran node scripts/sync-kit.mjs", lines: ["islands/mods/islands-pane/kit", "tourist/mods/tourist/kit", "tickets/mods/tickets/kit"] },
        { id: "x3", kind: "text", from: "agent", text: "Three mods picked up the new seeThroughFill helper: islands, tourist and tickets. The rest were already current." },
        { id: "x4", kind: "text", from: "me", text: "Perfect, thanks" },
        { id: "x5", kind: "text", from: "agent", text: "Want me to commit them on staging?" },
      ],
    },
    {
      id: "board", project: "pensieve", agent: "claude", title: "Board loads slowly", time: "Mon", stamp: 3,
      thread: [
        { id: "p0", kind: "sep", text: "Monday 2:08 PM" },
        { id: "p1", kind: "text", from: "me", text: "The board takes a few seconds to open. Why?" },
        { id: "p2", kind: "text", from: "agent", text: "It reads every task file on open. I added a small index so it only reads the ones that changed." },
      ],
    },
    {
      id: "readme", project: "pensieve", agent: "codex", title: "README pass", time: "Sun", stamp: 2,
      thread: [
        { id: "r0", kind: "sep", text: "Sunday 11:30 AM" },
        { id: "r1", kind: "text", from: "me", text: "Tighten the README install steps." },
        { id: "r2", kind: "tool", from: "agent", icon: "edit", title: "Edited README.md", add: "+9", del: "−22", lines: ["README.md"] },
        { id: "r3", kind: "text", from: "agent", text: "Cut it from six steps to three." },
      ],
    },
    {
      id: "zsh", project: "dotfiles", agent: "claude", title: "Faster shell start", time: "Nov 12", stamp: 1,
      thread: [
        { id: "d0", kind: "sep", text: "November 12" },
        { id: "d1", kind: "text", from: "me", text: "zsh takes a second to start. Can you find what's slow?" },
        { id: "d2", kind: "text", from: "agent", text: "nvm was loading on every start. I made it load the first time you run node." },
      ],
    },
  ];
}
