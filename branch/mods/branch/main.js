// branch: a dialog that lists the git branches of the repo the current space is in.
// The filter box always has the keyboard, so plain letters type into it and every action
// is a ctrl key. Each key is also a command: `herdr-app do branch.<command>`.
//
// Keys: up/down or ctrl-k/ctrl-j move. enter switches to the selected branch. ctrl-n makes a
// new branch from it, ctrl-r renames it, ctrl-d deletes it (asks first). ctrl-f fetches all
// remotes, ctrl-l pulls the current branch, ctrl-p pushes the selected local branch.
// ctrl-s stashes the uncommitted changes, ctrl-o pops the newest stash. esc closes the name box or question, then clears the filter, then closes.
//
// Remote branches are listed under the local ones. Enter on one switches to its local branch,
// making one that tracks it when there is none. The mod never renames or deletes on a remote.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, ScrollHandle } from "gpui-base";
import { spaces, panes, props, closeOverlay, nextCommand, notify } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { legend } from "./kit/legend.js";
import { listRow, listNote } from "./kit/list.js";
import { sectionLabel } from "./kit/pane.js";
import { textInput, spinner } from "./kit/controls.js";
import { repoOf, loadBranches, switchTo, trackBranch, createBranch, renameBranch, deleteBranch, fetchAll, pull, push, status, stash, stashPop } from "./git.js";
import { filterBranches } from "./parse.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("herdr").PaneInfo} PaneInfo */
/** @typedef {import("./parse.js").Branch} BranchInfo the class below has the name Branch */
/** @typedef {import("./git.js").Repo} Repo */
/** @typedef {import("./git.js").GitResult} GitResult */
/** @typedef {import("gpui-kit").AsyncContext} AsyncContext */
/**
 * The open name box or question. `branch` is the branch it is about: the one a new branch starts
 * at ("HEAD" when no row is selected), or the one to rename or delete. A name box has `input`.
 * @typedef {{ kind: "new" | "rename" | "delete" | "force", branch: string, input?: ReturnType<typeof InputState.new> }} Asking
 */

/** The line under the list. `bad` is true for an error (shown in the blocked color), false for plain news (dim). @typedef {{ text: string, bad: boolean }} Note */

/** The column that marks the current branch. */
const MARK_W = 14;
/** The most room a branch's last commit subject gets. */
const SUBJECT_MAX_W = 260;
/** The space between two rows. */
const ROW_GAP = 2;
/** The filter box is focused again this long after the dialog opens, once the app has put the keyboard on it. */
const REFOCUS_MS = 600;

/**
 * Where the space is right now: the folder of the pane you're in (the focused
 * pane of the tab it shows), then any pane in that tab, then any pane in the
 * space, falling back to where it was created. So a `cd` in any tab counts.
 * @param {SpaceInfo} s @param {PaneInfo[]} ps
 * @returns {string | null}
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

export default class Branch extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {Repo | null | undefined} null when the folder is not in a repo, undefined while the first load runs */
    this.repo = undefined;
    /** @type {string | null} the machine the repo is on, null for this computer */
    this.on = null;
    /** @type {string} the folder the repo was looked for in */
    this.folder = "";
    /** @type {BranchInfo[]} */
    this.branches = [];
    /** @type {string} the current branch's name */
    this.head = "";
    /** @type {number} the changed and untracked files, as of the last load */
    this.changed = 0;
    /** @type {number} the stash entries, as of the last load */
    this.stashes = 0;
    /** @type {number} the selected row */
    this.at = 0;
    /** @type {Note | null} one line under the list, such as git's error */
    this.note = null;
    /** @type {Asking | null} the open name box or question */
    this.asking = null;
    /** @type {boolean} true while a git command runs */
    this.busy = false;
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    /** The filter box. It keeps the keyboard, and its keys reach the frame's key handler. */
    this.filter = InputState.new({ value: String(props()?.filter ?? ""), placeholder: "Filter branches" });
    this.filter.on("change", (_e, cx) => { this.select(0); cx.notify(); });
    // Enter in the filter box. While a question is open the filter box still has the keyboard, so enter means yes.
    this.filter.on("submit", (_e, cx) => this.command(this.asking ? "yes" : "switch", cx));
    this.filter.focus();
    cx.timer.after(REFOCUS_MS, () => this.filter.focus());
    /** The list's scroll position, so the selected row stays in view. */
    this.scroll = ScrollHandle.new();
    /** True after the selection moves, until the next render scrolls to it. */
    this.reveal = true;
    cx.spawn((cx) => this.reload(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.filter.focus();
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

  /**
   * Finds the repo and reads its branches, then re-renders. The repo is the one `props().folder`
   * is in on this computer, else the one the active space is in on its machine.
   * @param {Context} cx
   */
  async reload(cx) {
    const given = props()?.folder;
    const space = given ? null : spaces().find((s) => s.active);
    this.folder = given ? String(given) : (space ? folderOf(space, panes()) : null) ?? "";
    this.on = space?.machine ?? null;
    const repo = this.folder ? await repoOf(this.folder, this.on) : null;
    const [loaded, work] = repo
      ? await Promise.all([loadBranches(repo, this.on), status(repo, this.on)])
      : [{ branches: [], head: "", error: "" }, { changed: 0, stashes: 0 }];
    this.repo = repo;
    this.changed = work.changed;
    this.stashes = work.stashes;
    this.branches = loaded.branches;
    this.head = loaded.head;
    this.note = loaded.error ? { text: loaded.error, bad: true } : null;
    this.reveal = true;
    cx.notify();
  }

  /**
   * The rows in list order: the branches the filter keeps, local ones first. A remote branch
   * that a local branch tracks is left out, since the local row stands for it.
   * @returns {BranchInfo[]}
   */
  shown() {
    const tracked = new Set(this.branches.filter((b) => b.kind === "local" && b.upstream).map((b) => b.upstream));
    return filterBranches(this.branches.filter((b) => b.kind === "local" || !tracked.has(b.name)), this.filter.value());
  }

  /** Selects a row and asks the next render to scroll to it. @param {number} i */
  select(i) {
    this.at = i;
    this.reveal = true;
  }

  /** Moves the selection, wrapping at either end. @param {number} by -1 for up, 1 for down */
  move(by) {
    const count = this.shown().length;
    if (count) this.select((this.at + by + count) % count);
  }

  /** Closes the name box or question when one is open, else clears the filter when it has text, else closes the dialog. */
  cancel() {
    if (this.asking) {
      this.asking = null;
      this.filter.focus();
      return;
    }
    if (!this.filter.value()) return this.close();
    this.filter.set_value("");
    this.select(0);
  }

  /** The selected branch, or undefined when the filter matches nothing. @returns {BranchInfo | undefined} */
  selected() {
    const rows = this.shown();
    return rows[Math.max(0, Math.min(this.at, rows.length - 1))];
  }

  /**
   * Does what a key or a `herdr-app do branch.<command>` asks. While git runs, nothing. While the
   * name box or a question is open, only "yes" and "cancel".
   * @param {string} c a command of the key table @param {Context | AsyncContext} cx
   */
  command(c, cx) {
    if (this.busy) return;
    this.note = null;
    if (c === "cancel") this.cancel();
    else if (this.asking) { if (c === "yes") this.yes(cx); }
    else if (c === "up") this.move(-1);
    else if (c === "down") this.move(1);
    else if (c === "switch") this.switch(cx);
    else if (c === "new") this.ask("new", this.selected()?.name ?? "HEAD", this.filter.value().trim(), false);
    else if (c === "fetch") this.fetch(cx);
    else if (c === "pull") this.pull(cx);
    else if (c === "push") this.push(cx);
    else if (c === "stash") this.stash(cx);
    else if (c === "pop") this.pop(cx);
    else if (c === "rename" || c === "delete") {
      const b = this.selected();
      if (b?.kind === "remote") this.say("Remote branches cannot be renamed or deleted here");
      else if (b && c === "rename") this.ask("rename", b.name, b.name, true);
      else if (b) this.asking = { kind: "delete", branch: b.name };
    }
    cx.notify();
  }

  /** Sets the note to an error or a refusal. @param {string} text */
  say(text) {
    this.note = { text, bad: true };
  }

  /**
   * Opens the name box and gives it the keyboard.
   * @param {"new" | "rename"} kind @param {string} branch @param {string} value the text it starts with
   * @param {boolean} selectAll whether the text starts selected, so typing replaces it
   */
  ask(kind, branch, value, selectAll) {
    const input = InputState.new({ value, placeholder: "Branch name" });
    if (selectAll) input.set_selected_range({ start: 0, end: value.length });
    input.on("submit", (_e, cx) => this.command("yes", cx));
    input.focus();
    this.asking = { kind, branch, input };
  }

  /**
   * Runs one git command with the spinner showing. When git fails, its message goes to the note.
   * @param {AsyncContext} cx @param {() => Promise<GitResult>} run
   * @returns {Promise<boolean>} whether git succeeded
   */
  async git(cx, run) {
    this.busy = true;
    cx.notify();
    const r = await run();
    this.busy = false;
    if (!r.ok) this.say(r.err || "git failed");
    cx.notify();
    return r.ok;
  }

  /** After a switch: the dialog closes and a notification says where you are. A layout block reloads its list. @param {string} name @param {AsyncContext} cx */
  async switched(name, cx) {
    notify({ title: `Switched to ${name}` });
    if (props()?.overlay !== undefined) this.close();
    else await this.reload(cx);
  }

  /**
   * Switches to the selected branch. For a remote branch that is its local branch of the same
   * short name ("origin/feature/x" and "feature/x"), made to track it when there is none yet.
   * @param {Context | AsyncContext} cx
   */
  switch(cx) {
    const repo = this.repo;
    const b = this.selected();
    if (!repo || !b) return;
    const name = b.kind === "remote" ? b.name.slice(`${b.remote}/`.length) : b.name;
    const track = b.kind === "remote" && !this.branches.some((l) => l.kind === "local" && l.name === name);
    cx.spawn(async (cx) => {
      const run = () => track ? trackBranch(repo, this.on, b.name) : switchTo(repo, this.on, name);
      if (await this.git(cx, run)) await this.switched(name, cx);
    });
  }

  /**
   * Runs a git command that talks to a remote, then reads the list again. The dialog stays open.
   * @param {Context | AsyncContext} cx @param {() => Promise<GitResult>} run
   * @param {() => string} [done] the note after a success
   */
  sync(cx, run, done) {
    cx.spawn(async (cx) => {
      const ok = await this.git(cx, run);
      const note = ok ? (done ? { text: done(), bad: false } : null) : this.note;
      await this.reload(cx);
      // The reload clears the note, so it is set after.
      if (note) { this.note = note; cx.notify(); }
    });
  }

  /** Fetches all remotes. @param {Context | AsyncContext} cx */
  fetch(cx) {
    const repo = this.repo;
    if (repo) this.sync(cx, () => fetchAll(repo, this.on));
  }

  /** Pulls the current branch, whatever row is selected. Fast-forward only. @param {Context | AsyncContext} cx */
  pull(cx) {
    const repo = this.repo;
    if (!repo) return;
    const current = this.branches.find((b) => b.kind === "local" && b.current);
    if (!current?.upstream) return this.say("The current branch has no upstream to pull from");
    this.sync(cx, () => pull(repo, this.on), () => `Pulled ${current.name}`);
  }

  /** Pushes the selected local branch, current or not. Never forced. @param {Context | AsyncContext} cx */
  push(cx) {
    const repo = this.repo;
    const b = this.selected();
    if (!repo || !b) return;
    if (b.kind === "remote") return this.say("Select a local branch to push");
    let remote = "";
    this.sync(cx, async () => {
      const r = await push(repo, this.on, b);
      remote = r.remote;
      return r;
    }, () => `Pushed ${b.name} to ${remote}`);
  }

  /**
   * Puts the uncommitted changes aside in a stash. The count is read again first, since files
   * can change while the dialog is open.
   * @param {Context | AsyncContext} cx
   */
  stash(cx) {
    const repo = this.repo;
    if (!repo) return;
    let count = 0;
    this.sync(cx, async () => {
      count = (await status(repo, this.on)).changed;
      return count ? stash(repo, this.on) : { ok: false, out: "", err: "Nothing to stash" };
    }, () => `Stashed ${count} ${count === 1 ? "change" : "changes"}`);
  }

  /** Brings the newest stash back. On a conflict or a refusal git keeps the stash and its message is shown. @param {Context | AsyncContext} cx */
  pop(cx) {
    const repo = this.repo;
    if (!repo) return;
    this.sync(cx, async () => {
      const { stashes } = await status(repo, this.on);
      return stashes ? stashPop(repo, this.on) : { ok: false, out: "", err: "No stash to pop" };
    }, () => "Popped the newest stash");
  }

  /** Yes to the open name box or question. @param {Context | AsyncContext} cx */
  yes(cx) {
    const repo = this.repo;
    const asking = this.asking;
    if (!repo || !asking) return;
    const { kind, branch } = asking;
    const name = asking.input?.value().trim() ?? "";
    cx.spawn(async (cx) => {
      if (kind === "new") {
        // A name git refuses keeps the box open, so it can be fixed.
        if (!await this.git(cx, () => createBranch(repo, this.on, name, branch))) return;
        this.asking = null;
        this.filter.focus();
        await this.switched(name, cx);
        return;
      }
      if (kind === "rename") {
        if (!await this.git(cx, () => renameBranch(repo, this.on, branch, name))) return;
      } else if (!await this.git(cx, () => deleteBranch(repo, this.on, branch, kind === "force"))) {
        // Git refuses a branch that is not fully merged: ask once more, and yes then forces.
        const unmerged = kind === "delete" && !!this.note?.text.includes("not fully merged");
        this.asking = unmerged ? { kind: "force", branch } : null;
        if (unmerged) this.note = null;
        cx.notify();
        return;
      }
      this.asking = null;
      this.filter.focus();
      await this.reload(cx);
    });
  }

  /** The command a key stands for, or "" when it has none. Enter is not here: it arrives as an input's "submit". @param {string} k a keystroke */
  commandOf(k) {
    if (k === "up" || k === "ctrl-k") return "up";
    if (k === "down" || k === "ctrl-j") return "down";
    if (k === "escape") return "cancel";
    if (k === "ctrl-n") return "new";
    if (k === "ctrl-r") return "rename";
    if (k === "ctrl-d") return "delete";
    if (k === "ctrl-f") return "fetch";
    if (k === "ctrl-l") return "pull";
    if (k === "ctrl-p") return "push";
    if (k === "ctrl-s") return "stash";
    if (k === "ctrl-o") return "pop";
    return "";
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    const c = this.commandOf(e.keystroke);
    // Any other key clears the note too. Enter's own command clears it.
    if (!c) {
      if (this.note && !this.busy && e.keystroke !== "enter") { this.note = null; cx.notify(); }
      return;
    }
    this.command(c, cx);
    cx.stop_propagation();
  }

  /** The question line, or "" when no question is open. */
  question() {
    const a = this.asking;
    if (a?.kind === "delete") return `Delete branch ${a.branch}? enter deletes, esc cancels`;
    if (a?.kind === "force") return `${a.branch} is not fully merged. Delete anyway? enter deletes, esc cancels`;
    return "";
  }

  /**
   * The line under the list: why there are no rows, git's error, or what a pull, push, stash or pop did. Null when there is nothing to say.
   * @param {number} count the rows shown @returns {Note | null}
   */
  noteText(count) {
    if (this.repo === undefined) return null;
    if (this.repo === null) return { text: this.folder ? `Not a git repository: ${this.folder}` : "No folder to look for a repository in", bad: true };
    if (this.note) return this.note;
    return count === 0 && this.filter.value().trim() ? { text: "No branch matches", bad: true } : null;
  }

  /**
   * How far a local branch is from its upstream, as small marks. A remote branch has none.
   * @param {ReturnType<typeof colors>} t @param {BranchInfo} b
   */
  marks(t, b) {
    if (b.kind !== "local") return [];
    /** @type {[string, typeof t.dim][]} each mark's text and color */
    const marks = [];
    if (b.ahead > 0) marks.push([`↑${b.ahead}`, t.accent]);
    if (b.behind > 0) marks.push([`↓${b.behind}`, t.dim]);
    if (b.gone) marks.push(["gone", t.blocked]);
    if (!b.upstream) marks.push(["local only", t.dim]);
    return marks.map(([text, color]) => div().flex_none().text_size(SIZE.small).text_color(color).child(text));
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const rows = this.shown();
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));
    const at = this.at;
    // The list's children: a label over each section that has rows, then its rows.
    const remoteAt = rows.findIndex((b) => b.kind === "remote");
    const localLabel = remoteAt !== 0 && rows.length > 0;
    const remoteLabel = remoteAt >= 0;
    /** The place of row `i` among the list's children, which counts the labels before it. @param {number} i */
    const childOf = (i) => i + Number(localLabel) + Number(remoteLabel && i >= remoteAt);
    if (this.reveal && rows.length) { this.scroll.scroll_to_item(childOf(at)); this.reveal = false; }
    const loading = this.repo === undefined;
    const note = this.noteText(rows.length);
    const details = h_flex().flex_1().min_w(0).gap(8).items_center().text_size(SIZE.small).text_color(t.dim)
      .child(div().min_w(0).truncate().child(this.repo ? [this.repo.name, this.head, this.changed ? `${this.changed} changed` : "", this.stashes ? `${this.stashes} stashed` : ""].filter(Boolean).join(" · ") : ""))
      .when(this.busy, (el) => el.child(spinner(t).flex_none()));
    const asking = this.asking;
    const question = this.question();
    // Elements are single-use, so each row is built once per render.
    const list = v_flex().id("branch-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).gap(ROW_GAP);

    return frame(t, { id: "branch", title: "Branches", handle: this.handle, onKey: (e, cx) => this.key(e, cx), fill: true, details })
      .child(textInput(t, this.filter, !asking?.input).flex_none())
      .when(!!asking?.input, (el) => el.child(
        h_flex().flex_none().items_center().gap(10)
          .child(div().flex_none().max_w(300).truncate().text_size(SIZE.small).text_color(t.dim).child(asking?.kind === "new" ? `New branch from ${asking.branch}` : `Rename ${asking?.branch}`))
          .child(textInput(t, asking?.input).flex_1()),
      ))
      .when(!!question, (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.foreground).child(question)))
      .child(loading ? list.child(listNote(t, spinner(t))) : list.children(rows.flatMap((b, i) => [
        ...(i === 0 && localLabel ? [sectionLabel(t, "Local")] : []),
        ...(i === remoteAt ? [sectionLabel(t, "Remote")] : []),
        listRow(t, { id: `branch-${b.kind}-${b.name}`, on: i === at, compact: true, click: (cx) => { this.select(i); cx.notify(); } })
          .child(div().w(MARK_W).flex_none().text_color(t.accent).child(b.current ? "●" : ""))
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(b.name))
          .children(this.marks(t, b))
          .child(div().flex_none().max_w(SUBJECT_MAX_W).truncate().text_size(SIZE.small).text_color(t.dim).child(b.subject)),
      ])))
      .when(!!note, (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(note?.bad ? t.blocked : t.dim).child(note?.text ?? "")))
      .child(divider(t))
      .child(legend(t, [["↑/↓", "move"], ["enter", "switch"], ["ctrl-n", "new"], ["ctrl-r", "rename"], ["ctrl-d", "delete"], ["ctrl-f", "fetch"], ["ctrl-l", "pull"], ["ctrl-p", "push"], ["ctrl-s", "stash"], ["ctrl-o", "pop"], ["esc", "close"]]));
  }
}
