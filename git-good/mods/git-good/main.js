// Git Good: a dialog for the everyday git work of the repo the current space is in. The changed
// files are on the left in two lists (staged, and not staged), the selected file's diff is on
// the right, and the commit box is under the files. Each key is also a command:
// `herdr-app do git-good.<command>`.
//
// The keyboard is on the file list or on the diff. ctrl-h puts it on the list, ctrl-l on the
// diff. j/k (or the arrows) move the selection in the list, and scroll the diff when it is there.
// Keys: space or enter stages or unstages the selected file, a stages all, u unstages all,
// d discards (asks first), c writes in the commit box, g asks Claude for a message, m amends,
// b opens the branches, l pulls, p pushes, s stashes (asks first), o pops, v switches the diff between one
// column and two, f fills the window, r reads everything again, ? shows or hides the key list, esc closes.
// In the commit box: ctrl-enter commits, esc goes back to the list.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Textarea, TextareaState, ScrollHandle, VirtualListScrollHandle, Scrollbar, v_virtual_list } from "gpui-base";
import { spaces, panes, props, closeOverlay, nextCommand, settings } from "herdr";
import { colors, SIZE, focusBorder } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { legend, hint } from "./kit/legend.js";
import { listRow, listNote } from "./kit/list.js";
import { sectionLabel } from "./kit/pane.js";
import { textInput, spinner, chip, toolButton } from "./kit/controls.js";
import { repoOf, loadStatus, loadBranches, loadLog, loadDiff, stage, unstage, stageAll, unstageAll, discard, applyHunk, commit, lastMessage, pull, push, switchTo, trackBranch, createBranch, stash, stashPop } from "./git.js";
import { listBranches, hunkPatch, unifiedRows, splitRows, compareFiles } from "./parse.js";
import { writeMessage } from "./ai.js";
import { Shortcuts } from "./kit/shortcuts.js";
import { hasTourist, openTourist, openTouristPage } from "./tourist.js";
import { languageOf, colorRows } from "./syntax.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").AsyncContext} AsyncContext */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("herdr").PaneInfo} PaneInfo */
/** @typedef {import("./parse.js").FileEntry} FileEntry */
/** @typedef {import("./parse.js").Branch} BranchInfo */
/** @typedef {import("./parse.js").Diff} Diff */
/** @typedef {import("./parse.js").Commit} Commit */
/** @typedef {import("./parse.js").Side} Side */
/** @typedef {import("./syntax.js").Token} Token */
/** @typedef {import("./parse.js").UnifiedRow | import("./parse.js").SplitRow} DiffRow */
/** @typedef {import("./git.js").Repo} Repo */
/** @typedef {import("./git.js").GitResult} GitResult */
/** @typedef {ReturnType<typeof colors>} Theme */
/** The line under the panes. `bad` is true for an error, false for plain news. @typedef {{ text: string, bad: boolean }} Note */
/** A question in a dialog. `yes` names the button that does it, `run` does it, `danger` colors the button for a change that cannot be undone. @typedef {{ title: string, body: string, yes: string, no: string, danger: boolean, run: (cx: Context | AsyncContext) => void }} Question */

/** The mod's folder name: its icons live there. */
const MOD = "git-good";
const ICON = { branch: `mods/${MOD}/branch.svg`, sparkle: `mods/${MOD}/sparkle.svg`, expand: `mods/${MOD}/expand.svg`, shrink: `mods/${MOD}/shrink.svg` };
/**
 * The dialog's size when it does not fill the window. Its overlay always covers the window
 * (mod.json), and the dialog is drawn inside it at this size, so full screen is only a bigger
 * box: nothing is opened again and nothing is read again.
 */
const DIALOG = { width: 1040, height: /** @type {const} */ ("85%") };
/** The file column's width, in the dialog and in full screen. */
const FILES_W = 330;
const FILES_W_FULL = 380;
/** The log's height under the files, in full screen. */
const LOG_H = 230;
/** A diff line's height, a hunk heading's height, and a guess at one letter's width at the diff's text size. */
const LINE_H = 20;
const HUNK_H = 28;
const LETTER_W = 7.4;
/** How many lines j or k scroll the diff. */
const SCROLL_LINES = 3;
/** The keyboard is taken again this long after the dialog opens, once the app has placed it. */
const REFOCUS_MS = 600;

/** The command each key stands for while the keyboard is on the list or the diff. @type {Record<string, string>} */
const KEYS = {
  up: "up", k: "up", down: "down", j: "down", space: "toggle", enter: "toggle",
  a: "stage-all", u: "unstage-all", d: "discard", c: "message", g: "generate", m: "amend",
  b: "branches", l: "pull", p: "push", s: "stash", o: "pop", v: "view", f: "full", r: "refresh", t: "tour",
  "ctrl-h": "focus-list", "ctrl-l": "focus-diff", escape: "cancel", "?": "keys", "shift-/": "keys", ",": "settings",
};
/** The commands that still work while git finishes a file toggle. */
const FREE = new Set(["up", "down", "focus-list", "focus-diff", "toggle", "view", "keys", "settings"]);
/**
 * The keys a user can turn off in the settings. Each id is the command its key runs. The keys
 * that move around (j, k, ctrl-h, ctrl-l), esc, ? and , always work, and so does every button.
 * @type {import("./kit/shortcuts.js").Shortcut[]}
 */
const SHORTCUTS = [
  { id: "toggle", key: "space", what: "stage or unstage" }, { id: "stage-all", key: "a", what: "stage all" },
  { id: "unstage-all", key: "u", what: "unstage all" }, { id: "discard", key: "d", what: "discard" },
  { id: "message", key: "c", what: "message" }, { id: "generate", key: "g", what: "generate" },
  { id: "amend", key: "m", what: "amend" }, { id: "branches", key: "b", what: "branches" },
  { id: "pull", key: "l", what: "pull" }, { id: "push", key: "p", what: "push" },
  { id: "stash", key: "s", what: "stash" }, { id: "pop", key: "o", what: "pop" },
  { id: "view", key: "v", what: "unified or split" }, { id: "full", key: "f", what: "full screen" },
  { id: "refresh", key: "r", what: "refresh" },
  // Listed only when Tourist is installed.
  { id: "tour", key: "t", what: "tour the branch in Tourist" },
];
/** The same while the branches are open: their filter box has the keyboard, so every action is a ctrl key. @type {Record<string, string>} */
const BRANCH_KEYS = { up: "up", "ctrl-k": "up", down: "down", "ctrl-j": "down", "ctrl-enter": "branch-new", escape: "cancel" };
/**
 * Esc in one of the mod's text boxes. The app closes the top dialog on esc before the mod's key
 * handler hears of it, so each text box sits in this key context, where esc is bound to the
 * mod's own action. The nearest binding wins, and the action steps back without closing.
 */
const BOX_CONTEXT = "GitGoodTextBox";
const BACK_ACTION = "git-good-back";
/** After esc closes the branches or leaves the commit box, a second esc this soon does not close the dialog, in milliseconds. */
const ESC_GAP_MS = 300;

/**
 * Where the space is right now: the folder of the focused pane of the tab it shows, then any
 * pane in that tab, then any pane in the space, then where the space was created.
 * @param {SpaceInfo} s @param {PaneInfo[]} ps @returns {string | null}
 */
function folderOf(s, ps) {
  const tabs = s.tabs ?? [];
  const shown = new Set(tabs.filter((c) => c.active).map((c) => c.id));
  const all = new Set(tabs.map((c) => c.id));
  return ps.find((p) => shown.has(p.tab) && p.focused && p.cwd)?.cwd
    || ps.find((p) => shown.has(p.tab) && p.cwd)?.cwd
    || ps.find((p) => all.has(p.tab) && p.cwd)?.cwd
    || s.folder || null;
}

/** A faint wash of a theme color, behind an added or a removed line. @param {string} color @returns {import("./kit/theme.js").Color} */
function tint(color) {
  return /** @type {any} */ (`${color}22`);
}

/** A row's name across reloads: a file can be in both lists. @param {FileEntry | undefined} f */
function keyOf(f) {
  return f ? `${f.staged ? "s" : "c"}:${f.path}` : "";
}

/** "1 file" or "3 files". @param {number} n @param {string} word */
function count(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default class GitGood extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    const p = props() ?? {};
    /** @type {Repo | null | undefined} null when the folder is not in a repo, undefined while the first load runs */
    this.repo = undefined;
    /** @type {string | null} the machine the repo is on, null for this computer */
    this.on = null;
    /** @type {string} the folder the repo was looked for in */
    this.folder = "";
    /** @type {FileEntry[]} */
    this.staged = [];
    /** @type {FileEntry[]} */
    this.changes = [];
    /** @type {number} */
    this.stashes = 0;
    /** @type {BranchInfo[]} */
    this.branches = [];
    /** @type {string} the current branch's name */
    this.head = "";
    /** @type {Commit[]} */
    this.commits = [];
    /** @type {number} the selected file's place in items() */
    this.at = 0;
    /** @type {string} a row to select once the first load is in, as keyOf names it */
    this.want = String(p.select ?? "");
    /** @type {"list" | "diff"} which pane j and k act on */
    this.focus = "list";
    /** The settings panel: whether the dialog opens filling the window, and a switch per shortcut key. */
    this.shortcuts = new Shortcuts({ mod: MOD, keys: SHORTCUTS, rebind: true, hints: false, options: [{ id: "full", label: "Open in full screen" }] });
    /** @type {boolean} the dialog fills the window */
    this.full = Boolean(p.full ?? (p.overlay !== undefined && this.shortcuts.option("full")));
    /** @type {boolean} the diff shows old and new side by side */
    this.split = Boolean(p.split ?? this.full);
    /** @type {Diff | null} the selected file's diff */
    this.diff = null;
    /** @type {string} what the diff pane says when it has no diff */
    this.diffNote = "";
    /** @type {string} the row the diff belongs to, as keyOf names it */
    this.diffFor = "";
    this.diffPath = ""; // the file the diff is of: its ending picks the code colors
    /** @type {number} counts diff loads, so a slow one cannot replace a newer one */
    this.diffLoad = 0;
    /** @type {DiffRow[]} the diff's rows in the current view */
    this.rows = [];
    /** @type {boolean} the diff is drawn in two columns: split is chosen and the diff has both removed and added lines */
    this.sideBySide = false;
    /** @type {number[]} each row's height */
    this.sizes = [];
    /** @type {number} the widest row, so the one-column view can scroll sideways */
    this.diffWidth = 0;
    /** @type {number} the diff pane's height in pixels, once it has been laid out */
    this.diffHeight = 0;
    /** @type {number} the diff row j and k last scrolled to */
    this.diffTop = 0;
    /** @type {Note | null} */
    this.note = null;
    /** @type {Question | null} the open question: a discard or a stash */
    this.asking = null;
    /** @type {boolean} true while a git command runs */
    this.busy = false;
    /** @type {number} file toggles git has not finished yet. The list already shows them done. */
    this.pending = 0;
    /** @type {number} counts toggles, so only the last one reads the files again */
    this.toggles = 0;
    /** @type {Promise<void>} the toggles, run one after another */
    this.queue = Promise.resolve();
    /** @type {string} the error of a toggle git refused */
    this.failed = "";
    /** @type {Map<string, { diff: Diff | null, note: string }>} each row's last read diff, shown at once while it is read again */
    this.diffs = new Map();
    /** @type {boolean} true while Claude writes a message */
    this.writing = false;
    /** @type {number} counts message requests, so a stopped one is ignored when it comes back */
    this.request = 0;
    /** @type {boolean} the next commit replaces the last one */
    this.amend = false;
    /** @type {boolean} the commit box has the keyboard */
    this.typing = false;
    /** @type {boolean} the branches are open */
    this.branching = false;
    /** @type {number} when esc last closed the branches or left the commit box, as Date.now() */
    this.steppedBack = 0;
    /** @type {number} the selected branch row */
    this.branchAt = 0;
    this.handle = cx.focus_handle();
    cx.bind_keys([{ keystroke: "escape", action: BACK_ACTION, context: BOX_CONTEXT }]);
    this.message = TextareaState.new({ placeholder: "Commit message", value: String(p.message ?? "") });
    /** @type {boolean} the commit box holds text */
    this.hasMessage = Boolean(this.message.value().trim());
    this.message.on("change", (_e, cx) => {
      const has = Boolean(this.message.value().trim());
      if (has !== this.hasMessage) { this.hasMessage = has; cx.notify(); }
    });
    this.message.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.message.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    // Plain enter is a new line. Enter with ctrl (cmd on a Mac) commits.
    this.message.on("submit", (e, cx) => { if (e?.secondary) this.command("commit", cx); });
    this.branchFilter = InputState.new({ placeholder: "Filter, or name a new branch" });
    this.branchFilter.on("change", (_e, cx) => { this.branchAt = 0; this.revealBranch = true; cx.notify(); });
    // Plain enter switches. Enter with ctrl (cmd on a Mac) makes a new branch with the typed name.
    this.branchFilter.on("submit", (e, cx) => this.command(e?.secondary ? "branch-new" : "branch-switch", cx));
    this.listScroll = ScrollHandle.new();
    this.branchScroll = ScrollHandle.new();
    this.diffScroll = VirtualListScrollHandle.new();
    /** True after the selection moves, until the next render scrolls to it. */
    this.reveal = true;
    this.revealBranch = false;
    this.handle.focus();
    cx.timer.after(REFOCUS_MS, () => { if (!this.typing && !this.branching) this.handle.focus(); });
    /** @type {boolean | undefined} Tourist is installed. Undefined until that is known. */
    this.tourist = undefined;
    cx.spawn(async (cx) => {
      this.tourist = await hasTourist();
      // Without Tourist its key is not a setting.
      if (!this.tourist) this.shortcuts.keys = this.shortcuts.keys.filter((k) => k.id !== "tour");
      cx.notify();
    });
    cx.spawn((cx) => this.reload(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.handle.focus();
        else if (c) this.command(c, cx);
        cx.notify();
      }
    });
  }

  /** Closes the dialog. Placed as a layout block there is nothing to close. */
  close() {
    const overlay = props()?.overlay;
    if (overlay !== undefined) closeOverlay(overlay);
  }

  /** Every file row in list order: staged first. @returns {FileEntry[]} */
  items() {
    return [...this.staged, ...this.changes];
  }

  /** The selected file row. @returns {FileEntry | undefined} */
  selected() {
    return this.items()[this.at];
  }

  /** The branch that is checked out, when one is. @returns {BranchInfo | undefined} */
  current() {
    return this.branches.find((b) => b.kind === "local" && b.current);
  }

  /**
   * Finds the repo and reads its files, branches and log, then the selected file's diff. The
   * selection stays on the same row when it is still there, else at the same place.
   * @param {Context | AsyncContext} cx
   */
  async reload(cx) {
    const given = props()?.folder;
    const space = given ? null : spaces().find((s) => s.active);
    const folder = given ? String(given) : (space ? folderOf(space, panes()) : null) ?? "";
    const on = space?.machine ?? null;
    // The repo of a folder does not change, so it is looked up once per folder.
    const known = this.repo && folder === this.folder && on === this.on ? this.repo : null;
    this.folder = folder;
    this.on = on;
    this.diffs.clear();
    const repo = known ?? (folder ? await repoOf(folder, on) : null);
    const was = this.want || keyOf(this.selected());
    this.want = "";
    if (!repo) {
      this.repo = null;
      this.staged = [];
      this.changes = [];
      this.branches = [];
      this.commits = [];
      this.setDiff(null, "", "");
      cx.notify();
      return;
    }
    const [status, branches, commits] = await Promise.all([loadStatus(repo, this.on), loadBranches(repo, this.on), loadLog(repo, this.on)]);
    this.repo = repo;
    this.staged = status.staged;
    this.changes = status.changes;
    this.stashes = status.stashes;
    this.branches = branches.branches;
    this.head = branches.head;
    this.commits = commits;
    this.note = status.error ? { text: status.error, bad: true } : null;
    const items = this.items();
    const same = items.findIndex((f) => keyOf(f) === was);
    this.at = Math.max(0, Math.min(same >= 0 ? same : this.at, items.length - 1));
    this.reveal = true;
    cx.notify();
    await this.openDiff(cx);
  }

  /**
   * Reads the changed files again, and the selected file's diff. For commands that change no
   * branch and no commit. It gives way to a toggle git has not finished: that one reads again.
   * @param {Context | AsyncContext} cx
   */
  async refreshFiles(cx) {
    const repo = this.repo;
    if (!repo) return;
    const status = await loadStatus(repo, this.on);
    if (this.pending || repo !== this.repo) return;
    if (status.error) this.say(status.error);
    else {
      const was = keyOf(this.selected());
      this.staged = status.staged;
      this.changes = status.changes;
      this.stashes = status.stashes;
      const items = this.items();
      const same = items.findIndex((f) => keyOf(f) === was);
      this.at = Math.max(0, Math.min(same >= 0 ? same : this.at, items.length - 1));
      this.reveal = true;
    }
    cx.notify();
    await this.openDiff(cx);
  }

  /**
   * Reads the selected file's diff and shows it. A diff read before is shown at once, and
   * replaced when the new read comes back.
   * @param {Context | AsyncContext} cx
   */
  async openDiff(cx) {
    const file = this.selected();
    const repo = this.repo;
    const load = ++this.diffLoad;
    if (!file || !repo) {
      this.setDiff(null, "", "");
      cx.notify();
      return;
    }
    const key = keyOf(file);
    const before = this.diffs.get(key);
    if (before) {
      this.setDiff(before.diff, before.note, key, file.path);
      cx.notify();
    }
    const r = await loadDiff(repo, this.on, file);
    if (repo === this.repo) this.diffs.set(key, r);
    if (load !== this.diffLoad) return;
    this.setDiff(r.diff, r.note, key, file.path);
    cx.notify();
  }

  /**
   * Shows a diff. A new file's diff starts at its top. The same file's diff, read again, stays where it was.
   * @param {Diff | null} diff @param {string} note @param {string} key the row it belongs to @param {string} [path] the file's path
   */
  setDiff(diff, note, key, path = "") {
    const moved = key !== this.diffFor;
    this.diff = diff;
    this.diffNote = note;
    this.diffFor = key;
    this.diffPath = path;
    this.buildRows();
    if (moved) this.scrollDiff(0);
  }

  /** Makes the diff's rows for the current view. */
  buildRows() {
    // Two columns need both sides. A deleted or a new file, or a diff that only adds or only
    // removes, would leave one column empty, so it is drawn in one.
    const lines = this.diff ? this.diff.hunks.flatMap((h) => h.lines) : [];
    this.sideBySide = this.split && lines.some((l) => l[0] === "-") && lines.some((l) => l[0] === "+");
    /** @type {DiffRow[]} */
    this.rows = this.diff ? (this.sideBySide ? splitRows(this.diff) : unifiedRows(this.diff)) : [];
    colorRows(this.rows, languageOf(this.diffPath));
    this.sizes = this.rows.map((r) => r.kind === "@" ? HUNK_H : LINE_H);
    let longest = 0;
    for (const r of this.rows) if ("text" in r && r.text.length > longest) longest = r.text.length;
    this.diffWidth = Math.ceil(longest * LETTER_W) + 130;
  }

  /**
   * Puts a diff row at the top of the diff pane. The list can only bring a row to the middle
   * for certain, so the row half a pane below the wanted top is centered.
   * @param {number} row
   */
  scrollDiff(row) {
    const fits = Math.max(1, Math.floor(this.diffHeight / LINE_H));
    this.diffTop = Math.max(0, Math.min(row, this.rows.length - fits));
    if (!this.rows.length) return;
    // The very top is asked for by its own row: centering a row further down left the first
    // hunk's heading, which is taller than a line, half out of sight.
    if (this.diffTop === 0) this.diffScroll.scroll_to_item(0, "top");
    else this.diffScroll.scroll_to_item(Math.min(this.diffTop + Math.floor(fits / 2), this.rows.length - 1), "center");
  }

  /** Selects a file row and shows its diff. @param {number} i @param {Context | AsyncContext} cx */
  select(i, cx) {
    this.at = i;
    this.reveal = true;
    cx.spawn((cx) => this.openDiff(cx));
  }

  /** j and k: the next file in the list (wrapping), or a few lines of the diff. @param {number} by -1 for up, 1 for down @param {Context | AsyncContext} cx */
  move(by, cx) {
    if (this.focus === "diff") return this.scrollDiff(this.diffTop + by * SCROLL_LINES);
    const n = this.items().length;
    if (n) this.select((this.at + by + n) % n, cx);
  }

  /** Sets the note to an error or a refusal. @param {string} text */
  say(text) {
    this.note = { text, bad: true };
  }

  /** Esc: closes the question, then the branches, then leaves the commit box, then closes the dialog. @param {Context | AsyncContext} cx */
  cancel(cx) {
    if (this.asking) this.asking = null;
    else if (this.shortcuts.open) this.shortcuts.back();
    else if (this.branching) this.stepBack(cx, () => this.closeBranches());
    else if (this.typing) this.stepBack(cx, () => this.handle.focus());
    // The same esc can arrive again after the keyboard moved out of a text box. It must not close the dialog too.
    else if (Date.now() - this.steppedBack > ESC_GAP_MS) this.close();
  }

  /**
   * Esc out of a text box: `leave` moves the keyboard back to the dialog. It runs after this
   * key press is over, so the press is not handed on to the dialog as a second esc.
   * @param {Context | AsyncContext} cx @param {() => void} leave
   */
  stepBack(cx, leave) {
    this.steppedBack = Date.now();
    cx.spawn(async (cx) => {
      this.steppedBack = Date.now();
      leave();
      cx.notify();
    });
  }

  /**
   * Does what a key, a button or a `herdr-app do git-good.<command>` asks. While git runs,
   * nothing. While a question is open, only "yes" and "cancel".
   * @param {string} c @param {Context | AsyncContext} cx
   */
  command(c, cx) {
    if (c === "stop") {
      this.request++;
      this.writing = false;
      cx.notify();
      return;
    }
    if (this.busy || (this.pending && !FREE.has(c))) return;
    this.note = null;
    if (c === "cancel") this.cancel(cx);
    else if (this.asking) { if (c === "yes") this.yes(cx); }
    else if (this.branching) this.branchCommand(c, cx);
    else if (this.shortcuts.command(c)) { /* the settings panel took it */ }
    else if (c === "up") this.move(-1, cx);
    else if (c === "down") this.move(1, cx);
    else if (c === "focus-list" || c === "focus-diff") {
      this.focus = c === "focus-list" ? "list" : "diff";
      this.handle.focus();
    }
    else if (c === "toggle") { const f = this.selected(); if (f) this.toggle(f, cx); }
    else if (c === "stage-all") { if (this.changes.length) this.act(cx, (repo) => stageAll(repo, this.on), undefined, true); }
    else if (c === "unstage-all") { if (this.staged.length) this.act(cx, (repo) => unstageAll(repo, this.on), undefined, true); }
    else if (c === "discard") {
      const f = this.selected();
      if (f?.staged) this.say("Unstage the file first. Discard only throws away changes that are not staged");
      else if (f) this.asking = {
        title: f.untracked ? `Delete ${f.path}?` : `Discard the changes to ${f.path}?`,
        body: `${f.untracked ? "Git does not have this file, so it is deleted. " : ""}This cannot be undone.`,
        yes: f.untracked ? "Delete" : "Discard",
        no: "Keep the file",
        danger: true,
        run: (cx) => this.act(cx, (repo) => discard(repo, this.on, f), () => `Discarded the changes to ${f.path}`, true),
      };
    }
    else if (c === "message") this.message.focus();
    else if (c === "commit") this.commit(cx);
    else if (c === "generate") this.generate(cx);
    else if (c === "amend") this.toggleAmend(cx);
    else if (c === "branches") this.openBranches();
    else if (c === "pull") this.pull(cx);
    else if (c === "push") this.push(cx);
    else if (c === "stash") {
      if (!this.items().length) this.say("Nothing to stash");
      else {
        const n = this.items().length;
        this.asking = {
          title: `Stash ${n === 1 ? "1 changed file" : `${n} changed files`}?`,
          body: "Every change, staged or not, and files git does not have yet are put aside. o brings them back.",
          yes: "Stash",
          no: "Keep the changes",
          danger: false,
          run: (cx) => this.act(cx, (repo) => stash(repo, this.on), () => "Stashed the changes", true),
        };
      }
    }
    else if (c === "pop") {
      if (!this.stashes) this.say("No stash to pop");
      else this.act(cx, (repo) => stashPop(repo, this.on), () => "Popped the newest stash", true);
    }
    else if (c === "view") {
      this.split = !this.split;
      this.buildRows();
      this.scrollDiff(0);
    }
    else if (c === "full") this.toggleFull();
    else if (c === "keys") {
      this.shortcuts.setOption("hints", !this.shortcuts.showHints);
    }
    else if (c === "refresh") cx.spawn((cx) => this.reload(cx));
    else if (c === "tour") this.tour();
    cx.notify();
  }

  /**
   * Runs one git command with the spinner showing, then reads everything again. Git's error,
   * or `done`'s words, go to the note.
   * @param {Context | AsyncContext} cx @param {(repo: Repo) => Promise<GitResult>} run
   * @param {(r: GitResult) => string} [done] the note after a success
   * @param {boolean} [filesOnly] the command changes no branch and no commit, so only the files are read again
   */
  act(cx, run, done, filesOnly) {
    const repo = this.repo;
    if (!repo || this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      cx.notify();
      const r = await run(repo);
      this.busy = false;
      /** @type {Note | null} */
      const note = r.ok ? (done ? { text: done(r), bad: false } : null) : { text: r.err || "git failed", bad: true };
      await (filesOnly ? this.refreshFiles(cx) : this.reload(cx));
      // The reload clears the note, so it is set after.
      if (note) this.note = note;
      cx.notify();
    });
  }

  /** Stages a row that is not staged, unstages one that is. @param {FileEntry} f @param {Context | AsyncContext} cx */
  toggle(f, cx) {
    const repo = this.repo;
    const on = this.on;
    if (!repo || this.busy) return;
    // The list shows the move at once. Git runs behind it, one toggle after another, and the
    // files are read again after the last one.
    const moved = this.moveRow(f);
    const mine = ++this.toggles;
    this.pending++;
    this.queue = this.queue.then(async () => {
      const r = f.staged ? await unstage(repo, on, f.path) : await stage(repo, on, f.path);
      if (!r.ok) this.failed = r.err || "git failed";
      this.pending--;
    });
    cx.spawn(async (cx) => {
      // Git has not moved the file yet, so its diff cannot be read again: the one it had is shown.
      const kept = moved && keyOf(this.selected()) === keyOf(moved) ? this.diffs.get(keyOf(moved)) : undefined;
      if (moved && kept) {
        this.diffLoad++;
        this.setDiff(kept.diff, kept.note, keyOf(moved), moved.path);
        cx.notify();
      } else if (moved) await this.openDiff(cx);
      while (this.pending) await this.queue;
      if (mine !== this.toggles) return;
      const failed = this.failed;
      this.failed = "";
      await this.refreshFiles(cx);
      if (failed) { this.say(failed); cx.notify(); }
    });
  }

  /**
   * Moves a row to the other list before git has done it, with its diff. The selection goes to
   * the row that took its place, so the same key works down a list. Null when the list has to
   * wait for git: the file is in both lists, or in conflict.
   * @param {FileEntry} f @returns {FileEntry | null} the row in its new list
   */
  moveRow(f) {
    const from = f.staged ? this.staged : this.changes;
    const to = f.staged ? this.changes : this.staged;
    if (f.status === "!" || to.some((x) => x.path === f.path)) return null;
    const was = keyOf(this.selected());
    const i = from.indexOf(f);
    if (i < 0) return null;
    from.splice(i, 1);
    // A new file is "A" once staged and unknown to git again once unstaged.
    const untracked = f.staged && f.status === "A";
    /** @type {FileEntry} */
    const row = { ...f, staged: !f.staged, untracked, status: untracked ? "U" : f.status === "U" ? "A" : f.status };
    const place = to.findIndex((x) => compareFiles(x, row) > 0);
    to.splice(place < 0 ? to.length : place, 0, row);
    const diff = this.diffs.get(keyOf(f));
    if (diff) this.diffs.set(keyOf(row), diff);
    this.diffs.delete(keyOf(f));
    const items = this.items();
    const same = items.findIndex((x) => keyOf(x) === was);
    // A staged row leaves one more row above the changes, so the next change is one place down.
    const next = was === keyOf(f) && !f.staged ? this.at + 1 : this.at;
    this.at = Math.max(0, Math.min(same >= 0 ? same : next, items.length - 1));
    this.reveal = true;
    return row;
  }

  /** Yes to the open question. @param {Context | AsyncContext} cx */
  yes(cx) {
    const q = this.asking;
    this.asking = null;
    if (q) q.run(cx);
  }

  /** Stages one hunk of the shown diff, or takes it back out when the row is staged. @param {number} i @param {Context | AsyncContext} cx */
  hunk(i, cx) {
    const f = this.selected();
    const diff = this.diff;
    if (!f || !diff || keyOf(f) !== this.diffFor || this.busy || this.pending) return;
    this.note = null;
    this.act(cx, (repo) => applyHunk(repo, hunkPatch(diff, i), f.staged), undefined, true);
    cx.notify();
  }

  /** Whether the shown diff's hunks can be staged one by one. A file git does not know yet has to be staged whole. */
  hunksWork() {
    const f = this.selected();
    return Boolean(f && this.on === null && !f.untracked && f.status !== "!");
  }

  /** Commits the staged files with the commit box's text. @param {Context | AsyncContext} cx */
  commit(cx) {
    const message = this.message.value().trim();
    if (!message) return this.say("Write a commit message first");
    if (!this.staged.length && !this.amend) return this.say("Stage the files to commit first");
    // The last commit is on the remote when the branch has an upstream and no commits it lacks.
    const b = this.current();
    if (this.amend && b?.upstream && !b.gone && b.ahead === 0) {
      this.asking = {
        title: "Amend a commit you already pushed?",
        body: `${b.upstream} has the last commit. Amending rewrites it, so the next push is refused until you force-push outside Git Good.`,
        yes: "Amend",
        no: "Keep the commit",
        danger: true,
        run: (cx) => this.runCommit(cx, message, true),
      };
      // The question takes enter and esc, so the keyboard leaves the commit box.
      this.handle.focus();
      return;
    }
    this.runCommit(cx, message, this.amend);
  }

  /** Commits, or amends the last commit, with `message`. @param {Context | AsyncContext} cx @param {string} message @param {boolean} amend */
  runCommit(cx, message, amend) {
    this.act(cx, async (repo) => {
      const r = await commit(repo, this.on, message, amend);
      if (r.ok) {
        this.message.set_value("");
        this.hasMessage = false;
        this.amend = false;
        this.handle.focus();
      }
      return r;
    }, () => `${amend ? "Amended" : "Committed"}: ${message.split("\n")[0]}`);
  }

  /** Turns amend on or off. Turned on over an empty box, the box gets the last commit's message. @param {Context | AsyncContext} cx */
  toggleAmend(cx) {
    this.amend = !this.amend;
    const repo = this.repo;
    if (!this.amend || this.hasMessage || !repo) return;
    cx.spawn(async (cx) => {
      const last = await lastMessage(repo, this.on);
      if (!this.amend || this.hasMessage || !last) return;
      this.message.set_value(last);
      this.hasMessage = true;
      cx.notify();
    });
  }

  /** Asks Claude for a commit message for the staged files and puts it in the commit box. Nothing is committed. @param {Context | AsyncContext} cx */
  generate(cx) {
    const repo = this.repo;
    if (!repo || this.writing) return;
    if (!this.staged.length) return this.say("Stage the files to commit first. The message is written from the staged changes");
    this.writing = true;
    const request = ++this.request;
    cx.spawn(async (cx) => {
      const r = await writeMessage(repo, this.on);
      if (request !== this.request) return;
      this.writing = false;
      if (r.ok) {
        this.message.set_value(r.text);
        this.hasMessage = true;
      } else this.say(r.text);
      cx.notify();
    });
  }

  /** Pulls the current branch, fast-forward only. @param {Context | AsyncContext} cx */
  pull(cx) {
    const b = this.current();
    if (!b?.upstream) return this.say("The current branch has no upstream to pull from");
    this.act(cx, (repo) => pull(repo, this.on), () => `Pulled ${b.name}`);
  }

  /** Pushes the current branch, never forced. @param {Context | AsyncContext} cx */
  push(cx) {
    const b = this.current();
    if (!b) return this.say("No branch is checked out, so there is nothing to push");
    let remote = "";
    this.act(cx, async (repo) => {
      const r = await push(repo, this.on, b);
      remote = r.remote;
      return r;
    }, () => `Pushed ${b.name} to ${remote}`);
  }

  /** Closes Git Good and opens Tourist beside the focused pane, set to tour everything on the current branch. */
  tour() {
    if (!this.tourist) return this.say("Tourist is not installed. The settings say where to get it");
    if (!this.repo) return;
    const folder = this.on === null ? this.repo.top : null;
    this.close();
    openTourist(folder);
  }

  /** Switches the dialog between its own size and the whole window. Full screen shows the diff in two columns. */
  toggleFull() {
    if (props()?.overlay === undefined) return this.say("Full screen works when Git Good is open as a dialog");
    this.full = !this.full;
    if (this.split !== this.full) {
      this.split = this.full;
      this.buildRows();
      this.scrollDiff(0);
    }
    this.reveal = true;
  }

  /** The branch rows the filter keeps. @returns {BranchInfo[]} */
  branchRows() {
    return listBranches(this.branches, this.branchFilter.value());
  }

  /** Opens the branches and gives their filter the keyboard. */
  openBranches() {
    this.branching = true;
    this.branchAt = 0;
    this.branchFilter.set_value("");
    this.branchFilter.focus();
  }

  closeBranches() {
    this.branching = false;
    this.handle.focus();
  }

  /** A command while the branches are open. @param {string} c @param {Context | AsyncContext} cx */
  branchCommand(c, cx) {
    const rows = this.branchRows();
    if (c === "up" || c === "down") {
      if (rows.length) this.branchAt = (this.branchAt + (c === "up" ? -1 : 1) + rows.length) % rows.length;
      this.revealBranch = true;
    } else if (c === "branch-new") {
      const name = this.branchFilter.value().trim();
      if (!name) return this.say("Type a name for the new branch");
      this.closeBranches();
      this.act(cx, (repo) => createBranch(repo, this.on, name, "HEAD"), () => `Made ${name} and switched to it`);
    } else if (c === "branch-switch") {
      const b = rows[Math.max(0, Math.min(this.branchAt, rows.length - 1))];
      if (!b) return this.say("No branch matches. ctrl-enter makes a new one with that name");
      this.closeBranches();
      if (b.current) return;
      // A remote branch means its local branch of the same short name, made to track it when there is none.
      const name = b.kind === "remote" ? b.name.slice(`${b.remote}/`.length) : b.name;
      const track = b.kind === "remote" && !this.branches.some((l) => l.kind === "local" && l.name === name);
      this.act(cx, (repo) => track ? trackBranch(repo, this.on, b.name) : switchTo(repo, this.on, name), () => `Switched to ${name}`);
    }
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    // Ctrl with j or k is read from the key and its modifiers, so it works however the app spells the keystroke.
    const m = e.modifiers;
    const ctrlOnly = m.control && !m.shift && !m.alt && !m.platform;
    const k = ctrlOnly && (e.key === "j" || e.key === "k") ? `ctrl-${e.key}` : e.keystroke;
    let c = "";
    if (this.asking) c = k === "enter" || k === "y" ? "yes" : k === "escape" || k === "n" ? "cancel" : "";
    else if (this.branching) c = BRANCH_KEYS[k] ?? "";
    else if (this.shortcuts.open) { this.shortcuts.key(e, cx); return; }
    else if (this.typing) c = k === "escape" ? "cancel" : k === "ctrl-enter" ? "commit" : "";
    else {
      // The settings say which key each shortcut is on. A key the user gave to a shortcut wins.
      // The key a shortcut came with works only while the shortcut is still on it, and a second
      // key for the same command (enter, beside space) keeps working.
      c = this.shortcuts.idFor(k) || KEYS[k] || "";
      const own = SHORTCUTS.find((s) => s.id === c);
      if (own && (this.shortcuts.isOff(c) || (own.key === k && this.shortcuts.keyFor(c) !== k))) c = "";
    }
    if (!c) return;
    this.command(c, cx);
    cx.stop_propagation();
  }

  /**
   * Wraps a text box so esc in it steps back (see BOX_CONTEXT) and does not close the dialog.
   * @param {any} box the text box's element
   * @param {any} [over] an element drawn over the box, placed by itself (absolute)
   */
  escBox(box, over) {
    return v_flex().flex_none().relative().key_context(BOX_CONTEXT)
      .on_action(BACK_ACTION, (_e, cx) => { this.command("cancel", cx); cx.notify(); })
      .child(box)
      .when(Boolean(over), (el) => el.child(over));
  }

  /** The font the diff is drawn in. */
  mono() {
    return String(settings().font_family ?? "JetBrains Mono");
  }

  /**
   * A bordered button of the title row or the diff's header. Add its icon or text with `.child(...)`.
   * @param {Theme} t @param {string} id @param {string} tip @param {string} command
   */
  button(t, id, tip, command) {
    return toolButton(t, { id, tip, click: (cx) => this.command(command, cx) }).px(10).gap(6).text_size(12).text_color(t.foreground);
  }

  /** The title row's middle: the repo, the branch button, the counts, then pull, push and full screen. @param {Theme} t */
  details(t) {
    const b = this.current();
    const n = this.staged.length + this.changes.length;
    const counts = this.repo ? [n ? `${n} changed` : "no changes", this.staged.length ? `${this.staged.length} staged` : "", this.stashes ? `${this.stashes} stashed` : ""].filter(Boolean).join(" · ") : "";
    return h_flex().flex_1().min_w(0).gap(10).items_center()
      .child(div().flex_none().text_size(SIZE.small).text_color(t.dim).child(this.repo?.name ?? ""))
      .when(Boolean(this.repo), (el) => el.child(this.button(t, "gg-branch", "Branches (b)", "branches").px(9)
        .child(svg(ICON.branch).size(13).flex_none().text_color(t.accent))
        .child(div().max_w(260).truncate().child(this.head || "no branch"))
        .child(div().text_color(t.dim).child("▾"))))
      .child(div().flex_1().min_w(0).truncate().text_size(SIZE.small).text_color(t.dim).child(counts))
      .when(this.busy || this.pending > 0, (el) => el.child(spinner(t).flex_none()))
      .when(Boolean(this.repo), (el) => el
        .child(this.button(t, "gg-pull", "Pull, fast-forward only (l)", "pull").child(b?.behind ? `↓ Pull ${b.behind}` : "↓ Pull"))
        .child(this.button(t, "gg-push", "Push the current branch (p)", "push").child(b?.ahead ? `↑ Push ${b.ahead}` : "↑ Push")))
      .when(Boolean(this.repo && this.tourist), (el) => el.child(this.button(t, "gg-tour", "Tour everything on this branch in Tourist (t)", "tour").child("Tour")))
      .when(props()?.overlay !== undefined, (el) => el.child(this.button(t, "gg-full", this.full ? "Leave full screen (f)" : "Full screen (f)", "full").px(6)
        .child(svg(this.full ? ICON.shrink : ICON.expand).size(13).flex_none().text_color(t.foreground))))
      .child(this.shortcuts.button(t))
      // With the key list hidden there is no footer: the way back to it sits here, beside "Esc".
      .when(!this.shortcuts.showHints, (el) => el.child(hint(t, ["?", "keys"]).flex_none().text_size(SIZE.small)));
  }

  /** The heading over one of the two file lists, with its "all" link. @param {Theme} t @param {string} text @param {string} link @param {string} command */
  filesLabel(t, text, link, command) {
    return h_flex().flex_none().h(26).px(2).items_center().text_size(SIZE.small).text_color(t.dim)
      .child(div().flex_1().child(text))
      .child(div().id(`gg-${command}`).flex_none().text_color(t.accent).cursor_pointer().on_click((_e, cx) => this.command(command, cx)).child(link));
  }

  /** One file row: its status letter, name, folder, line counts and the stage or unstage button. @param {Theme} t @param {FileEntry} f @param {number} i its place in items() */
  fileRow(t, f, i) {
    const slash = f.path.lastIndexOf("/");
    const letter = { M: t.blocked, A: t.ansi2, D: t.ansi1, U: t.dim, "!": t.ansi1 }[f.status];
    return listRow(t, { id: `gg-file-${keyOf(f)}`, on: i === this.at, compact: true, click: (cx) => { this.focus = "list"; this.select(i, cx); cx.notify(); } })
      .px(10).gap(8)
      .child(div().w(12).flex_none().font_family(this.mono()).text_size(12).text_color(letter).child(f.status))
      .child(div().flex_none().max_w(190).truncate().text_color(t.foreground).child(f.path.slice(slash + 1)))
      .child(div().flex_1().min_w(0).truncate().text_size(SIZE.small).text_color(t.dim).child(f.path.slice(0, slash + 1)))
      .when(f.add > 0, (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.ansi2).child(`+${f.add}`)))
      .when(f.del > 0, (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.ansi1).child(`−${f.del}`)))
      .child(div().id(`gg-toggle-${keyOf(f)}`).w(22).h(22).flex_none().flex().items_center().justify_center().rounded(6)
        .border_1().border_color(t.border).bg(t.raised).text_color(t.foreground).cursor_pointer()
        .hover((s) => s.border_color(t.accent)).tooltip(f.staged ? "Unstage" : "Stage")
        .on_click((_e, cx) => { cx.stop_propagation(); if (!this.busy) { this.note = null; this.toggle(f, cx); } cx.notify(); })
        .child(f.staged ? "−" : "+"));
  }

  /** The two file lists, or one line saying why there are none. @param {Theme} t */
  files(t) {
    const list = v_flex().id("gg-files").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.listScroll).gap(2);
    if (this.repo === undefined) return list.child(listNote(t, spinner(t)));
    if (this.repo === null) return list.child(listNote(t, this.folder ? `Not a git repository: ${this.folder}` : "No folder to look for a repository in"));
    const items = this.items();
    if (!items.length) return list.child(listNote(t, "No changes. The folder matches the last commit"));
    const stagedLabel = this.staged.length > 0;
    const changesLabel = this.changes.length > 0;
    if (this.reveal) {
      // The row's place among the list's children, which counts the headings before it.
      this.listScroll.scroll_to_item(this.at + Number(stagedLabel) + Number(changesLabel && this.at >= this.staged.length));
      this.reveal = false;
    }
    return list.children(items.flatMap((f, i) => [
      ...(i === 0 && stagedLabel ? [this.filesLabel(t, `Staged · ${this.staged.length}`, "Unstage all", "unstage-all")] : []),
      ...(i === this.staged.length ? [this.filesLabel(t, `Changes · ${this.changes.length}`, "Stage all", "stage-all")] : []),
      this.fileRow(t, f, i),
    ]));
  }

  /** The current branch's newest commits, the ones not pushed yet first. Shown in full screen. @param {Theme} t */
  log(t) {
    const b = this.current();
    // Without an upstream there is no telling which commits were pushed, so none are marked.
    const ahead = b?.upstream ? b.ahead : 0;
    /** @param {Commit} c */
    const row = (c) => v_flex().flex_none().px(10).py(4).gap(1)
      .child(div().truncate().text_size(12.5).text_color(t.foreground).child(c.subject))
      .child(div().truncate().text_size(SIZE.small).text_color(t.dim).child(`${c.sha} · ${c.when}`));
    return v_flex().id("gg-log").flex_none().h(LOG_H).overflow_y_scrollbar()
      .children(this.commits.flatMap((c, i) => [
        ...(i === 0 && ahead > 0 ? [sectionLabel(t, `Not pushed · ${Math.min(ahead, this.commits.length)}`)] : []),
        ...(i === ahead ? [sectionLabel(t, b?.upstream ? `On ${b.upstream}` : "Recent commits")] : []),
        row(c),
      ]));
  }

  /** The commit box with its buttons: generate (or stop), amend and commit. @param {Theme} t */
  commitBox(t) {
    const ready = this.hasMessage && (this.staged.length > 0 || this.amend) && !this.busy && !this.pending && !this.writing;
    return v_flex().flex_none().gap(8)
      .child(this.escBox(Textarea.new(this.message).h(96).px(10).py(8).rounded(8).border_1().border_color(this.typing ? focusBorder(t) : t.input).bg(t.background).text_size(12.5).text_color(t.foreground),
        // The box's keys, over its bottom right corner while it has the keyboard. Drawn over the box so nothing moves.
        this.typing && this.shortcuts.showHints
          ? h_flex().absolute().bottom(6).right(10).gap(10).text_size(SIZE.small).child(hint(t, ["ctrl-enter", "commit"])).child(hint(t, ["esc", "back"]))
          : undefined))
      .child(h_flex().flex_none().gap(8).items_center()
        .child(this.writing
          ? this.button(t, "gg-stop", "Stop waiting for the message", "stop").h(32).child(spinner(t).flex_none()).child("Stop")
          : this.button(t, "gg-generate", "Claude writes a message from the staged changes (g)", "generate").h(32)
            .child(svg(ICON.sparkle).size(13).flex_none().text_color(t.accent)).child(this.hasMessage ? "Regenerate" : "Generate"))
        .child(this.amendSwitch(t))
        .child(div().flex_1())
        .child(h_flex().id("gg-commit").flex_none().h(32).px(14).items_center().rounded(8).text_size(12.5).font_semibold()
          .bg(ready ? t.solid : t.raised).text_color(ready ? t.solid_foreground : t.dim)
          .when(ready, (el) => el.cursor_pointer().on_click((_e, cx) => this.command("commit", cx)))
          .child(this.amend ? "Amend commit" : `Commit ${count(this.staged.length, "file")}`)));
  }

  /**
   * The Amend switch: off, the commit button makes a new commit. On, it replaces the last one.
   * Drawn as a switch with a knob, so it reads as a mode and not as a second commit button.
   * @param {Theme} t
   */
  amendSwitch(t) {
    const on = this.amend;
    return h_flex().id("gg-amend").flex_none().h(32).gap(7).items_center().cursor_pointer()
      .tooltip(on ? "On: the commit button replaces the last commit (m)" : "Off: the commit button makes a new commit (m)")
      .on_click((_e, cx) => this.command("amend", cx))
      .child(h_flex().flex_none().w(30).h(17).px(2).items_center().rounded(9).border_1()
        .border_color(on ? t.accent : t.border).bg(on ? t.accent : t.raised)
        .when(on, (el) => el.justify_end())
        .child(div().flex_none().size(11).rounded(6).bg(on ? t.background : t.muted)))
      .child(div().flex_none().text_size(11.5).text_color(on ? t.foreground : t.muted).child("Amend"));
  }

  /** A diff line's number column. @param {Theme} t @param {number | null} n */
  lineNumber(t, n) {
    return div().w(42).flex_none().text_right().text_color(t.dim).child(n === null ? "" : String(n));
  }

  /** A diff line's + or − column. @param {Theme} t @param {string} kind */
  sign(t, kind) {
    return div().w(22).flex_none().text_center().text_color(kind === "+" ? t.ansi2 : kind === "-" ? t.ansi1 : t.dim).child(kind === "-" ? "−" : kind === "+" ? "+" : "");
  }

  /**
   * A diff line's text. With pieces, each one is drawn in its color and a line too long is cut
   * off without the "…".
   * @param {Theme} t @param {string} text @param {Token[] | undefined} tokens
   */
  code(t, text, tokens) {
    if (!tokens?.length) return div().flex_1().min_w(0).truncate().child(text || " ");
    /** @type {Record<string, import("gpui-kit").Color>} */
    const tone = { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 };
    return h_flex().flex_1().min_w(0).overflow_hidden().whitespace_nowrap()
      .children(tokens.map((k) => div().flex_none().when(k.kind !== "", (el) => el.text_color(tone[k.kind])).child(k.text)));
  }

  /** One half of a split row. @param {Theme} t @param {Side | null} s */
  side(t, s) {
    const half = h_flex().flex_1().min_w(0).h_full().overflow_hidden();
    if (!s) return half.bg(t.surface);
    return half.when(s.kind === "+", (el) => el.bg(tint(t.ansi2))).when(s.kind === "-", (el) => el.bg(tint(t.ansi1)))
      .child(this.lineNumber(t, s.n)).child(this.sign(t, s.kind))
      .child(this.code(t, s.text, s.tokens));
  }

  /**
   * One row of the diff, in either view. The lazy list builds these while it lays out, where a
   * click handler is not allowed: a click on a hunk's heading comes through the list instead.
   * @param {Theme} t @param {DiffRow} r
   */
  diffRow(t, r) {
    if (r.kind === "@") {
      const staged = Boolean(this.selected()?.staged);
      return h_flex().w_full().h(HUNK_H).flex_none().px(10).gap(10).items_center().bg(t.raised).text_size(11).text_color(t.dim)
        .when(this.hunksWork(), (el) => el.cursor_pointer().child(div().flex_none().h(18).px(7).flex().items_center().rounded(5)
          .border_1().border_color(t.border).text_color(t.foreground).child(staged ? "Unstage hunk" : "Stage hunk")))
        .child(div().flex_1().min_w(0).truncate().child(r.text));
    }
    if (r.kind === "pair") {
      return h_flex().w_full().h(LINE_H).flex_none().text_color(t.foreground)
        .child(this.side(t, r.left)).child(div().w(1).h_full().flex_none().bg(t.border)).child(this.side(t, r.right));
    }
    if (r.kind === "") return div().w_full().h(LINE_H).flex_none().px(12).truncate().text_color(t.dim).child(r.text);
    return h_flex().w_full().h(LINE_H).flex_none().text_color(t.foreground)
      .when(r.kind === "+", (el) => el.bg(tint(t.ansi2))).when(r.kind === "-", (el) => el.bg(tint(t.ansi1)))
      .child(this.lineNumber(t, r.old)).child(this.lineNumber(t, r.next)).child(this.sign(t, r.kind))
      .child(this.code(t, r.text, r.tokens));
  }

  /** The diff pane: the file's name and buttons, then its diff. Its border is lit while j and k scroll it. @param {Theme} t */
  diffPane(t) {
    const f = this.selected();
    const slash = f ? f.path.lastIndexOf("/") : -1;
    const rows = this.rows;
    const lines = v_virtual_list("gg-diff", rows.length, this.sizes, (i) => String(i), (range) => rows.slice(range.start, range.end).map((r) => this.diffRow(t, r)))
      .track_scroll(this.diffScroll)
      .on_item_click((key, cx) => { const r = rows[Number(key)]; if (r?.kind === "@" && this.hunksWork()) this.hunk(r.hunk, cx); })
      .size_full();
    // A lazy list draws nothing without a height in pixels, so the pane reports its own.
    const body = div().id("gg-diff-body").flex_1().min_h(0).relative().font_family(this.mono()).text_size(12)
      .on_size_change((size, cx) => { if (size.height !== this.diffHeight) { this.diffHeight = size.height; cx.notify(); } });
    const sized = div().absolute().top(0).left(0).w_full().h(this.diffHeight);
    return v_flex().id("gg-diff-pane").flex_1().min_w(0).rounded(10).overflow_hidden().border_1().border_color(this.focus === "diff" ? focusBorder(t) : t.border).bg(t.background)
      .on_click((_e, cx) => { if (this.focus !== "diff") { this.focus = "diff"; cx.notify(); } })
      .child(h_flex().flex_none().h(40).px(12).gap(10).items_center().border_b_1().border_color(t.border)
        .child(h_flex().flex_1().min_w(0).font_family(this.mono()).text_size(12)
          .child(div().min_w(0).truncate().text_color(t.dim).child(f ? f.path.slice(0, slash + 1) : ""))
          .child(div().flex_none().text_color(t.foreground).child(f ? f.path.slice(slash + 1) : "No file selected")))
        .when(Boolean(f && f.add > 0), (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.ansi2).child(`+${f?.add}`)))
        .when(Boolean(f && f.del > 0), (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.ansi1).child(`−${f?.del}`)))
        .child(chip(t, { id: "gg-unified", label: "Unified", on: !this.split, click: (cx) => { if (this.split) this.command("view", cx); } }))
        .child(chip(t, { id: "gg-split", label: "Split", on: this.split, click: (cx) => { if (!this.split) this.command("view", cx); } }))
        .when(Boolean(f && !f.staged), (el) => el.child(this.button(t, "gg-discard", "Throw away this file's changes (d)", "discard").child("Discard")))
        .when(Boolean(f), (el) => el.child(this.button(t, "gg-stage", f?.staged ? "Unstage this file (space)" : "Stage this file (space)", "toggle").child(f?.staged ? "Unstage file" : "Stage file"))))
      .child(!rows.length
        ? body.child(div().absolute().top(12).left(14).font_family(".SystemUIFont").text_size(12.5).text_color(t.dim).child(f ? this.diffNote : ""))
        : body
          .child(this.sideBySide
            ? sized.child(lines)
            : sized.child(div().id("gg-diff-x").size_full().overflow_x_scrollbar().child(div().w_full().min_w(this.diffWidth).h_full().child(lines))))
          .child(Scrollbar.vertical("gg-diff").viewport_from_layout().absolute().inset_0()));
  }

  /** The branches, over the dialog under the branch button: a filter, then local and remote rows. @param {Theme} t */
  branchPanel(t) {
    const rows = this.branchRows();
    this.branchAt = Math.max(0, Math.min(this.branchAt, rows.length - 1));
    const remoteAt = rows.findIndex((b) => b.kind === "remote");
    const localLabel = remoteAt !== 0 && rows.length > 0;
    const remoteLabel = remoteAt >= 0;
    if (this.revealBranch && rows.length) {
      this.branchScroll.scroll_to_item(this.branchAt + Number(localLabel) + Number(remoteLabel && this.branchAt >= remoteAt));
      this.revealBranch = false;
    }
    /** @param {BranchInfo} b */
    const marks = (b) => b.kind !== "local" ? "" : [b.ahead ? `↑${b.ahead}` : "", b.behind ? `↓${b.behind}` : "", b.gone ? "gone" : "", b.upstream ? "" : "local only"].filter(Boolean).join(" ");
    return v_flex().id("gg-branches").absolute().top(60).left(SIZE.framePad).w(380).p(12).gap(8)
      .bg(t.popover).rounded(12).border_1().border_color(t.border).shadow_lg()
      // A press on the panel stays on it: the rows under it do not get it.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(this.escBox(textInput(t, this.branchFilter)))
      .child(v_flex().id("gg-branch-list").flex_none().h(300).overflow_y_scrollbar().track_scroll(this.branchScroll).gap(2)
        .when(!rows.length, (el) => el.child(listNote(t, "No branch matches")))
        .children(rows.flatMap((b, i) => [
          ...(i === 0 && localLabel ? [sectionLabel(t, "Local")] : []),
          ...(i === remoteAt ? [sectionLabel(t, "Remote")] : []),
          listRow(t, { id: `gg-branch-${b.kind}-${b.name}`, on: i === this.branchAt, compact: true, click: (cx) => { this.branchAt = i; this.command("branch-switch", cx); } })
            .child(div().w(10).flex_none().text_color(t.accent).child(b.current ? "●" : ""))
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(b.name))
            .child(div().flex_none().text_size(SIZE.small).text_color(t.dim).child(marks(b))),
        ])))
      .child(divider(t))
      .child(legend(t, [["ctrl-j/k", "move"], ["enter", "switch"], ["ctrl-enter", "new branch with this name"], ["esc", "back"]]));
  }

  /** The settings' line about Tourist, shown while it is not installed. @param {Theme} t */
  touristNote(t) {
    return h_flex().flex_none().px(12).gap(6).items_center().text_size(SIZE.small).text_color(t.dim)
      .child(div().flex_1().min_w(0).child("Tourist adds a guided tour of this branch."))
      .child(div().id("gg-get-tourist").flex_none().text_color(t.accent).cursor_pointer().on_click((_e, cx) => { openTouristPage(); cx.stop_propagation(); }).child("Get it"));
  }

  /**
   * The open question as a dialog over the mod, with yes and no buttons. A press beside the
   * dialog cancels. @param {Theme} t @param {Question} q
   */
  askDialog(t, q) {
    const box = v_flex().id("gg-ask").w(420).max_w("90%").p(20).gap(12)
      .bg(t.popover).rounded(12).border_1().border_color(t.border).shadow_lg()
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(div().text_size(SIZE.title).font_semibold().text_color(t.foreground).child(q.title))
      .child(div().text_size(SIZE.text).text_color(t.muted).child(q.body))
      .child(h_flex().gap(8).justify_end()
        .child(this.button(t, "gg-ask-no", `${q.no} (esc)`, "cancel").h(32).child("Cancel"))
        .child(this.button(t, "gg-ask-yes", `${q.yes} (enter)`, "yes").h(32).text_color(q.danger ? t.blocked : t.accent).child(q.yes)));
    return div().id("gg-ask-around").absolute().inset_0().flex().items_center().justify_center().rounded(SIZE.frameRadius).bg("#00000033")
      .on_mouse_down("left", (_e, cx) => { this.command("cancel", cx); cx.stop_propagation(); cx.notify(); })
      .on_click((_e, cx) => cx.stop_propagation())
      .child(box);
  }

  /** The line under the panes: the note. @param {Theme} t */
  noteLine(t) {
    return this.note ? div().flex_none().text_size(SIZE.small).text_color(this.note.bad ? t.blocked : t.dim).child(this.note.text) : null;
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const note = this.noteLine(t);
    /** @type {import("./kit/legend.js").Hint[]} */
    // The list stays the same while the commit box has the keyboard: a footer that appeared or
    // changed height then moved everything above it, under the pointer.
    const hints = [["?", "hide keys"], ["j/k", this.focus === "diff" ? "scroll" : "move"], ["ctrl-h", "files"], ["ctrl-l", "diff"],
        // A key that is turned off is not listed.
        ...this.shortcuts.keys.filter((k) => !this.shortcuts.isOff(k.id) && this.shortcuts.keyFor(k.id)).map((k) => /** @type {[string, string]} */ (
          [this.shortcuts.keyFor(k.id), k.id === "view" ? (this.split ? "unified" : "split") : k.id === "full" ? (this.full ? "leave full screen" : "full screen") : k.what])),
      [",", "settings"], ["esc", "close"]];
    const panel = frame(t, { id: "git-good", title: "Git Good", handle: this.handle, onKey: (e, cx) => this.key(e, cx), fill: true, details: this.details(t) })
      .child(div().flex().flex_row().flex_1().min_h(0).gap(SIZE.frameGap)
        .child(v_flex().w(this.full ? FILES_W_FULL : FILES_W).flex_none().min_h(0).gap(SIZE.frameGap)
          .child(this.files(t))
          .when(this.full && this.commits.length > 0, (el) => el.child(this.log(t)))
          .child(this.commitBox(t)))
        .child(this.diffPane(t)))
      .when(Boolean(note), (el) => el.child(note))
      .when(this.shortcuts.showHints, (el) => el.child(divider(t)).child(legend(t, hints)))
      // Esc with something open steps back from it. Without this the app closes the whole dialog (see BOX_CONTEXT).
      .when(Boolean(this.asking) || this.branching || this.typing || this.shortcuts.open, (el) => el.key_context(BOX_CONTEXT)
        .on_action(BACK_ACTION, (_e, cx) => { this.command("cancel", cx); cx.notify(); }))
      .when(this.branching, (el) => el.child(this.branchPanel(t)))
      .when(Boolean(this.asking), (el) => el.child(this.askDialog(t, /** @type {Question} */ (this.asking))))
      .when(this.shortcuts.open, (el) => el.child(this.shortcuts.panel(t, { note: this.tourist === false ? this.touristNote(t) : undefined })));
    // Placed as a layout block, or in full screen, the panel fills its room.
    if (props()?.overlay === undefined || this.full) return panel;
    // The overlay covers the window. A click beside the dialog closes it, a click in it does not.
    return div().id("gg-around").size_full().flex().items_center().justify_center()
      .on_click(() => this.close())
      .child(div().id("gg-box").w(DIALOG.width).max_w("100%").h(DIALOG.height).flex_none()
        .on_click((_e, cx) => cx.stop_propagation())
        .child(panel));
  }
}
