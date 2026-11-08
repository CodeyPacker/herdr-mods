// Tourist: Claude or Codex walks you through a branch, the last commit, the whole repo, or a feature you describe, one stop at a time.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, TextView, InputState, Input } from "gpui-base";
import { spaces, panes, focused, exec, hc, readTextFile, writeTextFile, appHome, theme, settings, nextCommand, props, window } from "herdr";
import * as fs from "fs/promises";

const SCOPES = [
  { key: "b", id: "branch", label: "Branch changes", hint: "since this branch left the base, plus uncommitted edits" },
  { key: "c", id: "commit", label: "Last commit", hint: "HEAD only" },
  { key: "r", id: "repo", label: "Whole repo", hint: "slower, the agent surveys the codebase" },
  { key: "f", id: "feature", label: "A feature", hint: "describe it, the agent finds the code" },
];
const DEPTHS = [
  { key: "1", id: "overview", label: "Overview", text: "Plain language. Say what each part does and why it exists. 2 to 4 sentences per stop. No jargon." },
  { key: "2", id: "normal", label: "Normal", text: "Explain what the code does and how the pieces connect. 4 to 6 sentences per stop. Name the key functions and types." },
  { key: "3", id: "deep", label: "Deep", text: "Technical. Explain mechanisms, data flow, edge cases and tradeoffs. Up to 10 sentences per stop." },
];
// Read-only tools. Claude can look at the repo but never change it.
const TOOLS = ["--allowedTools", "Read", "Grep", "Glob", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git show:*)", "Bash(git status:*)"];
// The agents a tour can use, in the order Tourist prefers them.
const AGENTS = [{ id: "claude", name: "Claude" }, { id: "codex", name: "Codex" }];
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** The folder of the pane the tour was opened from, else the space's folder. */
function startFolder() {
  const f = focused(), space = spaces().find(s => s.active), all = panes();
  const mine = f?.pane ? all.find(p => p.pane === f.pane) : null;
  const sibling = mine ? all.find(p => p.tab === mine.tab && p.cwd) : null;
  return { cwd: mine?.cwd || sibling?.cwd || f?.cwd || space?.folder || null, on: space?.machine ?? null };
}

/** Pulls the JSON object out of the agent's reply, even with prose or fences around it. */
function parsePlan(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The agent did not return a tour plan.");
  const plan = JSON.parse(text.slice(a, b + 1));
  if (!Array.isArray(plan.stops) || plan.stops.length === 0) throw new Error("The tour plan has no stops.");
  for (const s of plan.stops) { s.file = String(s.file).replace(/\\/g, "/").replace(/^\.\//, ""); s.notes = []; }
  return plan;
}

export default class Tourist extends View {
  init(_props, cx) {
    const start = startFolder();
    this.cwd = props()?.folder ?? start.cwd; this.on = start.on;
    this.phase = "setup"; this.scope = "branch"; this.depth = "normal";
    this.git = { root: null, branch: "", base: null, mergeBase: null, changed: [], head: "" };
    this.plan = null; this.idx = 0; this.code = null; this.codeLines = 0; this.codeError = null;
    this.session = null; this.busy = null; this.error = null;
    this.agents = []; this.agent = null; // installed agent ids, and the one tours use
    this.step = 1;       // setup step: 1 what to tour, 2 how deep
    this.cursor = 0;      // highlighted row in the current step
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
    if (this.job) await hc(["kill", this.job]).catch(() => {});
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

  /** Runs git in the repo and returns trimmed stdout, or null on failure. */
  async run(args) {
    try {
      const r = await exec("git", args, { cwd: this.git.root ?? this.cwd ?? undefined, on: this.on });
      return r.code === 0 ? r.stdout.trim() : null;
    } catch { return null; }
  }

  async detect() {
    if (!this.cwd) { this.fail("No folder to tour. Open Tourist from a terminal inside a repo."); return; }
    const root = await this.run(["rev-parse", "--show-toplevel"]);
    if (!root) { this.fail(`${this.cwd} is not inside a git repo.`); return; }
    if (!(await this.findAgents())) { this.fail("Tourist needs the claude or codex CLI on PATH, signed in."); return; }
    this.git.root = root;
    this.git.branch = (await this.run(["branch", "--show-current"])) || "detached HEAD";
    this.git.head = (await this.run(["log", "-1", "--format=%h %s"])) || "";
    let base = await this.run(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
    if (!base) for (const b of ["main", "master"]) if (await this.run(["rev-parse", "--verify", "--quiet", b])) { base = b; break; }
    this.git.base = base;
    if (base) {
      this.git.mergeBase = await this.run(["merge-base", "HEAD", base]);
      const files = this.git.mergeBase ? await this.run(["diff", "--name-only", this.git.mergeBase]) : null;
      this.git.changed = files ? files.split("\n").filter(Boolean) : [];
    }
    if (this.git.changed.length === 0) this.scope = this.git.head ? "commit" : "repo";
    this.goStep(1);
  }

  /** Finds which agent CLIs are installed and picks the last one used, else the first found. */
  async findAgents() {
    // Ask the same shell the jobs run in, so PATH matches.
    const { argv, ps } = await this.shell();
    const found = await Promise.all(AGENTS.map(a =>
      exec(argv[0], [...argv.slice(1), ps ? `Get-Command ${a.id} -ErrorAction Stop` : `command -v ${a.id}`], { on: this.on })
        .then(r => r.code === 0, () => false)));
    this.agents = AGENTS.filter((_a, i) => found[i]).map(a => a.id);
    let saved = null;
    try { saved = localStorage.getItem("agent"); } catch {}
    this.agent = this.agents.includes(saved) ? saved : this.agents[0] ?? null;
    return this.agent !== null;
  }

  /** Switches to the next installed agent and remembers it. */
  switchAgent() {
    if (this.agents.length < 2) return;
    this.agent = this.agents[(this.agents.indexOf(this.agent) + 1) % this.agents.length];
    try { localStorage.setItem("agent", this.agent); } catch {}
  }

  agentName() { return AGENTS.find(a => a.id === this.agent)?.name ?? "The agent"; }

  fail(message) { this.phase = "error"; this.error = message; this.busy = null; }

  subject() {
    const g = this.git;
    if (this.scope === "branch") return `The changes on branch "${g.branch}" compared with ${g.base} (merge base ${g.mergeBase}), including uncommitted edits. Changed files:\n${g.changed.join("\n")}\nRead the changes with \`git diff ${g.mergeBase} -- <file>\` and the surrounding code as needed. Point the stops at the changed code.`;
    if (this.scope === "commit") return `The most recent commit (${g.head}). Read it with \`git show HEAD\` and the surrounding code as needed. Point the stops at the changed code.`;
    if (this.scope === "feature") return `A feature the reader described in their own words: "${this.featureInput.value().trim()}". Find the code that implements it with Grep and Glob. Start the tour where the feature begins (a key, route, command or call) and follow it to where the work happens. If nothing matches, return one stop at the closest code and say so in its body.`;
    return "The whole repository. Start from the README, the manifests and the entry points.";
  }

  depthText() { return DEPTHS.find(d => d.id === this.depth)?.text ?? ""; }

  /** The shell that runs an agent job: [argv..., script]. */
  async shell() {
    if (window()?.platform !== "windows") return { argv: ["sh", "-c"], ps: false };
    const pwsh = await exec("pwsh", ["-NoLogo", "-Command", "exit 0"]).then(r => r.code === 0, () => false);
    return { argv: [pwsh ? "pwsh" : "powershell.exe", "-NoLogo", "-NoProfile", "-Command"], ps: true };
  }

  /**
   * One agent call. Follow-ups resume the planning session so the agent keeps what it read.
   * exec stops anything over 30 s, so the agent runs as a hidden herdr-core terminal
   * that reads the prompt from a file and writes its reply to another.
   * Claude: `claude -p`, one JSON reply. Codex: `codex exec` in a read-only sandbox,
   * JSONL events on stdout (the session id) and its last message in a file.
   */
  async askAgent(prompt) {
    const agent = this.agent, name = this.agentName();
    const dir = `${appHome()}/data/tourist`.replace(/\\/g, "/");
    await fs.mkdir(dir, { recursive: true });
    const id = `${Date.now()}-${(this.jobs = (this.jobs ?? 0) + 1)}`;
    const inFile = `${dir}/${id}.in.txt`, outFile = `${dir}/${id}.out.json`, errFile = `${dir}/${id}.err.txt`, lastFile = `${dir}/${id}.last.txt`;
    await writeTextFile(inFile, prompt, null);
    const flags = agent === "codex"
      ? ["exec", ...(this.session ? ["resume", this.session, "-c", 'sandbox_mode="read-only"'] : ["--sandbox", "read-only"]), "--json", "-o", lastFile, "-"]
      : ["-p", "--output-format", "json", ...(this.session ? ["--resume", this.session] : []), ...TOOLS];
    const { argv, ps } = await this.shell();
    const q = ps ? (s => `'${s.replace(/'/g, "''")}'`) : (s => `'${s.replace(/'/g, `'\\''`)}'`);
    const script = ps
      ? `$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); Get-Content -Raw -Encoding utf8 -LiteralPath ${q(inFile)} | ${agent} ${flags.map(q).join(" ")} 2> ${q(errFile)} | Set-Content -NoNewline -Encoding utf8 -LiteralPath ${q(outFile)}`
      : `${agent} ${flags.map(q).join(" ")} < ${q(inFile)} > ${q(outFile)} 2> ${q(errFile)}`;
    const started = await hc(["run", "--bg", "--no-parent", "--outlive-parent", "--cwd", this.git.root ?? "", "--json", "--", ...argv, script]);
    if (started.code !== 0) throw new Error(started.stderr || `Could not start ${agent}.`);
    const address = JSON.parse(started.stdout).address;
    this.job = address;
    try {
      for (;;) {
        const w = await hc(["wait", address, "--timeout", "20", "--json"]);
        if (w.code !== 0 || JSON.parse(w.stdout).ended) break;
      }
    } finally {
      this.job = null;
      await hc(["rm", address]).catch(() => {});
    }
    const text = ((await readTextFile(outFile)) ?? "").replace(/^﻿/, "");
    const err = (await readTextFile(errFile)) ?? "";
    const last = agent === "codex" ? ((await readTextFile(lastFile).catch(() => null)) ?? "").replace(/^﻿/, "") : "";
    for (const f of [inFile, outFile, errFile, lastFile]) await fs.unlink(f).catch(() => {});
    if (agent === "codex") {
      let failure = null;
      for (const line of text.split(/\r?\n/)) {
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "thread.started" && ev.thread_id) this.session = ev.thread_id;
        if (ev.type === "turn.failed" || ev.type === "error") failure = ev.error?.message ?? ev.message ?? failure;
      }
      if (failure || !last.trim()) throw new Error(String(failure || err || text || `${name} returned nothing.`).trim().slice(-600));
      return last;
    }
    let out;
    try { out = JSON.parse(text); }
    catch { throw new Error((err || text || `${name} returned nothing.`).trim().slice(-600)); }
    if (out.session_id) this.session = out.session_id;
    if (out.is_error) throw new Error(String(out.result || `${name} reported an error.`));
    return String(out.result ?? "");
  }

  start(cx) {
    if (this.phase !== "setup" || !this.git.root) return;
    if (this.scope === "branch" && this.git.changed.length === 0) return;
    if (this.scope === "feature" && !this.featureInput.value().trim()) { this.focusBox(this.featureInput, cx); return; }
    this.leaveBox();
    this.phase = "planning"; this.session = null;
    const prompt = [
      "You are giving a guided code tour inside a desktop app. The reader sees one stop at a time: an excerpt from one file next to your explanation.",
      `Subject: ${this.subject()}`,
      `Depth: ${this.depthText()}`,
      "Read the code you need with your tools. Then reply with ONLY a JSON object, no prose and no code fences, in this shape:",
      '{"title": "short tour title", "summary": "markdown, 2 to 4 sentences", "stops": [{"file": "repo-relative path with forward slashes", "start": 1, "end": 40, "title": "short stop title", "body": "markdown explanation"}]}',
      "Rules: 4 to 10 stops (4 to 6 for an overview). Order the stops so each builds on the last, starting where a newcomer should start. Keep each excerpt under 60 lines. Line numbers must match the file as it is on disk now. Only claim what the code you read shows.",
    ].join("\n\n");
    const gen = this.gen = (this.gen ?? 0) + 1;
    cx.spawn(async cx => {
      try {
        const plan = parsePlan(await this.askAgent(prompt));
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
      let text = null;
      try { text = await readTextFile(`${this.git.root}/${s.file}`, { on: this.on }); } catch { text = null; }
      if (this.idx !== idx) return;
      if (text === null) { this.codeError = `Cannot read ${s.file}`; cx.notify(); return; }
      const lines = text.split(/\r?\n/);
      const a = Math.max(1, Number(s.start) || 1), b = Math.min(lines.length, Math.max(a, Number(s.end) || a + 40));
      s.start = a; s.end = b;
      const excerpt = lines.slice(a - 1, b).join("\n");
      const t = theme(), ext = s.file.includes(".") ? s.file.split(".").pop() : "txt";
      this.codeLines = b - a + 1;
      this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true, value: excerpt, line_numbers: false,
        font_family: settings().font_family, font_size: 12,
        syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
      cx.notify();
    });
  }

  /** Sends a follow-up about the current stop and adds the answer under it. */
  followUp(label, question, cx) {
    if (this.busy || !this.plan) return;
    const s = this.plan.stops[this.idx];
    this.busy = label;
    const prompt = `${question}\n\nThis is about stop ${this.idx + 1}, "${s.title}" (${s.file} lines ${s.start}-${s.end}). Read more code if you need to. Reply in markdown only, under 250 words, with file:line references.`;
    cx.spawn(async cx => {
      try { s.notes.push({ label, text: await this.askAgent(prompt) }); }
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

  openInEditor() {
    const s = this.plan?.stops[this.idx];
    if (!s) return;
    const target = `${this.git.root}/${s.file}:${s.start}`;
    const win = window()?.platform === "windows";
    exec(win ? "cmd" : "code", win ? ["/c", "code", "-g", target] : ["-g", target]).catch(() => {});
  }

  reset(cx) {
    this.gen = (this.gen ?? 0) + 1;
    if (this.job) { hc(["kill", this.job]).catch(() => {}); this.job = null; }
    this.leaveBox();
    this.code?.release(); this.code = null;
    this.plan = null; this.session = null; this.busy = null; this.error = null;
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
      .size_full().min_h(0).text_color(t.foreground).text_size(13); // no fill: the pane's own background shows, like a terminal
    if (this.phase === "setup") return root.child(this.setupView(t, cx));
    if (this.phase === "planning") return root.child(this.planningView(t));
    if (this.phase === "error") return root.child(this.errorView(t));
    return root.child(this.tourView(t, cx));
  }

  // ---- views ----

  badge(t, letter, on) {
    return div().w(20).h(20).flex_none().flex().items_center().justify_center().rounded(5).text_size(11).font_semibold()
      .bg(on ? t.accent : t.raised).text_color(on ? t.accent_foreground : t.muted).child(letter);
  }

  option(t, id, letter, label, hint, on, here, click) {
    return h_flex().id(id).gap(10).px(10).py(7).rounded(7).items_center().cursor_pointer()
      .when(on, el => el.bg(t.selected)).hover(s => s.bg(t.hover))
      .on_click(click)
      .child(this.badge(t, letter, on))
      .child(v_flex().flex_1().min_w(0).gap(1).child(div().font_medium().child(label)).child(div().text_size(11.5).text_color(t.dim).child(hint)));
  }

  setupView(t, cx) {
    const g = this.git;
    const noChanges = g.changed.length === 0;
    const section = (title) => div().pt(14).pb(6).text_size(11.5).text_color(t.dim).child(title);
    const head = v_flex()
      .child(div().text_size(16).font_semibold().child("Tourist"))
      .child(div().pt(2).text_size(11.5).text_color(t.dim).child(g.root ? `${g.root} · ${g.branch}` : "Finding the repo…"))
      .when(Boolean(this.agent), el => el.child(h_flex().id("agent").pt(2).gap(4).text_size(11.5).text_color(t.dim)
        .when(this.agents.length > 1, el => el.cursor_pointer().on_click((_e, cx) => { this.switchAgent(); cx.notify(); }))
        .child(`Tour by ${this.agentName()}`)
        .when(this.agents.length > 1, el => el.child(div().text_color(t.accent).child("· a switches")))));
    // A click works like moving there and pressing enter.
    const click = (i) => (_e, cx) => { this.leaveBox(); this.cursor = i; this.pick(cx); cx.notify(); };
    let rows, title, help;
    if (this.step === 1) {
      title = "Step 1 of 2 · What to tour";
      rows = SCOPES.map((s, i) => {
        const hint = s.id === "branch" ? (g.base ? (noChanges ? `no changes vs ${g.base}` : `${g.changed.length} files vs ${g.base}`) : "no base branch found")
          : s.id === "commit" ? (g.head || s.hint) : s.hint;
        return this.option(t, `scope-${s.id}`, s.key, s.label, hint, this.cursor === i, this.cursor === i, click(i));
      });
      const onFeature = SCOPES[this.cursor]?.id === "feature";
      if (onFeature) {
        const box = div().pl(40).pr(10).pt(2).pb(6).child(Input.new(this.featureInput).h(32).px(10).rounded(8).border_1()
          .border_color(this.typing === "feature" ? t.accent : t.input).bg(t.background).text_size(12.5));
        rows.splice(this.cursor + 1, 0, box);
      }
      help = this.typing === "feature" ? "type the feature · enter next · tab or esc back to the list"
        : onFeature ? "j/k move · tab types · enter next" : "j/k move · enter next";
    } else {
      const s = SCOPES.find(s => s.id === this.scope);
      title = "Step 2 of 2 · How deep";
      rows = DEPTHS.map((d, i) => this.option(t, `depth-${d.id}`, d.key, d.label, d.text.split(". ")[0], this.cursor === i, this.cursor === i, click(i)));
      rows.unshift(div().pb(8).text_size(12).text_color(t.muted)
        .child(`Touring: ${s?.label ?? ""}${this.scope === "feature" ? ` · "${this.featureInput.value().trim()}"` : ""}`));
      help = "j/k move · enter starts the tour · esc back";
    }
    return v_flex().id("setup").flex_1().min_h(0).overflow_y_scrollbar().p(18)
      .child(head)
      .child(section(title))
      .children(rows)
      .child(div().pt(14).text_size(11.5).text_color(t.dim).child(help));
  }

  planningView(t) {
    const scope = SCOPES.find(s => s.id === this.scope)?.label ?? "";
    return v_flex().flex_1().items_center().justify_center().gap(8).p(24)
      .child(div().text_size(22).text_color(t.accent).frames(SPINNER, 90).child(SPINNER[0]))
      .child(div().font_medium().child(`${this.agentName()} is planning the tour`))
      .child(div().text_size(11.5).text_color(t.dim).child(`${scope} · ${this.depth}. Usually 30 to 90 seconds, longer for a whole repo.`))
      .child(div().pt(6).text_size(11.5).text_color(t.dim).child("q or esc cancels"));
  }

  errorView(t) {
    return v_flex().flex_1().p(18).gap(10)
      .child(div().font_semibold().text_color(t.ansi1).child("Tour stopped"))
      .child(div().text_size(12).text_color(t.muted).child(this.error ?? ""))
      .child(div().text_size(11.5).text_color(t.dim).child("enter or q to start over"));
  }

  tourView(t, cx) {
    const plan = this.plan, s = plan.stops[this.idx], last = plan.stops.length - 1;
    const codeHeight = Math.min(360, Math.max(80, this.codeLines * 17 + 24));
    const header = h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
      .child(div().text_size(11.5).text_color(t.dim).child(`${this.idx + 1} / ${plan.stops.length}`))
      .child(div().flex_1().min_w(0).truncate().font_semibold().child(s.title))
      .child(div().max_w(200).truncate().text_size(11.5).text_color(t.dim).child(plan.title ?? ""));
    const fileLine = h_flex().id("file").px(14).py(6).gap(8).items_center().cursor_pointer()
      .hover(st => st.bg(t.hover)).on_click(() => this.openInEditor())
      .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.accent).font_family(settings().font_family).child(s.file))
      .child(div().text_size(11.5).text_color(t.dim).child(`lines ${s.start}–${s.end}  ·  o opens`));
    const code = div().h(codeHeight).mx(14).rounded(8).border_1().border_color(t.border).bg(t.background).overflow_hidden()
      .child(this.code ? Editor.new(this.code).size_full() : div().p(10).text_size(12).text_color(t.dim).child(this.codeError ?? "Loading…"));
    const notes = s.notes.map((n, i) => v_flex().gap(4).pt(6).border_t_1().border_color(t.border)
      .child(div().text_size(11.5).font_semibold().text_color(t.accent).child(n.label))
      .child(TextView.markdown(`note-${this.idx}-${i}`, n.text).selectable()));
    // Cap the line length so long explanations stay readable in wide panes.
    const body = v_flex().w_full().max_w(680).gap(10)
      .when(this.idx === 0 && Boolean(plan.summary), el => el.child(v_flex().p(10).rounded(8).bg(t.raised)
        .child(TextView.markdown("summary", String(plan.summary)).selectable())))
      .child(TextView.markdown(`body-${this.idx}`, String(s.body ?? "")).selectable())
      .children(notes)
      .when(Boolean(this.busy), el => el.child(h_flex().gap(8).items_center().text_color(t.dim)
        .child(div().text_color(t.accent).frames(SPINNER, 90).child(SPINNER[0]))
        .child(div().text_size(12).child(`${this.busy}…`))));
    const explain = v_flex().id(`explain-${this.idx}`).flex_1().min_h(0).overflow_y_scrollbar().px(14).py(12).child(body);
    // The ask box is only drawn while asking, so tour keys can never land in it.
    const ask = div().px(14).pb(8).child(Input.new(this.input).h(32).px(10).rounded(8).border_1()
      .border_color(t.accent).bg(t.background).text_size(12.5));
    const btn = (id, label, keyHint, enabled, click) => h_flex().id(id).h(28).px(10).gap(6).items_center().rounded(7)
      .border_1().border_color(t.border).bg(t.raised).text_size(12)
      .text_color(enabled ? t.foreground : t.dim)
      .when(enabled, el => el.cursor_pointer().hover(st => st.bg(t.hover)).on_click(click))
      .child(div().text_color(t.accent).child(keyHint)).child(label);
    const free = !this.busy;
    const bar = h_flex().px(14).py(10).gap(6).flex_wrap().border_t_1().border_color(t.border)
      .child(btn("prev", "Back", "b", this.idx > 0, (_e, cx) => { this.show(this.idx - 1, cx); cx.notify(); }))
      .child(btn("next", this.idx === last ? "Last stop" : "Next", "n", this.idx < last, (_e, cx) => { this.show(this.idx + 1, cx); cx.notify(); }))
      .child(btn("deeper", "Deeper", "d", free, (_e, cx) => { this.deeper(cx); cx.notify(); }))
      .child(btn("tech", "More technical", "t", free, (_e, cx) => { this.technical(cx); cx.notify(); }))
      .child(btn("askbtn", "Ask", "a", free, (_e, cx) => { this.startAsking(cx); cx.notify(); }))
      .child(btn("restart", "New tour", "q", true, (_e, cx) => { this.reset(cx); cx.notify(); }));
    return v_flex().flex_1().min_h(0).child(header).child(fileLine).child(code).child(explain)
      .when(this.asking, el => el.child(ask)).child(bar);
  }
}
