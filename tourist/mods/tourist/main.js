// Tourist: Claude or Codex walks you through a branch, the last commit, the whole repo, or a feature you describe, one stop at a time.
// This file holds the view's state, keys and flow. The pieces it uses:
//   constants.js  scopes, depths, agents and other fixed tables
//   git.js        the folder to tour and its repo facts
//   agent.js      finding Claude or Codex and talking to it
//   plan.js       the prompts and reading the tour plan
//   code.js       a stop's lines, its editor, opening VS Code
//   ui.js         shared buttons, rows and inputs
//   views/        the setup, tour, planning and error screens
import { View } from "gpui-kit";
import { v_flex, InputState } from "gpui-base";
import { theme, nextCommand, props } from "herdr";
import { SCOPES, DEPTHS, SPLIT_WIDTH } from "./constants.js";
import { startFolder, readRepo } from "./git.js";
import { AgentSession, agentName, findAgents, rememberAgent } from "./agent.js";
import { subject, planPrompt, prSubject, prPlanPrompt, followUpPrompt, parsePlan } from "./plan.js";
import { readExcerpt, codeState, openInEditor, openUrl } from "./code.js";
import { listPRs, loadPR, prFileDiff } from "./pr.js";
import { diffRows, rowsInRange } from "./diff.js";
import { commentKey, loadComments, saveComments, sideOf } from "./comments.js";
import { setupView } from "./views/setup.js";
import { tourView } from "./views/tour.js";
import { planningView, errorView } from "./views/status.js";

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
    this.prs = null; this.prsError = null; // the open PRs, loaded when the PR step first opens
    this.prNumber = null; this.pr = null;  // the picked PR, and its details once the tour starts
    this.diff = null;     // the stop's diff rows, on PR tours
    this.planNote = null; // what planning is waiting on before the agent starts
    this.comments = [];   // line comments on the PR, saved by comments.js
    this.commenting = null; // { file, line, side, code } while the comment box is open
    this.cursor = 0;      // highlighted row in the current step
    this.split = null;    // null: split when the pane is wide enough. true or false: the s key chose
    this.width = 0;       // the pane width, from on_size_change
    this.asking = false;  // the ask box only exists while asking, so it can't take tour keys
    this.typing = null;   // "ask" | "feature" while a text box has the keyboard
    this.input = this.textBox("ask", "Ask about this stop, then press enter", cx => this.ask(cx));
    this.featureInput = this.textBox("feature", "e.g. how a space gets its hint letter", cx => this.pick(cx));
    this.commentInput = this.textBox("comment", "Comment on this line, then press enter", cx => this.saveComment(cx));
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
    this.typing = null; this.asking = false; this.commenting = null;
    this.handle.focus();
  }

  async close() {
    this.code?.release(); this.input.release(); this.featureInput.release(); this.commentInput.release();
    await this.session?.stop();
  }

  /** `tourist.<name>` commands: focus, start, next, prev, deeper, technical, open, reset, agent, scope-<id>, depth-<id>. */
  command(c, cx) {
    if (c === "focus") this.handle.focus();
    else if (c.startsWith("scope-")) { this.scope = c.slice(6); this.goStep("scope"); }
    else if (c.startsWith("depth-")) { this.depth = c.slice(6); this.goStep("depth"); }
    else if (c === "down") this.moveCursor(1);
    else if (c === "up") this.moveCursor(-1);
    else if (c === "pick") this.pick(cx);
    else if (c === "back") this.back();
    else if (c === "start") this.start(cx);
    else if (c === "next") this.show(this.idx + 1, cx);
    else if (c === "prev") this.show(this.idx - 1, cx);
    else if (c === "deeper") this.deeper(cx);
    else if (c === "technical") this.technical(cx);
    else if (c === "open") this.openInEditor();
    else if (c === "reset") this.reset(cx);
    else if (c === "agent") this.switchAgent();
  }

  async detect() {
    if (!this.cwd) { this.fail("No folder to tour. Open Tourist from a terminal inside a repo."); return; }
    const repo = await readRepo(this.cwd, this.on);
    if (!repo) { this.fail(`${this.cwd} is not inside a git repo.`); return; }
    const found = await findAgents(this.on);
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
        let prompt;
        if (this.scope === "pr") {
          this.planNote = `Fetching PR #${this.prNumber}`; cx.notify();
          const pr = await loadPR(this.git.root, this.on, this.prNumber);
          if (gen !== this.gen) return;
          this.pr = pr; this.planNote = null;
          this.comments = await loadComments(commentKey(this.git.root, pr.number));
          cx.notify();
          prompt = prPlanPrompt(prSubject(pr), this.depth);
        } else prompt = planPrompt(subject(this.scope, this.git, this.featureInput.value().trim()), this.depth);
        const plan = parsePlan(await session.ask(prompt));
        if (gen !== this.gen) return;
        this.plan = plan; this.phase = "tour"; this.show(0, cx);
      } catch (e) { if (gen === this.gen) this.fail(String(e?.message ?? e)); }
      cx.notify();
    });
  }

  show(i, cx) {
    if (!this.plan) return;
    this.idx = Math.max(0, Math.min(i, this.plan.stops.length - 1));
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
    const s = this.plan.stops[this.idx], session = this.session;
    this.busy = label;
    cx.spawn(async cx => {
      try { s.notes.push({ label, text: await session.ask(followUpPrompt(question, s, this.idx + 1)) }); }
      catch (e) { s.notes.push({ label: "Error", text: String(e?.message ?? e) }); }
      this.busy = null; cx.notify();
    });
  }

  deeper(cx) { this.followUp("Deeper", "Go deeper on this stop: what else in this file and the code it calls matters here?", cx); }
  technical(cx) { this.followUp("More technical", "Explain this stop again, more technically: exact mechanisms, types, data flow and edge cases.", cx); }
  ask(cx) {
    const q = this.input.value().trim();
    if (!q || this.busy) return;
    this.input.set_value("");
    this.leaveBox();
    this.followUp(`You asked: ${q}`, q, cx);
  }

  /** Opens the comment box under a diff line of the current stop. */
  startComment(row, cx) {
    const s = this.plan?.stops[this.idx];
    if (!this.pr || !s || row.number === undefined) return;
    this.asking = false;
    this.commenting = { file: s.file, line: row.number, side: sideOf(row), code: row.text };
    this.commentInput.set_value("");
    this.focusBox(this.commentInput, cx);
  }

  /** Saves the open comment. An empty one just closes the box. */
  saveComment(cx) {
    const text = this.commentInput.value().trim(), at = this.commenting;
    this.commentInput.set_value("");
    this.leaveBox();
    if (!text || !at || !this.pr) return;
    this.comments.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...at, text, created: new Date().toISOString() });
    this.storeComments(cx);
  }

  deleteComment(comment, cx) {
    this.comments = this.comments.filter(c => c.id !== comment.id);
    this.storeComments(cx);
  }

  storeComments(cx) {
    const key = commentKey(this.git.root, this.pr.number), list = this.comments;
    cx.spawn(async () => { await saveComments(key, list).catch(() => {}); });
  }

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

  /** Loads the open PRs once. A failure (no gh, signed out) shows on the PR step. */
  loadPRs(cx) {
    if (this.prs || this.prsLoading) return;
    this.prsLoading = true; this.prsError = null;
    cx.spawn(async cx => {
      try { this.prs = await listPRs(this.git.root, this.on); }
      catch (e) { this.prs = []; this.prsError = String(e?.message ?? e); }
      this.prsLoading = false;
      if (this.step === "pr") this.goStep("pr");
      cx.notify();
    });
  }

  /** Enter on the highlighted row: move to the next step, or start the tour from the last one. */
  pick(cx) {
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
    this.leaveBox();
    this.code?.release(); this.code = null;
    this.plan = null; this.busy = null; this.error = null;
    this.pr = null; this.prNumber = null; this.prs = null; this.diff = null; this.planNote = null; this.comments = [];
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
    let handled = true;
    if (this.phase === "setup") {
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
      if (k === "n" || k === "right" || k === "l") this.show(this.idx + 1, cx);
      else if (k === "b" || k === "left" || k === "h") this.show(this.idx - 1, cx);
      else if (k === "d") this.deeper(cx);
      else if (k === "t") this.technical(cx);
      else if (k === "a" || k === "/") this.startAsking(cx);
      else if (k === "o") this.openInEditor();
      else if (k === "s") this.toggleSplit();
      else if (k === "escape" && this.commenting) this.leaveBox();
      else if (k === "q") this.reset(cx);
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
    return root.child(tourView(this, t));
  }
}
