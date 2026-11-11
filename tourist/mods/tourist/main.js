// Tourist: Claude or Codex walks you through a branch, the last commit, the whole repo, or a feature you describe, one stop at a time.
// This file holds the view's state, keys and flow. The pieces it uses:
//   constants.js  scopes, depths, agents and other fixed tables
//   git.js        the folder to tour and its repo facts
//   agent.js      finding Claude or Codex and talking to it
//   plan.js       the prompts and reading the tour plan
//   code.js       a stop's lines, its editor, opening VS Code
//   ui.js         shared buttons, rows and inputs
//   files.js      grouping the PR's files for the file list
//   views/        the setup, tour, planning and error screens
import { View } from "gpui-kit";
import { v_flex, InputState, VirtualListScrollHandle } from "gpui-base";
import { theme, nextCommand, props, run } from "herdr";
import { SCOPES, DEPTHS, SPLIT_WIDTH } from "./constants.js";
import { startFolder, readRepo, git } from "./git.js";
import { AgentSession, agentName, findAgents, rememberAgent } from "./agent.js";
import { subject, planPrompt, prSubject, prPlanPrompt, followUpPrompt, filePrompt, fixPrompt, fixReplyPrompt, parsePlan } from "./plan.js";
import { readExcerpt, codeState, openInEditor, openUrl } from "./code.js";
import { listPRs, loadPR, prFileDiff, prFileStats, listThreads } from "./pr.js";
import { groupFiles } from "./files.js";
import { diffRows, rowsInRange, splitDiff } from "./diff.js";
import { openWorktree, worktreeDiff, pushFix, removeWorktree } from "./worktree.js";
import { commentKey, loadComments, saveComments, loadViewed, saveViewed, sideOf, rangeOf } from "./comments.js";
import { planKey, loadSavedPlan, savePlan, dropSavedPlan } from "./saved.js";
import { setupView } from "./views/setup.js";
import { tourView } from "./views/tour.js";
import { planningView, errorView } from "./views/status.js";
import { fixView } from "./views/fix.js";
import { postReview, eventsFor } from "./review.js";
import { reviewView } from "./views/review.js";
import { mergeMethods, mergePR } from "./merge.js";
import { mergeView } from "./views/merge.js";

export default class Tourist extends View {
  init(_props, cx) {
    const start = startFolder();
    this.cwd = props()?.folder ?? start.cwd; this.on = start.on;
    this.phase = "setup"; this.scope = "branch"; this.depth = "normal";
    this.git = { root: null, branch: "", base: null, mergeBase: null, changed: [], head: "" };
    this.plan = null; this.idx = 0; this.code = null; this.codeError = null;
    this.session = null;  // the AgentSession of the tour in progress
    this.busy = null; this.error = null;
    this.agents = []; this.agent = null; // installed agent ids, and the one tours use
    this.step = "scope"; // setup step: "scope" what to tour, "pr" which pull request, "depth" how deep
    this.prs = null; this.prsError = null; // the open PRs, loaded when the PR step opens (again after a failure)
    this.prNumber = null; this.pr = null;  // the picked PR, and its details once the tour starts
    this.diff = null;     // the stop's diff rows, on PR tours
    this.planNote = null; // what planning is waiting on before the agent starts
    this.comments = [];   // line comments on the PR, saved by comments.js
    this.commenting = null; // { file, line, side, code, anchor, editId? } while the comment box is open
    this.threads = [];      // comment threads already on the PR on GitHub, read-only
    this.files = null;      // every file the PR changes, grouped for the file list (files.js)
    this.viewed = {};       // files marked viewed on this PR: { file: the head commit it was marked at }
    this.other = null;      // a PR file the tour doesn't stop at, while it's open instead of a stop
    this.showFiles = true;  // the file list beside a PR tour, toggled with l
    // The fix run on a PR: { phase: "running" | "ready" | "failed" | "pushing" | "pushed",
    // count, note, path, summary, replies, files, error, confirm }. Shown when phase is "fix".
    // replies: [{ text, answer }], the reader's replies to the fix agent and what it said back.
    this.fix = null; this.fixSession = null;
    this.replying = false; // the fix screen's reply box only exists while replying
    // Posting the comments to GitHub: { phase: "editing" | "posting" | "posted", cursor, confirm, url, error }.
    this.review = null;
    // Merging your own PR: { phase: "loading" | "picking" | "merging" | "merged", methods, cursor, confirm, error }.
    this.merge = null;
    this.cursor = 0;      // highlighted row in the current step
    this.split = null;    // null: split when the pane is wide enough. true or false: the s key chose
    this.width = 0;       // the pane width, from on_size_change
    this.asking = false;  // the ask box only exists while asking, so it can't take tour keys
    this.typing = null;   // "ask" | "feature" while a text box has the keyboard
    this.explainScroll = VirtualListScrollHandle.new(); // the explanation's scroll position, moved from code
    this.input = this.textBox("ask", "Ask about this stop, then press enter", cx => this.ask(cx));
    this.featureInput = this.textBox("feature", "e.g. how a space gets its hint letter", cx => this.pick(cx));
    this.commentInput = this.textBox("comment", "Comment on this line, then press enter", cx => this.saveComment(cx));
    this.summaryInput = this.textBox("summary", "Optional", () => this.leaveBox());
    this.replyInput = this.textBox("reply", "Reply to the agent, then press enter", cx => this.replyFix(cx));
    this.handle = cx.focus_handle();
    // The pane isn't drawn yet, so focus again once it is.
    this.handle.focus();
    cx.timer.after(50, () => { if (!this.typing) this.handle.focus(); });
    cx.timer.after(400, () => { if (!this.typing) this.handle.focus(); });
    cx.spawn(async cx => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
    cx.spawn(async cx => { await this.detect(); cx.notify(); });
  }

  textBox(name, placeholder, submit) {
    const box = InputState.new({ placeholder });
    box.on("focus", (_e, cx) => { this.typing = name; cx.notify(); });
    box.on("blur", (_e, cx) => { if (this.typing === name) this.typing = null; cx.notify(); });
    box.on("submit", (_e, cx) => { submit(cx); cx.notify(); });
    return box;
  }

  /** Gives a text box the keyboard, again once it has been drawn. */
  focusBox(box, cx) {
    box.focus();
    cx.timer.after(50, () => box.focus());
  }

  /** Takes the keyboard back from a text box. */
  leaveBox() {
    this.typing = null; this.asking = false; this.commenting = null; this.replying = false;
    this.handle.focus();
  }

  async close() {
    this.code?.release(); this.explainScroll.release(); this.input.release(); this.featureInput.release(); this.commentInput.release(); this.summaryInput.release(); this.replyInput.release();
    await this.session?.stop(); await this.fixSession?.stop();
  }

  /** `tourist.<name>` commands: focus, start, next, prev, deeper, technical, open, reset, agent, scope-<id>, depth-<id>. */
  command(c, cx) {
    if (c === "focus") this.handle.focus();
    else if (c.startsWith("scope-")) { this.scope = c.slice(6); this.goStep("scope"); }
    else if (c.startsWith("depth-")) { this.depth = c.slice(6); this.goStep("depth"); }
    else if (c === "down") this.phase === "tour" ? this.move(1, cx) : this.moveCursor(1);
    else if (c === "up") this.phase === "tour" ? this.move(-1, cx) : this.moveCursor(-1);
    else if (c === "pick") this.pick(cx);
    else if (c === "back") this.back();
    else if (c === "start") this.start(cx);
    else if (c === "next") this.move(1, cx);
    else if (c === "prev") this.move(-1, cx);
    else if (c === "deeper") this.deeper(cx);
    else if (c === "technical") this.technical(cx);
    else if (c === "open") this.openInEditor();
    else if (c === "reset") this.reset(cx);
    else if (c === "agent") this.switchAgent();
    else if (c === "fix") this.startFix(cx);
    else if (c === "fix-back") this.closeFix();
    else if (c === "fix-discard") this.discardFix(cx);
    else if (c === "review") this.startReview(cx);
    else if (c === "review-back") this.closeReview();
    else if (c === "merge") this.startMerge(cx);
    else if (c === "merge-back") this.closeMerge();
    else if (c === "explain") this.explainFile(cx);
    else if (c === "viewed") this.toggleViewed(this.currentFile(), cx);
    else if (c.startsWith("file-") && this.files) {
      // file-<n>: the nth file in the list, counting down from the top
      const f = [...this.files.tour, ...this.files.also, ...this.files.side][Number(c.slice(5)) - 1];
      if (f) this.openFile(f, cx);
    }
  }

  async detect() {
    if (!this.cwd) { this.fail("No folder to tour. Open Tourist from a terminal inside a repo."); return; }
    // Both take a moment on Windows and don't depend on each other.
    const [repo, found] = await Promise.all([readRepo(this.cwd, this.on), findAgents(this.on)]);
    if (!repo) { this.fail(`${this.cwd} is not inside a git repo.`); return; }
    this.agents = found.agents; this.agent = found.agent;
    if (!this.agent) { this.fail("Tourist needs the claude or codex CLI on PATH, signed in."); return; }
    this.git = repo;
    if (repo.changed.length === 0) this.scope = repo.head ? "commit" : "repo";
    this.goStep("scope");
  }

  /** Switches to the next installed agent and remembers it. */
  switchAgent() {
    if (this.agents.length < 2) return;
    this.agent = this.agents[(this.agents.indexOf(this.agent) + 1) % this.agents.length];
    rememberAgent(this.agent);
  }

  agentName() { return agentName(this.agent); }

  fail(message) { this.phase = "error"; this.error = message; this.busy = null; }

  start(cx) {
    if (this.phase !== "setup" || !this.git.root) return;
    if (this.scope === "branch" && this.git.changed.length === 0) return;
    if (this.scope === "feature" && !this.featureInput.value().trim()) { this.focusBox(this.featureInput, cx); return; }
    if (this.scope === "pr" && !this.prNumber) return;
    this.leaveBox();
    this.phase = "planning";
    const session = this.session = new AgentSession(this.agent, this.git.root);
    const gen = this.gen = (this.gen ?? 0) + 1;
    cx.spawn(async cx => {
      try {
        let prompt, plan = null, head = null;
        const feature = this.featureInput.value().trim();
        if (this.scope === "pr") {
          this.planNote = `Fetching PR #${this.prNumber}`; cx.notify();
          const pr = await loadPR(this.git.root, this.on, this.prNumber);
          if (gen !== this.gen) return;
          this.pr = pr; this.planNote = null; head = pr.headOid;
          this.comments = await loadComments(commentKey(this.git.root, pr.number));
          this.viewed = await loadViewed(commentKey(this.git.root, pr.number));
          this.loadThreads(cx);
          cx.notify();
          prompt = prPlanPrompt(prSubject(pr), this.depth);
        } else {
          // HEAD now, not when Tourist opened, so a commit made since then plans again.
          head = await git(["rev-parse", "HEAD"], { cwd: this.git.root, on: this.on });
          prompt = planPrompt(subject(this.scope, this.git, feature), this.depth);
        }
        // The same tour of the same commit at the same depth was planned before: reuse it,
        // and its agent session when the agent matches.
        this.savedKey = planKey({ root: this.git.root, scope: this.scope, depth: this.depth, head, pr: this.pr, feature });
        const saved = this.savedKey ? await loadSavedPlan(this.savedKey) : null;
        if (gen !== this.gen) return;
        if (saved) { plan = saved.plan; plan.savedAt = saved.saved; if (saved.agent === session.agent) session.id = saved.session; }
        if (!plan) plan = parsePlan(await session.ask(prompt));
        if (gen !== this.gen) return;
        this.plan = plan; this.phase = "tour"; this.show(0, cx);
        if (this.pr) this.loadFiles(cx);
        if (!plan.savedAt) this.storePlan();
      } catch (e) { if (gen === this.gen) this.fail(String(e?.message ?? e)); }
      cx.notify();
    });
  }

  show(i, cx) {
    if (!this.plan) return;
    this.idx = Math.max(0, Math.min(i, this.plan.stops.length - 1));
    this.other = null;
    this.code?.release(); this.code = null; this.codeError = null; this.diff = null;
    if (this.commenting) this.leaveBox();
    const s = this.plan.stops[this.idx], idx = this.idx;
    cx.spawn(async cx => {
      // A PR isn't on disk: show the stop's part of the file's diff instead.
      if (this.pr) {
        const text = await prFileDiff(this.git.root, this.on, this.pr, s.file);
        if (this.idx !== idx) return;
        const rows = text ? rowsInRange(diffRows(text), Number(s.start) || 1, Number(s.end) || Infinity) : [];
        if (rows.length === 0) this.codeError = `No changes to ${s.file} in this PR`;
        else this.diff = rows;
        cx.notify();
        return;
      }
      const excerpt = await readExcerpt(this.git.root, s, this.on);
      if (this.idx !== idx) return;
      if (!excerpt) { this.codeError = `Cannot read ${s.file}`; cx.notify(); return; }
      s.start = excerpt.start; s.end = excerpt.end;
      this.code = codeState(s.file, excerpt.text);
      cx.notify();
    });
  }

  /** Sends a follow-up about the current stop and adds the answer under it. */
  followUp(label, question, cx) {
    if (this.busy || !this.plan || !this.session) return;
    const s = this.plan.stops[this.idx], session = this.session, other = this.other;
    const file = other ?? s.file, notes = other ? this.otherNotes(other) : s.notes;
    this.busy = label;
    cx.spawn(async cx => {
      const comments = this.comments.filter(c => c.file === file);
      let prompt = other ? filePrompt(question, other, this.pr, comments) : followUpPrompt(question, s, this.idx + 1, comments);
      // A reused tour whose agent session couldn't be kept starts fresh, so say what it's about.
      if (!session.id) prompt = `This is part of a guided tour. Subject: ${this.pr ? prSubject(this.pr) : subject(this.scope, this.git, this.featureInput.value().trim())}\n\n${prompt}`;
      try { notes.push({ label, text: await session.ask(prompt) }); this.storePlan(); }
      catch (e) { notes.push({ label: "Error", text: String(e?.message ?? e) }); }
      this.busy = null; cx.notify();
    });
  }

  /** The file whose code is showing: the open other file, or the current stop's. */
  currentFile() { return this.other ?? this.plan?.stops[this.idx]?.file ?? null; }

  /** The answers about a file the tour doesn't stop at. Kept in the plan, so they're saved with it. */
  otherNotes(file) {
    const all = this.plan.fileNotes ??= {};
    return all[file] ??= [];
  }

  /** Loads every file the PR changes for the file list. A failure just leaves the list empty. */
  loadFiles(cx) {
    const pr = this.pr, plan = this.plan;
    this.files = null;
    cx.spawn(async cx => {
      const stats = await prFileStats(this.git.root, this.on, pr).catch(() => []);
      if (this.pr === pr && this.plan === plan) { this.files = groupFiles(stats, plan.stops); cx.notify(); }
    });
  }

  /** Opens a file from the list: a tour file goes to its first stop, any other shows its whole diff. */
  openFile(f, cx) {
    if (f.stop !== undefined) { this.show(f.stop, cx); return; }
    if (!this.pr) return;
    this.other = f.file;
    this.code?.release(); this.code = null; this.codeError = null; this.diff = null;
    if (this.commenting) this.leaveBox();
    const file = f.file;
    cx.spawn(async cx => {
      const text = await prFileDiff(this.git.root, this.on, this.pr, file);
      if (this.other !== file) return;
      const rows = text ? rowsInRange(diffRows(text), 1, Infinity) : [];
      if (rows.length === 0) this.codeError = f.add === null ? `${file} is a binary file` : `No changes to ${file} in this PR`;
      else this.diff = rows;
      cx.notify();
    });
  }

  /** The files after the tour stops, in list order: "Also changed", then tests, docs and generated. */
  laterFiles() { return this.files ? [...this.files.also, ...this.files.side] : []; }

  /**
   * Where j (1) or k (-1) goes: the tour stops in order, then on into the other files in the
   * list after the last stop, and back the same way.
   */
  moveTarget(dir) {
    const later = this.laterFiles(), last = (this.plan?.stops.length ?? 0) - 1;
    if (this.other) {
      const j = later.findIndex(f => f.file === this.other) + dir;
      return j < 0 ? { stop: last } : j < later.length ? { file: later[j] } : null;
    }
    const i = this.idx + dir;
    if (i >= 0 && i <= last) return { stop: i };
    return dir > 0 && later.length ? { file: later[0] } : null;
  }

  move(dir, cx) {
    const to = this.moveTarget(dir);
    if (to?.file) this.openFile(to.file, cx);
    else if (to) this.show(to.stop, cx);
  }

  explainFile(cx) { if (this.other) this.followUp("Explain", "Explain what changed in this file, why, and how it connects to the rest of the PR.", cx); }

  /** Loads the comment threads already on the PR from GitHub. Shown read-only; a failure just shows none. */
  loadThreads(cx) {
    const pr = this.pr;
    this.threads = [];
    cx.spawn(async cx => {
      const threads = await listThreads(pr, this.git.root, this.on).catch(() => []);
      if (this.pr === pr) { this.threads = threads; cx.notify(); }
    });
  }

  /** Saves the tour's plan and answers so reopening it skips planning. Branch tours have no key and aren't saved. */
  storePlan() {
    if (!this.savedKey || !this.plan) return;
    const { savedAt, ...plan } = this.plan;
    savePlan(this.savedKey, plan, this.session?.agent ?? this.agent, this.session?.id ?? null).catch(() => {});
  }

  /** Throws away the saved plan and plans the tour again. */
  replan(cx) {
    if (!this.savedKey || this.busy || this.phase !== "tour") return;
    const key = this.savedKey;
    this.session?.stop();
    this.code?.release(); this.code = null; this.diff = null;
    this.plan = null; this.files = null; this.other = null; this.phase = "setup"; this.step = "depth";
    cx.spawn(async cx => { await dropSavedPlan(key); this.start(cx); cx.notify(); });
  }

  deeper(cx) { this.followUp("Deeper", "Go deeper here: what else in this file and the code it calls matters?", cx); }
  technical(cx) { this.followUp("More technical", "Explain this again, more technically: exact mechanisms, types, data flow and edge cases.", cx); }
  ask(cx) {
    const q = this.input.value().trim();
    if (!q || this.busy) return;
    this.input.set_value("");
    this.leaveBox();
    this.followUp(`You asked: ${q}`, q, cx);
    // Jump to the bottom so the answer appears in view, and again once the question is drawn.
    this.explainScroll.scroll_to_bottom();
    cx.timer.after(50, () => { this.explainScroll.scroll_to_bottom(); cx.notify(); });
  }

  /**
   * Opens the comment box under a diff line of the current stop. With shift held and a
   * comment already open on this stop, it stretches that comment from the line first
   * clicked (`anchor`) to this one instead, keeping what was typed.
   */
  startComment(row, cx, { index = -1, shift = false } = {}) {
    const file = this.currentFile(), rows = this.diff ?? [];
    if (!this.pr || !file || row.number === undefined) return;
    this.asking = false;
    const open = this.commenting;
    if (shift && open?.file === file && open.anchor >= 0 && index >= 0) {
      const [a, b] = rangeOf(rows, open.anchor, index);
      const lines = rows.slice(a, b + 1).filter(r => r.number !== undefined);
      const first = rows[a], last = rows[b];
      this.commenting = { file, anchor: open.anchor, line: last.number, side: sideOf(last), code: lines.map(r => r.text).join("\n") };
      if (a !== b) Object.assign(this.commenting, { startLine: first.number, startSide: sideOf(first) });
    } else {
      this.commenting = { file, anchor: index, line: row.number, side: sideOf(row), code: row.text };
      this.commentInput.set_value("");
    }
    this.focusBox(this.commentInput, cx);
  }

  /** Reopens a saved comment in the box to change its text. */
  startEdit(comment, cx) {
    if (!this.pr) return;
    this.asking = false;
    const { id, text, created, ...where } = comment;
    this.commenting = { ...where, anchor: -1, editId: id };
    this.commentInput.set_value(text);
    this.focusBox(this.commentInput, cx);
  }

  /** Saves the open comment, or the edit of a saved one. An empty box just closes. */
  saveComment(cx) {
    const text = this.commentInput.value().trim(), at = this.commenting;
    this.commentInput.set_value("");
    this.leaveBox();
    if (!text || !at || !this.pr) return;
    if (at.editId) {
      this.comments = this.comments.map(c => c.id === at.editId ? { ...c, text } : c);
      this.storeComments(cx);
      return;
    }
    const { anchor, ...where } = at; // the anchor only means something while the box is open
    this.comments.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...where, text, created: new Date().toISOString() });
    this.storeComments(cx);
  }

  deleteComment(comment, cx) {
    this.comments = this.comments.filter(c => c.id !== comment.id);
    this.storeComments(cx);
  }

  /** True when the file was marked viewed at the PR's current head. */
  isViewed(file) { return Boolean(this.pr) && this.viewed[file] === this.pr.headOid; }

  /** Marks a file viewed, or clears the mark. Saved per PR. */
  toggleViewed(file, cx) {
    if (!this.pr || !file) return;
    const viewed = { ...this.viewed };
    if (this.isViewed(file)) delete viewed[file]; else viewed[file] = this.pr.headOid;
    this.viewed = viewed;
    const key = commentKey(this.git.root, this.pr.number);
    cx.spawn(async () => { await saveViewed(key, viewed).catch(() => {}); });
  }

  storeComments(cx) {
    const key = commentKey(this.git.root, this.pr.number), list = this.comments;
    cx.spawn(async () => { await saveComments(key, list).catch(() => {}); });
  }

  /**
   * Opens the fix screen. The first time, an agent with edit tools works through every
   * saved comment in a worktree on the PR's commit. Later, it shows that run's result.
   */
  startFix(cx) {
    if (!this.pr?.mine) return; // never edit someone else's PR
    if (this.fix && this.fix.phase !== "pushed") { this.leaveBox(); this.phase = "fix"; return; }
    if (this.comments.length === 0 || this.busy) return;
    this.leaveBox();
    const pr = this.pr, comments = [...this.comments];
    const fix = this.fix = { phase: "running", count: comments.length, note: "Creating a worktree", path: null, replies: [] };
    this.phase = "fix";
    cx.spawn(async cx => {
      try {
        fix.path = await openWorktree(this.git.root, this.on, pr);
        fix.note = `${this.agentName()} is working through ${comments.length} comment${comments.length === 1 ? "" : "s"}`; cx.notify();
        const session = this.fixSession = new AgentSession(this.agent, fix.path, { write: true });
        fix.summary = await session.ask(fixPrompt(pr, comments));
        fix.files = splitDiff(await worktreeDiff(fix.path, this.on));
        fix.phase = "ready";
      } catch (e) { fix.phase = "failed"; fix.error = String(e?.message ?? e); }
      cx.notify();
    });
  }

  /** Opens the reply box on the fix screen, once the agent has finished a run. */
  startReply(cx) {
    const fix = this.fix;
    if (!fix || !this.fixSession?.id || (fix.phase !== "ready" && fix.phase !== "failed")) return;
    this.replying = true;
    this.focusBox(this.replyInput, cx);
  }

  /** Sends the reader's reply into the fix agent's session, so it keeps editing the same worktree. */
  replyFix(cx) {
    const fix = this.fix, session = this.fixSession, text = this.replyInput.value().trim();
    if (!text || !fix || !session || (fix.phase !== "ready" && fix.phase !== "failed")) return;
    this.replyInput.set_value("");
    this.leaveBox();
    fix.phase = "running"; fix.error = null; fix.confirm = false;
    fix.note = `${this.agentName()} is working on your reply`;
    const reply = { text, answer: null };
    fix.replies.push(reply);
    cx.spawn(async cx => {
      try {
        reply.answer = await session.ask(fixReplyPrompt(text));
        fix.files = splitDiff(await worktreeDiff(fix.path, this.on));
      } catch (e) { fix.error = String(e?.message ?? e); }
      fix.phase = "ready";
      cx.notify();
    });
  }

  closeFix() { this.phase = this.plan ? "tour" : "setup"; if (this.fix) this.fix.confirm = false; }

  /** Commits the fix and pushes it to the PR's branch. The first press only asks for a second one. */
  pushFix(cx) {
    const fix = this.fix, pr = this.pr;
    if (!fix || !pr || fix.phase !== "ready" || !fix.files?.length) return;
    if (!fix.confirm) { fix.confirm = true; return; }
    fix.confirm = false; fix.phase = "pushing"; fix.error = null;
    cx.spawn(async cx => {
      try {
        await pushFix(fix.path, this.on, pr, `Address review comments on #${pr.number}`);
        fix.phase = "pushed";
        await removeWorktree(this.git.root, this.on, pr);
        if (this.pr === pr) { this.comments = []; this.storeComments(cx); }
      } catch (e) { fix.phase = "ready"; fix.error = `Push failed: ${String(e?.message ?? e)}`; }
      cx.notify();
    });
  }

  /** Throws the fix away: the worktree and its branch are deleted. The comments stay. */
  discardFix(cx) {
    const fix = this.fix, pr = this.pr;
    if (!fix || !pr || (fix.phase !== "ready" && fix.phase !== "failed")) return;
    this.fix = null; this.closeFix();
    cx.spawn(async cx => { await removeWorktree(this.git.root, this.on, pr).catch(() => {}); cx.notify(); });
  }

  /** Opens the post-review screen for the saved comments. */
  startReview(cx) {
    // A peer's PR can be approved with no comments. Your own can only take comments.
    if (!this.pr || (this.comments.length === 0 && this.pr.mine)) return;
    this.leaveBox();
    if (!this.review || this.review.phase === "posted") {
      // With no comments the likely verdict is Approve, so it starts highlighted.
      const cursor = this.comments.length === 0 ? Math.max(0, eventsFor(this.pr).findIndex(e => e.id === "APPROVE")) : 0;
      this.review = { phase: "editing", cursor, confirm: false, url: null, error: null };
      this.summaryInput.set_value("");
    }
    this.phase = "review";
  }

  closeReview() {
    if (this.review?.phase === "posting") return;
    if (this.review?.phase === "posted") this.review = null;
    else if (this.review) this.review.confirm = false;
    this.leaveBox();
    this.phase = this.plan ? "tour" : "setup";
  }

  /** Moves the verdict highlight. Any change asks for the two presses again. */
  moveVerdict(i) {
    const r = this.review, n = this.pr ? eventsFor(this.pr).length : 0;
    if (!r || r.phase !== "editing" || n === 0) return;
    r.cursor = (i + n) % n; r.confirm = false;
  }

  /** True when the review has something to post: comments, an approval, or a summary. */
  canPost() {
    const r = this.review, pr = this.pr;
    if (!r || !pr || r.phase !== "editing") return false;
    const event = (eventsFor(pr)[r.cursor] ?? eventsFor(pr)[0]).id;
    return this.comments.length > 0 || event === "APPROVE" || this.summaryInput.value().trim() !== "";
  }

  /** Posts the comments as one GitHub review. The first press only asks for a second one. */
  postReview(cx) {
    const r = this.review, pr = this.pr;
    if (!this.canPost()) return;
    if (!r.confirm) { r.confirm = true; return; }
    const event = (eventsFor(pr)[r.cursor] ?? eventsFor(pr)[0]).id;
    const comments = [...this.comments], summary = this.summaryInput.value();
    r.confirm = false; r.phase = "posting"; r.error = null;
    this.leaveBox();
    cx.spawn(async cx => {
      try {
        r.url = await postReview(this.git.root, this.on, pr, comments, event, summary);
        r.phase = "posted";
        if (this.pr === pr) { this.comments = this.comments.filter(c => !comments.includes(c)); this.storeComments(cx); this.loadThreads(cx); }
      } catch (e) { r.phase = "editing"; r.error = `GitHub refused the review: ${String(e?.message ?? e)}`; }
      cx.notify();
    });
  }

  openReview() { if (this.review?.url) openUrl(this.review.url); }

  /** Opens the merge screen for your own PR and reads which merge methods the repo allows. */
  startMerge(cx) {
    const pr = this.pr;
    if (!pr?.mine) return; // never merge someone else's PR
    this.leaveBox();
    this.phase = "merge";
    if (this.merge && this.merge.phase !== "loading") { this.merge.confirm = false; return; }
    const m = this.merge = { phase: "loading", methods: null, cursor: 0, confirm: false, error: null };
    cx.spawn(async cx => {
      try { m.methods = await mergeMethods(this.git.root, this.on, pr); m.phase = "picking"; }
      catch (e) { m.methods = []; m.phase = "picking"; m.error = `Could not read the repo's merge settings: ${String(e?.message ?? e)}`; }
      cx.notify();
    });
  }

  closeMerge() {
    if (this.merge?.phase === "merging") return;
    if (this.merge) this.merge.confirm = false;
    this.phase = this.plan ? "tour" : "setup";
  }

  /** Moves the merge method highlight. Any change asks for the two presses again. */
  moveMethod(i) {
    const m = this.merge, n = m?.methods?.length ?? 0;
    if (!m || m.phase !== "picking" || n === 0) return;
    m.cursor = (i + n) % n; m.confirm = false;
  }

  /** Merges the PR with the picked method. The first press only asks for a second one. */
  doMerge(cx) {
    const m = this.merge, pr = this.pr, method = m?.methods?.[m.cursor];
    if (!m || !pr?.mine || m.phase !== "picking" || !method) return;
    if (!m.confirm) { m.confirm = true; return; }
    m.confirm = false; m.phase = "merging"; m.error = null;
    cx.spawn(async cx => {
      try { await mergePR(this.git.root, this.on, pr, method.id); m.phase = "merged"; }
      catch (e) { m.phase = "picking"; m.error = `GitHub did not merge it: ${String(e?.message ?? e)}`; }
      cx.notify();
    });
  }

  openPR() { if (this.pr?.url) openUrl(this.pr.url); }

  startAsking(cx) {
    if (this.busy) return;
    this.asking = true;
    this.focusBox(this.input, cx);
  }

  /** The setup steps for a scope, in order. A PR tour adds the PR picker. */
  steps(scope = this.scope) { return scope === "pr" ? ["scope", "pr", "depth"] : ["scope", "depth"]; }

  /** How many rows the current setup step has. */
  stepRows() { return this.step === "scope" ? SCOPES.length : this.step === "pr" ? (this.prs?.length ?? 0) : DEPTHS.length; }

  /** Moves the highlight within the current setup step. */
  moveCursor(delta) {
    const rows = this.stepRows();
    if (rows > 0) this.cursor = (this.cursor + delta + rows) % rows;
  }

  /** Shows a setup step with its current choice highlighted. */
  goStep(step) {
    this.step = step;
    this.cursor = step === "scope" ? SCOPES.findIndex(s => s.id === this.scope)
      : step === "pr" ? Math.max(0, (this.prs ?? []).findIndex(p => p.number === this.prNumber))
      : DEPTHS.findIndex(d => d.id === this.depth);
  }

  back() {
    const steps = this.steps(), i = steps.indexOf(this.step);
    if (i > 0) this.goStep(steps[i - 1]);
  }

  /** Loads the open PRs once they are needed. A failure (no gh, signed out) shows on the PR step and the next visit retries. */
  loadPRs(cx) {
    if (this.prs || this.prsLoading || !this.git.root) return;
    this.prsLoading = true; this.prsError = null;
    cx.spawn(async cx => {
      try { this.prs = await listPRs(this.git.root, this.on); }
      catch (e) { this.prsError = `${String(e?.message ?? e)} Press esc and pick Pull request again to retry.`; }
      this.prsLoading = false;
      if (this.step === "pr") this.goStep("pr");
      cx.notify();
    });
  }

  /** Enter on the highlighted row: move to the next step, or start the tour from the last one. */
  pick(cx) {
    // Finding the repo and the agent CLIs takes a few seconds. Until it's done there is
    // nothing to tour, and the detection would also reset the step under the reader.
    if (!this.git.root) return;
    if (this.step === "scope") {
      const s = SCOPES[this.cursor];
      if (s.id === "branch" && this.git.changed.length === 0) return;
      this.scope = s.id;
      if (s.id === "feature" && !this.featureInput.value().trim()) { this.focusBox(this.featureInput, cx); return; }
      this.leaveBox();
      this.goStep(this.steps()[1]);
      if (this.step === "pr") this.loadPRs(cx);
    } else if (this.step === "pr") {
      const p = this.prs?.[this.cursor];
      if (!p) return;
      this.prNumber = p.number;
      this.goStep("depth");
    } else {
      this.depth = DEPTHS[this.cursor].id;
      this.start(cx);
    }
  }

  /** Code beside the explanation when the pane is wide, unless the s key chose. */
  isSplit() { return this.split ?? this.width >= SPLIT_WIDTH; }

  toggleSplit() { this.split = !this.isSplit(); }

  openInEditor() {
    const s = this.plan?.stops[this.idx];
    if (!s) return;
    if (this.pr) openUrl(`${this.pr.url}/files`); // the PR's files aren't on disk
    else openInEditor(`${this.git.root}/${s.file}`, s.start);
  }

  reset(cx) {
    this.gen = (this.gen ?? 0) + 1;
    this.session?.stop(); this.session = null;
    this.fixSession?.stop(); this.fixSession = null; this.fix = null; // a fix's worktree stays and is reused next time
    this.review = null; this.merge = null;
    this.leaveBox();
    this.code?.release(); this.code = null;
    this.plan = null; this.busy = null; this.error = null;
    this.pr = null; this.prNumber = null; this.prs = null; this.diff = null; this.planNote = null; this.comments = []; this.threads = []; this.savedKey = null; this.viewed = {};
    this.files = null; this.other = null;
    this.phase = this.git.root ? "setup" : "error";
    this.goStep("scope");
    if (!this.git.root) cx.spawn(async cx => { this.phase = "setup"; await this.detect(); cx.notify(); });
  }

  key(e, cx) {
    const k = e.key;
    // A text box has the keyboard: it gets every key except esc and tab, which hand keys back.
    if (this.typing) {
      if (k === "escape" || k === "tab") { this.leaveBox(); cx.stop_propagation(); cx.notify(); }
      return;
    }
    if (e.modifiers?.control || e.modifiers?.alt || e.modifiers?.platform) return;
    // z zooms this pane to fill the tab and back, on every screen (Herdr's pane.zoom, ctrl-shift-z).
    if (k === "z") { run("pane.zoom"); cx.stop_propagation(); return; }
    let handled = true;
    if (this.phase === "setup" && !this.git.root) {
      handled = false; // still finding the repo; see pick()
    } else if (this.phase === "setup") {
      // Scopes and depths have letters. PRs take 1 to 9 for the first nine.
      const list = this.step === "scope" ? SCOPES : this.step === "depth" ? DEPTHS : null;
      const letter = list ? list.findIndex(x => x.key === k) : /^[1-9]$/.test(k) && +k <= this.stepRows() ? +k - 1 : -1;
      const onFeature = this.step === "scope" && SCOPES[this.cursor]?.id === "feature";
      if (letter >= 0) this.cursor = letter;
      else if (k === "j" || k === "down") this.moveCursor(1);
      else if (k === "k" || k === "up") this.moveCursor(-1);
      else if (k === "enter") this.pick(cx);
      else if (k === "tab" && onFeature) this.focusBox(this.featureInput, cx);
      else if (k === "escape" && this.step !== "scope") this.back();
      else if (k === "a" && this.agents.length > 1) this.switchAgent();
      else handled = false;
    } else if (this.phase === "planning") {
      if (k === "escape" || k === "q") this.reset(cx);
      else handled = false;
    } else if (this.phase === "tour") {
      if (k === "j" || k === "down") this.move(1, cx);
      else if (k === "k" || k === "up") this.move(-1, cx);
      else if (k === "d") this.deeper(cx);
      else if (k === "t") this.technical(cx);
      else if (k === "a" || k === "/") this.startAsking(cx);
      else if (k === "o") this.openInEditor();
      else if (k === "s") this.toggleSplit();
      else if (k === "b" && this.pr) this.showFiles = !this.showFiles;
      else if (k === "e" && this.other) this.explainFile(cx);
      else if (k === "v" && this.pr) this.toggleViewed(this.currentFile(), cx);
      else if (k === "m" && this.pr?.mine) this.startMerge(cx);
      else if (k === "escape" && this.commenting) this.leaveBox();
      else if (k === "f" && this.pr?.mine) this.startFix(cx);
      else if (k === "p" && this.pr) this.startReview(cx);
      else if (k === "r" && this.savedKey) this.replan(cx);
      else if (k === "q") this.reset(cx);
      else handled = false;
    } else if (this.phase === "fix") {
      if (k === "b" || k === "escape") this.closeFix();
      else if (k === "p") this.pushFix(cx);
      else if (k === "x") this.discardFix(cx);
      else if (k === "r" || k === "a" || k === "/") this.startReply(cx);
      else handled = false;
    } else if (this.phase === "merge") {
      const m = this.merge, n = /^[1-3]$/.test(k) ? +k - 1 : -1;
      if (k === "b" || k === "escape") this.closeMerge();
      else if (k === "m") this.doMerge(cx);
      else if (k === "o" && m?.phase === "merged") this.openPR();
      else if (n >= 0 && n < (m?.methods?.length ?? 0)) this.moveMethod(n);
      else if (k === "j" || k === "down") this.moveMethod((m?.cursor ?? 0) + 1);
      else if (k === "k" || k === "up") this.moveMethod((m?.cursor ?? 0) - 1);
      else handled = false;
    } else if (this.phase === "review") {
      const r = this.review, verdict = /^[1-3]$/.test(k) ? +k - 1 : -1;
      if (k === "b" || k === "escape") this.closeReview();
      else if (k === "p" || k === "enter") this.postReview(cx);
      else if (k === "o") this.openReview();
      else if (k === "tab" && r?.phase === "editing") this.focusBox(this.summaryInput, cx);
      else if (verdict >= 0 && this.pr && verdict < eventsFor(this.pr).length) this.moveVerdict(verdict);
      else if (k === "j" || k === "down") this.moveVerdict((r?.cursor ?? 0) + 1);
      else if (k === "k" || k === "up") this.moveVerdict((r?.cursor ?? 0) - 1);
      else handled = false;
    } else if (this.phase === "error") {
      if (k === "enter" || k === "q" || k === "escape") this.reset(cx);
      else handled = false;
    } else handled = false;
    if (handled) { cx.stop_propagation(); cx.notify(); }
  }

  render(cx) {
    const t = theme();
    const root = v_flex().id("tourist").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().min_h(0).text_color(t.foreground).text_size(13)
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } }); // no fill: the pane's own background shows, like a terminal
    if (this.phase === "setup") return root.child(setupView(this, t));
    if (this.phase === "planning") return root.child(planningView(this, t));
    if (this.phase === "error") return root.child(errorView(this, t));
    if (this.phase === "fix" && this.fix && this.pr) return root.child(fixView(this, t));
    if (this.phase === "review" && this.review && this.pr) return root.child(reviewView(this, t));
    if (this.phase === "merge" && this.merge && this.pr) return root.child(mergeView(this, t));
    return root.child(tourView(this, t));
  }
}
