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
import { subject, planPrompt, followUpPrompt, parsePlan } from "./plan.js";
import { readExcerpt, codeState, openInEditor } from "./code.js";
import { setupView } from "./views/setup.js";
import { tourView } from "./views/tour.js";
import { planningView, errorView } from "./views/status.js";

export default class Tourist extends View {
  init(_props, cx) {
    const start = startFolder();
    this.cwd = props()?.folder ?? start.cwd; this.on = start.on;
    this.phase = "setup"; this.scope = "branch"; this.depth = "normal";
    this.git = { root: null, branch: "", base: null, mergeBase: null, changed: [], head: "" };
    this.plan = null; this.idx = 0; this.code = null; this.codeLines = 0; this.codeError = null;
    this.session = null;  // the AgentSession of the tour in progress
    this.busy = null; this.error = null;
    this.agents = []; this.agent = null; // installed agent ids, and the one tours use
    this.step = 1;       // setup step: 1 what to tour, 2 how deep
    this.cursor = 0;      // highlighted row in the current step
    this.split = null;    // null: split when the pane is wide enough. true or false: the s key chose
    this.width = 0;       // the pane width, from on_size_change
    this.asking = false;  // the ask box only exists while asking, so it can't take tour keys
    this.typing = null;   // "ask" | "feature" while a text box has the keyboard
    this.input = this.textBox("ask", "Ask about this stop, then press enter", cx => this.ask(cx));
    this.featureInput = this.textBox("feature", "e.g. how a space gets its hint letter", cx => this.pick(cx));
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
    this.typing = null; this.asking = false;
    this.handle.focus();
  }

  async close() {
    this.code?.release(); this.input.release(); this.featureInput.release();
    await this.session?.stop();
  }

  /** `tourist.<name>` commands: focus, start, next, prev, deeper, technical, open, reset, agent, scope-<id>, depth-<id>. */
  command(c, cx) {
    if (c === "focus") this.handle.focus();
    else if (c.startsWith("scope-")) { this.scope = c.slice(6); this.goStep(1); }
    else if (c.startsWith("depth-")) { this.depth = c.slice(6); this.goStep(2); }
    else if (c === "down") this.moveCursor(1);
    else if (c === "up") this.moveCursor(-1);
    else if (c === "pick") this.pick(cx);
    else if (c === "back") this.goStep(1);
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
    this.goStep(1);
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
    this.leaveBox();
    this.phase = "planning";
    const session = this.session = new AgentSession(this.agent, this.git.root);
    const prompt = planPrompt(subject(this.scope, this.git, this.featureInput.value().trim()), this.depth);
    const gen = this.gen = (this.gen ?? 0) + 1;
    cx.spawn(async cx => {
      try {
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
    this.code?.release(); this.code = null; this.codeError = null;
    const s = this.plan.stops[this.idx], idx = this.idx;
    cx.spawn(async cx => {
      const excerpt = await readExcerpt(this.git.root, s, this.on);
      if (this.idx !== idx) return;
      if (!excerpt) { this.codeError = `Cannot read ${s.file}`; cx.notify(); return; }
      s.start = excerpt.start; s.end = excerpt.end;
      this.codeLines = excerpt.end - excerpt.start + 1;
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

  startAsking(cx) {
    if (this.busy) return;
    this.asking = true;
    this.focusBox(this.input, cx);
  }

  /** Moves the highlight within the current setup step. */
  moveCursor(delta) {
    const rows = this.step === 1 ? SCOPES.length : DEPTHS.length;
    this.cursor = (this.cursor + delta + rows) % rows;
  }

  /** Step 1: what to tour. Step 2: how deep. */
  goStep(step) {
    this.step = step;
    this.cursor = step === 1 ? SCOPES.findIndex(s => s.id === this.scope) : DEPTHS.findIndex(d => d.id === this.depth);
  }

  /** Enter on the highlighted row: step 1 moves on to step 2, step 2 starts the tour. */
  pick(cx) {
    if (this.step === 1) {
      const s = SCOPES[this.cursor];
      if (s.id === "branch" && this.git.changed.length === 0) return;
      this.scope = s.id;
      if (s.id === "feature" && !this.featureInput.value().trim()) { this.focusBox(this.featureInput, cx); return; }
      this.leaveBox();
      this.goStep(2);
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
    if (s) openInEditor(`${this.git.root}/${s.file}`, s.start);
  }

  reset(cx) {
    this.gen = (this.gen ?? 0) + 1;
    this.session?.stop(); this.session = null;
    this.leaveBox();
    this.code?.release(); this.code = null;
    this.plan = null; this.busy = null; this.error = null;
    this.phase = this.git.root ? "setup" : "error";
    this.goStep(1);
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
      const letter = this.step === 1 ? SCOPES.findIndex(s => s.key === k) : DEPTHS.findIndex(d => d.key === k);
      const onFeature = this.step === 1 && SCOPES[this.cursor]?.id === "feature";
      if (letter >= 0) this.cursor = letter;
      else if (k === "j" || k === "down") this.moveCursor(1);
      else if (k === "k" || k === "up") this.moveCursor(-1);
      else if (k === "enter") this.pick(cx);
      else if (k === "tab" && onFeature) this.focusBox(this.featureInput, cx);
      else if (k === "escape" && this.step === 2) this.goStep(1);
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
