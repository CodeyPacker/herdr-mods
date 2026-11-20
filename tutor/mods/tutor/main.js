// Tutor: a language course taught from a codebase you pick, one code stop at a time, with a quiz
// and practice per module. Claude plans the course from the repo, then writes each module and
// its practice the first time they are opened.
// This file holds the view's state, keys and commands. The pieces it uses:
//   constants.js  fixed tables (tools, sizes, what the learner knows)
//   languages.js  the languages a course can teach (lang/ holds each one)
//   course.js     where courses live, and reading the repo
//   build.js      writing the plan, modules and exercises with Claude (validate.js checks them)
//   progress.js   loading and saving a course's progress.json
//   settings.js   the editor, agent and default "what I know" shared by every course
//   learner.js    what the learner knows, and what lessons compare to
//   code.js       a stop's lines at the pinned commit, its editor, opening files in an editor
//   agent.js      the claude CLI
//   prompts.js    every prompt
//   practice.js   the practice files and runs
//   practice-range.js  the optional link to Practice Range, when it is installed
//   views/        the setup, build, home, lesson, quiz, result and practice screens
import { View } from "gpui-kit";
import { InputState, ScrollHandle, v_flex } from "gpui-base";
import { nextCommand, run, exec, panes, focused, pickFolder, spaces, watchFolder } from "herdr";
import { colors } from "./kit/theme.js";
import { assignLetters, navigateByLetter } from "./kit/letters.js";
import { SPLIT_WIDTH, PASS_SHARE, RESERVED, DEEPER } from "./constants.js";
import { learnerOf, likeKnownQuestion, parseKnown } from "./learner.js";
import { EDITORS, loadSettings, saveSettings, cleanSettings, nextOf } from "./settings.js";
import { LANGUAGES, DEFAULT_LANGUAGE, languageOf } from "./languages.js";
import { currentSlug, setCurrent, slugFor, loadCourse, saveCourse, loadModule, saveModule, loadExercises, saveExercises, listCourses, repoInfo, checkRepo, courseDir } from "./course.js";
import { writeOutline, writeModule, writeExercises, writeMatches } from "./build.js";
import { practiceRangeTopics, openPracticeRange } from "./practice-range.js";
import { fresh, loadProgress, saveProgress, merge } from "./progress.js";
import { fileAt, codeState, liveLine, openInVSCode, neovimOpenExpression } from "./code.js";
import { AgentSession, haveClaude } from "./agent.js";
import { framePrompt, stopPrompt, hintPrompt, practiceQuestionPrompt } from "./prompts.js";
import { ensureWork, resetWork, readWork, runExercise, runSource, haveTool, workDir, workFile, editorPipe, reloadEditor } from "./practice.js";
import { setupView } from "./views/setup.js";
import { buildView } from "./views/build.js";
import { homeView } from "./views/home.js";
import { lessonView } from "./views/lesson.js";
import { quizView, resultView } from "./views/quiz.js";
import { practiceView } from "./views/practice.js";

export default class Tutor extends View {
  init(_props, cx) {
    this.phase = "loading";   // "loading" | "setup" | "build" | "home" | "lesson" | "quiz" | "result" | "practice"
    this.slug = null; this.lang = null;
    this.course = null; this.courseError = null; this.repoError = null;
    this.mods = {}; this.modErrors = {}; // module files by id (null: not written yet), and the ones that would not load
    this.exercises = {};      // practice exercises by module id (null: not written yet, []: none)
    this.lines = new Map();   // file lines at a commit, by "commit:path", for writing and checking
    this.flash = null;        // one line of news under the home and lesson keys
    this.setup = { path: "", lang: DEFAULT_LANGUAGE, at: 0, courses: [], editing: false, editingKnown: false, known: null };
    this.settings = cleanSettings(null); // editor, agent and the default "what I know"
    this.job = null;          // the writing job the build screen shows
    this.pr = null; this.prGen = 0; this.practiceFrom = "home"; // the exercise shown, and where esc goes
    this.editors = {};        // the Neovim terminal opened per exercise, and per course for reading ("<slug>/read")
    this.letters = [];        // the home list's letter per module
    this.rangeTopics = null;  // Practice Range's topics for this course's language, or null without it
    this.nav = { at: 0, typed: "" };  // the home list's cursor and typed letters
    this.rowChild = [];       // the home list's child index per module, set by the view
    this.confirmReset = false;
    this.progress = fresh(); this.loaded = false;
    this.saving = false; this.dirty = false; this.replaceNext = false; this.saveError = null;
    this.modId = null; this.mod = null; this.idx = 0;
    this.code = null; this.codeError = null; this.files = new Map(); // file lines at the commit, per module visit
    this.notes = {};          // chat answers per stop index, for this module visit only
    this.session = null; this.busy = null; this.gen = 0;
    this.claude = null;       // true or false once looked up
    this.asking = false; this.typing = false;
    this.quiz = { i: 0, picks: [] }; this.result = null;
    this.split = null; this.width = 0;
    // Scroll handles and the text boxes are made here, never in render.
    this.homeScroll = ScrollHandle.new();
    this.explainScroll = ScrollHandle.new();
    this.quizScroll = ScrollHandle.new();
    this.practiceScroll = ScrollHandle.new();
    this.input = InputState.new({ placeholder: "Ask about this code, then press enter" });
    this.pathInput = InputState.new({ placeholder: "The folder of a git repo, then press enter" });
    this.knownInput = InputState.new({ placeholder: "Languages you know, first one to compare to: TypeScript, some SQL" });
    for (const box of [this.input, this.pathInput, this.knownInput]) {
      box.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
      box.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    }
    this.input.on("submit", (_e, cx) => { this.ask(cx); cx.notify(); });
    this.pathInput.on("submit", (_e, cx) => { this.setup.path = this.pathInput.value().trim(); this.setup.at = 0; this.leaveBox(); cx.notify(); });
    this.knownInput.on("submit", (_e, cx) => { this.setup.known = parseKnown(this.knownInput.value()); this.setup.at = 0; this.leaveBox(); cx.notify(); });
    this.handle = cx.focus_handle();
    // The pane isn't drawn yet, so focus again once it is.
    this.handle.focus();
    cx.timer.after(50, () => { if (!this.typing) this.handle.focus(); });
    cx.timer.after(400, () => { if (!this.typing) this.handle.focus(); });
    cx.spawn(async cx => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
    cx.spawn(async cx => {
      this.settings = await loadSettings();
      const slug = await currentSlug();
      if (slug && await loadCourse(slug).catch(() => null)) await this.openCourse(slug, cx);
      else await this.openSetup(cx);
      cx.notify();
    });
    // The lookup can fail right after Herdr starts, so try again before turning chat off.
    cx.spawn(async cx => {
      for (const wait of [0, 2000, 5000, 10000]) {
        if (wait) await new Promise(done => cx.timer.after(wait, () => done(null)));
        if (await haveClaude().catch(() => false)) { this.claude = true; cx.notify(); return; }
      }
      this.claude = false;
      cx.notify();
    });
  }

  async close() {
    const hints = this.pr?.session;
    this.cancelJob();
    this.leavePractice();
    this.code?.release(); this.homeScroll.release(); this.explainScroll.release(); this.quizScroll.release(); this.practiceScroll.release();
    this.input.release(); this.pathInput.release(); this.knownInput.release();
    await this.session?.stop();
    await hints?.stop();
  }

  // ---- courses ------------------------------------------------------------------------------

  /** Shows the setup screen: a new course from a folder, or one of the courses on disk. */
  async openSetup(cx) {
    this.leaveModule();
    this.confirmReset = false;
    // Start from the folder of the terminal beside Tutor, else the space's start folder.
    const active = spaces().find(s => s.active && !s.machine);
    const near = focused()?.cwd || panes().find(p => p.terminal && p.cwd)?.cwd || active?.folder;
    if (!this.setup.path && near) this.setup.path = near.replace(/\\/g, "/");
    this.setup.at = 0;
    this.phase = "setup";
    cx.notify();
    this.setup.courses = await listCourses();
    cx.notify();
  }

  /** Loads course `slug`, makes it the one Tutor opens with, and shows its home. */
  async openCourse(slug, cx) {
    this.leaveModule();
    this.slug = slug; this.course = null; this.courseError = null; this.repoError = null; this.lang = null;
    this.mods = {}; this.modErrors = {}; this.exercises = {}; this.flash = null; this.rangeTopics = null;
    this.progress = fresh(); this.loaded = false; this.nav = { at: 0, typed: "" }; this.confirmReset = false;
    this.phase = "home";
    cx.notify();
    await setCurrent(slug).catch(() => {});
    await this.load();
    cx.notify();
    // Practice Range is optional: without it, rangeTopics stays null and no link shows.
    if (this.lang) practiceRangeTopics(this.lang.id).then(topics => { if (this.slug === slug) { this.rangeTopics = topics; cx.notify(); } }).catch(() => {});
    // The list's rows exist only after this render, so scroll to the cursor after it.
    cx.timer.after(50, () => this.homeScroll.scroll_to_item(this.rowChild[this.nav.at] ?? 0));
  }

  /** Reads the course, the modules and exercises written so far, progress, and checks the pinned commit. */
  async load() {
    const slug = this.slug;
    try { this.course = await loadCourse(slug); }
    catch (e) { this.courseError = `Could not read the course: ${e?.message ?? e}`; return; }
    if (!this.course) { this.courseError = "The course is gone. Press n to start a new one."; return; }
    this.lang = languageOf(this.course);
    if (!this.lang) { this.courseError = `This course is in ${this.course.language}, which Tutor does not have.`; return; }
    const list = this.course.modules ?? [];
    this.letters = assignLetters(list.length, RESERVED);
    await Promise.all([
      ...list.map(async m => {
        try { this.mods[m.id] = await loadModule(slug, m.id); }
        catch (e) { this.mods[m.id] = null; this.modErrors[m.id] = String(e?.message ?? e); }
        try { this.exercises[m.id] = await loadExercises(slug, m.id); }
        catch (e) { this.exercises[m.id] = null; this.modErrors[m.id] ??= `exercises: ${e?.message ?? e}`; }
      }),
      (async () => { this.repoError = await checkRepo(this.course.root, this.course.commit); })(),
      (async () => { this.progress = await loadProgress(this.progressPath()); this.loaded = true; })(),
    ]);
    const first = list.findIndex(m => !this.isDone(m.id));
    this.nav.at = first >= 0 ? first : 0;
  }

  progressPath() { return `${courseDir(this.slug)}/progress.json`; }

  /** A file's lines at `repo`'s commit (the course's by default), read once. */
  linesAt(path, repo = this.course) {
    const key = `${repo.commit}:${path}`;
    if (!this.lines.has(key)) this.lines.set(key, fileAt(repo.root, repo.commit, path));
    return this.lines.get(key);
  }

  // ---- writing jobs -------------------------------------------------------------------------

  /**
   * Runs one writing job on the build screen. `spec` is { title, detail, wait, work, done, back }:
   * `work(job)` does the writing and resolves what `done(result, cx)` takes. esc runs `back(cx)`.
   */
  runJob(spec, cx) {
    this.cancelJob();
    this.leaveBox();
    const job = this.job = { spec, title: spec.title, detail: spec.detail, status: "Starting", error: null, started: Date.now(), session: null };
    // The once-a-second redraw below shows a new status, so say only sets it.
    job.say = text => { if (this.job === job) job.status = text; };
    this.phase = "build";
    // Redraw once a second so the clock moves.
    const tick = () => cx.timer.after(1000, cx => { if (this.job === job && !job.error) { cx.notify(); tick(); } });
    tick();
    cx.spawn(async cx => {
      let out;
      try { out = await spec.work(job); }
      catch (e) {
        if (this.job !== job) return;
        job.session?.stop();
        job.error = String(e?.message ?? e);
        cx.notify();
        return;
      }
      if (this.job !== job) return;
      this.job = null;
      job.session?.stop();
      spec.done(out, cx);
      cx.notify();
    });
  }

  /** Stops the writing job, if any. */
  cancelJob() {
    const job = this.job;
    this.job = null;
    job?.session?.stop();
  }

  /** esc on the build screen: stops the job and goes back. */
  leaveJob(cx) {
    const back = this.job?.spec.back;
    this.cancelJob();
    back?.(cx);
  }

  /** enter on a failed job: runs it again. */
  retryJob(cx) {
    if (this.job?.error) this.runJob(this.job.spec, cx);
  }

  /** The `io` build.js writes with. `repo` is { root, commit }. */
  io(job, repo) {
    return {
      ask: prompt => job.session.ask(prompt),
      say: job.say,
      linesAt: path => this.linesAt(path, repo),
      run: (ex, source) => runSource(ex, source, this.lang, "check"),
    };
  }

  /** enter on the setup screen: plans a course from the folder, or opens the course picked. */
  setupEnter(cx) {
    const s = this.setup;
    if (s.at > 0) { const c = s.courses[s.at - 1]; if (c) this.openCourse(c.slug, cx); return; }
    const lang = LANGUAGES[s.lang], path = s.path, known = this.setupKnown();
    // What you know now is the default for the next course too.
    if (JSON.stringify(known) !== JSON.stringify(this.settings.known)) this.changeSettings({ known });
    this.runJob({
      title: `Planning a ${lang.name} course`, detail: path,
      wait: "Claude reads the repo and plans 10 to 20 modules. This takes a few minutes. Modules are written later, one at a time, when you open them.",
      back: cx => { this.phase = "setup"; cx.notify(); },
      work: async job => {
        job.say("Looking at the repo");
        const info = await repoInfo(path, lang);
        const slug = slugFor(info.root, lang.id);
        // A course for this repo and language is already there: open it instead.
        if (await loadCourse(slug).catch(() => null)) return slug;
        job.detail = `${info.root} at ${info.commit.slice(0, 7)}`;
        job.session = new AgentSession(info.root);
        const course = await writeOutline(this.io(job, info), info, lang, known);
        // With Practice Range installed, match modules to its topics now, while Claude has the
        // plan in mind. A failure here only means the match is made later, when first asked for.
        const topics = await practiceRangeTopics(lang.id).catch(() => null);
        if (topics) course.practiceRange = await writeMatches(this.io(job, info), course, topics, lang).catch(() => undefined);
        await saveCourse(slug, course);
        return slug;
      },
      done: (slug, cx) => { this.openCourse(slug, cx); },
    }, cx);
  }

  /** Writes module `id` with Claude, then opens it. */
  writeModuleJob(id, cx) {
    const course = this.course, i = course.modules.findIndex(m => m.id === id), entry = course.modules[i];
    if (!entry) return;
    if (this.repoError) { this.flash = this.repoError; return; }
    this.runJob({
      title: `Writing module ${i + 1}`, detail: entry.title,
      wait: "Claude reads the code and writes the lessons and quiz, then every line range is checked. This takes a few minutes, once per module.",
      back: cx => this.goHome(cx),
      work: async job => {
        job.session = new AgentSession(course.root);
        const mod = await writeModule(this.io(job, course), course, entry, i + 1, this.lang);
        await saveModule(this.slug, id, mod);
        return mod;
      },
      done: (mod, cx) => { this.mods[id] = mod; delete this.modErrors[id]; this.nav.at = i; this.openModule(id, cx); },
    }, cx);
  }

  /** Writes module `id`'s exercises with Claude and runs each one, then opens practice. */
  writePracticeJob(id, from, cx) {
    const course = this.course, mod = this.mods[id], i = course.modules.findIndex(m => m.id === id), entry = course.modules[i];
    if (!mod || !entry) return;
    const lang = this.lang, idx = this.idx;
    this.runJob({
      title: `Writing practice for module ${i + 1}`, detail: entry.title,
      wait: `Claude writes the exercises, then each solution and starter is run with ${lang.practice.tool}. This takes a few minutes, once per module.`,
      back: cx => this.leavePracticeJob(id, from, idx, cx),
      work: async job => {
        if (!(await haveTool(lang))) throw new Error(lang.practice.needs);
        job.session = new AgentSession(course.root);
        const list = await writeExercises(this.io(job, course), course, mod, entry, i + 1, lang);
        await saveExercises(this.slug, id, list);
        return list;
      },
      done: (list, cx) => {
        this.exercises[id] = list;
        if (list.length) { this.openPractice(id, cx, from); return; }
        this.flash = `Module ${i + 1} has no practice: its ideas do not fit in one file.`;
        this.leavePracticeJob(id, from, idx, cx);
      },
    }, cx);
  }

  /** Back to the lesson stop or home that asked for practice. */
  leavePracticeJob(id, from, idx, cx) {
    if (from === "lesson") this.openModule(id, cx, idx);
    else this.goHome(cx);
  }

  // ---- progress -------------------------------------------------------------------------

  isDone(id) { return Boolean(this.progress.modules[id]?.doneAt); }

  /** Saves progress, one write at a time. Changes made while a write runs go in the next one. */
  save(cx) {
    if (!this.loaded) return;
    this.dirty = true;
    if (this.saving) return;
    this.saving = true;
    const path = this.progressPath();
    cx.spawn(async cx => {
      while (this.dirty) {
        this.dirty = false;
        const replace = this.replaceNext; this.replaceNext = false;
        try {
          const out = await saveProgress(path, this.progress, { replace });
          if (!replace && path === this.progressPath()) this.progress = merge(this.progress, out);
          this.saveError = null;
        } catch (e) { this.saveError = String(e?.message ?? e); }
      }
      this.saving = false;
      cx.notify();
    });
  }

  /** Marks the stop seen and remembers it as the place to resume. Saves only on a change. */
  markSeen(cx) {
    const p = this.progress, id = this.modId;
    const m = p.modules[id] ??= { seen: [], stop: 0 };
    const changed = !m.seen.includes(this.idx) || m.stop !== this.idx || p.last?.module !== id || p.last?.stop !== this.idx;
    if (!changed) return;
    if (!m.seen.includes(this.idx)) { m.seen.push(this.idx); m.seen.sort((a, b) => a - b); }
    m.stop = this.idx;
    p.last = { module: id, stop: this.idx };
    this.checkDone(m);
    this.save(cx);
  }

  /** A module is done when every stop is seen and the quiz is passed. */
  checkDone(m) {
    if (!m.doneAt && m.quiz?.passed && this.mod.stops.every((_s, i) => m.seen.includes(i))) m.doneAt = new Date().toISOString();
  }

  resetProgress(cx) {
    this.confirmReset = false;
    this.progress = fresh();
    this.replaceNext = true;
    this.save(cx);
    this.nav.at = 0;
  }

  // ---- moving between screens ---------------------------------------------------------------

  /** Drops this module visit's chat and code. */
  leaveModule() {
    this.leavePractice();
    this.gen++;
    this.session?.stop(); this.session = null; this.busy = null; this.notes = {};
    this.leaveBox();
    this.code?.release(); this.code = null; this.codeError = null;
    this.files = new Map();
  }

  goHome(cx) {
    this.leaveModule();
    this.phase = "home"; this.mod = null; this.modId = null; this.confirmReset = false;
    const i = this.course?.modules.findIndex(m => m.id === this.modIdLast) ?? -1;
    if (i >= 0) this.nav.at = i;
    this.homeScroll.scroll_to_item(this.rowChild[this.nav.at] ?? 0);
    cx.timer.after(50, () => this.homeScroll.scroll_to_item(this.rowChild[this.nav.at] ?? 0));
  }

  openAt(cx) {
    const m = this.course?.modules[this.nav.at];
    if (m) this.openModule(m.id, cx);
  }

  /** Opens a module at `stop`, else where it was left. A module not written yet is written first. */
  openModule(id, cx, stop = null) {
    const mod = this.mods[id];
    if (!mod) { if (!this.modErrors[id]) this.writeModuleJob(id, cx); return; }
    if (this.modId !== id) this.leaveModule();
    this.modId = id; this.modIdLast = id; this.mod = mod; this.phase = "lesson";
    this.show(stop ?? this.progress.modules[id]?.stop ?? 0, cx);
  }

  /** Shows stop `i`: loads its lines at the pinned commit into a fresh editor. */
  show(i, cx) {
    const mod = this.mod;
    this.idx = Math.max(0, Math.min(i, mod.stops.length - 1));
    this.phase = "lesson";
    this.leaveBox();
    this.code?.release(); this.code = null; this.codeError = null;
    this.explainScroll.scroll_to_item(0);
    cx.timer.after(50, () => this.explainScroll.scroll_to_item(0));
    this.markSeen(cx);
    const s = mod.stops[this.idx], idx = this.idx, gen = this.gen;
    cx.spawn(async cx => {
      if (this.repoError) { this.codeError = this.repoError; cx.notify(); return; }
      if (!this.files.has(s.file)) this.files.set(s.file, await fileAt(this.course.root, this.course.commit, s.file));
      if (this.idx !== idx || this.gen !== gen || this.mod !== mod || this.code) return;
      const lines = this.files.get(s.file);
      if (!lines) { this.codeError = `Cannot read ${s.file} at ${this.course.commit.slice(0, 7)}`; cx.notify(); return; }
      this.code = codeState(s.file, lines.slice(s.start - 1, s.end).join("\n"), this.lang.grammar);
      cx.notify();
    });
  }

  /** j and k in a lesson. j on the last stop starts the quiz. */
  move(dir, cx) {
    if (this.idx + dir >= this.mod.stops.length) return this.startQuiz(cx);
    if (this.idx + dir < 0) return;
    this.show(this.idx + dir, cx);
  }

  isSplit() { return this.split ?? this.width >= SPLIT_WIDTH; }
  toggleSplit() { this.split = !this.isSplit(); }

  /** Opens the live file in the editor at the line its anchor is on now. */
  openEditor(cx) {
    const s = this.mod?.stops[this.idx];
    if (!s || this.phase !== "lesson") return;
    const root = this.course.root;
    liveLine(root, s).then(line => this.openFileAt(`${root}/${s.file}`, line, cx)).catch(() => {});
  }

  /**
   * Opens a repo file at `line` to read. VS Code opens it in its window. Neovim opens it read-only
   * in a pane to the right, and later files go to that same pane while it is open.
   */
  openFileAt(path, line, cx) {
    if (this.settings.editor === "vscode") { openInVSCode(path, line); return; }
    const key = `${this.slug}/read`, pipe = editorPipe(this.slug, "read");
    if (this.editorOpen(key)) {
      exec("nvim", ["--headless", "--server", pipe, "--remote-expr", neovimOpenExpression(path, line)], { timeout: 5000 }).catch(() => {});
      run("pane.focus", { terminal: this.editors[key] });
      return;
    }
    this.splitEditor(key, ["nvim", "--listen", pipe, "-R", `+${line}`, path], cx);
  }

  /** True when the editor pane remembered under `key` is still open. */
  editorOpen(key) {
    const term = this.editors[key];
    return Boolean(term && panes().some(p => p.terminal === term));
  }

  /** Runs `argv` in a new pane to the right and remembers its terminal under `key`. */
  splitEditor(key, argv, cx) {
    const before = new Set(panes().map(p => p.pane));
    run("pane.split", { direction: "right", argv });
    // pane.split returns nothing, so find the new pane to know later whether it is still open.
    const find = () => { const p = panes().find(p => !before.has(p.pane) && p.terminal); if (p) this.editors[key] = p.terminal; return Boolean(p); };
    cx.timer.after(200, () => { if (!find()) cx.timer.after(800, find); });
  }

  /** Saves a change to the shared settings. A failed save keeps the change for this session. */
  changeSettings(change) {
    this.settings = cleanSettings({ ...this.settings, ...change });
    saveSettings(this.settings).catch(e => { this.flash = `Could not save settings: ${e?.message ?? e}`; });
  }

  /** What you know, for the next course: what you typed on the setup screen, else the saved default. */
  setupKnown() { return this.setup.known ?? this.settings.known; }

  /** The learner this course is for. */
  me() { return learnerOf(this.course, this.lang); }

  // ---- setup --------------------------------------------------------------------------------

  /** j and k on the setup screen: row 0 is the new course, then each course on disk. */
  setupMove(dir) {
    const n = this.setup.courses.length + 1;
    this.setup.at = Math.max(0, Math.min(n - 1, this.setup.at + dir));
  }

  editPath(cx) {
    this.pathInput.set_value(this.setup.path);
    this.setup.editing = true;
    this.pathInput.focus();
    cx.timer.after(50, () => this.pathInput.focus());
  }

  browse(cx) {
    cx.spawn(async cx => {
      const dir = await pickFolder({ prompt: "Teach from this folder" }).catch(() => null);
      if (dir) { this.setup.path = dir.replace(/\\/g, "/"); this.setup.at = 0; }
      this.handle.focus();
      cx.notify();
    });
  }

  /** w on the setup screen: type what you already know. */
  editKnown(cx) {
    this.knownInput.set_value(this.setupKnown().join(", "));
    this.setup.editingKnown = true;
    this.knownInput.focus();
    cx.timer.after(50, () => this.knownInput.focus());
  }

  /** v on the setup screen: the next editor. */
  nextEditor() { this.changeSettings({ editor: nextOf(EDITORS, this.settings.editor) }); }

  /** l on the setup screen: the next language. */
  nextLanguage() {
    const ids = Object.keys(LANGUAGES);
    this.setup.lang = ids[(ids.indexOf(this.setup.lang) + 1) % ids.length];
  }

  // ---- chat ---------------------------------------------------------------------------------

  canAsk() { return this.claude === true && (this.phase === "practice" ? Boolean(this.pr) && !this.pr.hinting : !this.busy); }

  startAsking(cx) {
    if (!this.canAsk()) return;
    this.asking = true;
    this.input.focus();
    cx.timer.after(50, () => this.input.focus());
  }

  /** Takes the keyboard back from the ask box and the folder box. */
  leaveBox() {
    this.typing = false; this.asking = false; this.setup.editing = false; this.setup.editingKnown = false;
    this.handle.focus();
  }

  ask(cx) {
    const q = this.input.value().trim();
    if (!q || !this.canAsk()) return;
    this.input.set_value("");
    this.leaveBox();
    if (this.phase === "practice") this.practiceAsk(q, cx);
    else this.followUp(`You asked: ${q}`, q, cx);
  }

  deeper(cx) { this.followUp("Deeper", DEEPER, cx); }
  likeKnown(cx) {
    const compare = this.me().compare;
    if (compare) this.followUp(`Like ${compare}`, likeKnownQuestion(compare), cx);
  }

  /** Sends a question about the current stop and adds the answer under its explanation. */
  followUp(label, question, cx) {
    if (!this.canAsk() || this.phase !== "lesson") return;
    const s = this.mod.stops[this.idx], idx = this.idx, gen = this.gen;
    const number = this.course.modules.findIndex(m => m.id === this.modId) + 1;
    const session = this.session ??= new AgentSession(this.course.root);
    const notes = this.notes[idx] ??= [];
    this.busy = "Asking";
    // Reveal the end marker once the question is drawn, so the answer appears in view.
    this.explainScroll.scroll_to_item(2);
    cx.timer.after(50, cx => { this.explainScroll.scroll_to_item(2); cx.notify(); });
    cx.spawn(async cx => {
      let prompt = stopPrompt(s, idx, question);
      if (!session.id) prompt = `${framePrompt(this.course, this.mod, number, this.lang, this.me())}\n\n${prompt}`;
      let note;
      try { note = { label, text: await session.ask(prompt) }; }
      catch (e) { note = { label: `${label} (failed)`, text: String(e?.message ?? e) }; }
      if (this.gen !== gen) return; // the module was left: the chat is gone
      notes.push(note);
      this.busy = null;
      if (this.idx === idx) { this.explainScroll.scroll_to_item(2); cx.timer.after(50, () => this.explainScroll.scroll_to_item(2)); }
      cx.notify();
    });
  }

  /** esc while waiting: stops the job. */
  stopAsking() {
    this.session?.stop();
  }

  // ---- quiz ---------------------------------------------------------------------------------

  startQuiz(cx) {
    if (!this.mod) return;
    this.leaveBox();
    this.gen++; this.session?.stop(); this.busy = null; // a pending answer has nowhere to go now
    this.code?.release(); this.code = null;
    this.phase = "quiz"; this.quiz = { i: 0, picks: [] }; this.result = null;
    this.scrollQuizTop(cx);
  }

  scrollQuizTop(cx) {
    this.quizScroll.scroll_to_item(0);
    cx.timer.after(50, () => this.quizScroll.scroll_to_item(0));
  }

  answer(n, cx) {
    if (this.phase !== "quiz" || this.quiz.picks[this.quiz.i] !== undefined) return;
    if (n < 0 || n >= this.mod.quiz[this.quiz.i].choices.length) return;
    this.quiz.picks[this.quiz.i] = n;
  }

  /** Next question once this one is answered, or the result after the last. */
  continueQuiz(cx) {
    const quiz = this.mod.quiz;
    if (this.quiz.picks[this.quiz.i] === undefined) return;
    if (this.quiz.i < quiz.length - 1) { this.quiz.i++; this.scrollQuizTop(cx); return; }
    this.finishQuiz(cx);
  }

  finishQuiz(cx) {
    const quiz = this.mod.quiz;
    const missed = quiz.filter((q, i) => this.quiz.picks[i] !== q.answer).map(q => q.id);
    const score = quiz.length - missed.length;
    const passed = score >= Math.ceil(quiz.length * PASS_SHARE);
    this.result = { score, passed, missed };
    const m = this.progress.modules[this.modId] ??= { seen: [], stop: 0 };
    const old = m.quiz;
    m.quiz = { attempts: (old?.attempts ?? 0) + 1, best: Math.max(old?.best ?? 0, score), last: score,
      passed: Boolean(old?.passed || passed), missed, at: new Date().toISOString() };
    this.checkDone(m);
    this.save(cx);
    this.phase = "result";
    this.scrollQuizTop(cx);
  }

  /** esc in a quiz: back to the lesson. Nothing is recorded. */
  leaveQuiz(cx) {
    this.phase = "lesson";
    this.show(this.idx, cx);
  }

  nextModuleId() {
    const list = this.course?.modules ?? [];
    const i = list.findIndex(m => m.id === this.modId);
    return list[i + 1]?.id ?? null;
  }

  /** enter on the result: the next module (written first if needed), or home after the last. */
  afterResult(cx) {
    const next = this.nextModuleId();
    if (next && !this.modErrors[next]) { this.nav.at++; this.openModule(next, cx); }
    else this.goHome(cx);
  }

  // ---- Practice Range -----------------------------------------------------------------------

  /**
   * Module `id`'s Practice Range topic: the topic, null when none fits, or undefined when there
   * is no Practice Range or the course's modules are not matched to its topics yet.
   */
  rangeTopic(id) {
    const pr = this.course?.practiceRange;
    if (!this.rangeTopics || !pr || pr.language !== this.lang?.id || !pr.matches || !(id in pr.matches)) return undefined;
    return this.rangeTopics.find(t => t.id === pr.matches[id]) ?? null;
  }

  /** A done module links to Practice Range unless its match is known to be none. */
  canRange(id) {
    return Boolean(id && this.rangeTopics && this.isDone(id) && this.rangeTopic(id) !== null);
  }

  /** g: opens Practice Range at module `id`'s topic. Matches every module first if that is not done yet. */
  goRange(id, cx) {
    if (!this.canRange(id)) return;
    const topic = this.rangeTopic(id), n = this.course.modules.findIndex(m => m.id === id) + 1;
    const open = t => { openPracticeRange(this.lang.id, t.id); this.flash = `Opened Practice Range at "${t.title}".`; };
    if (topic) { open(topic); return; }
    if (this.claude !== true) { this.flash = "Finding the Practice Range topic needs the claude CLI."; return; }
    const course = this.course, slug = this.slug, topics = this.rangeTopics, lang = this.lang;
    this.runJob({
      title: "Finding the Practice Range topic", detail: course.modules[n - 1].title,
      wait: "Claude matches every module of this course to a Practice Range topic, once. This takes about a minute.",
      back: cx => this.goHome(cx),
      work: async job => {
        job.session = new AgentSession(course.root);
        course.practiceRange = await writeMatches(this.io(job, course), course, topics, lang);
        await saveCourse(slug, course);
      },
      done: (_out, cx) => {
        this.goHome(cx);
        const t = this.rangeTopic(id);
        if (t) open(t); else this.flash = `No Practice Range topic fits module ${n}.`;
      },
    }, cx);
  }

  /** 1 to 9 on the result: the stop the nth missed question came from. */
  jumpToMissed(k, cx) {
    const id = this.result?.missed[k];
    const q = this.mod.quiz.find(x => x.id === id);
    if (q && Number.isInteger(q.stop)) this.show(q.stop, cx);
  }

  // ---- practice -----------------------------------------------------------------------------

  /** True when p does something for the module: it has exercises, or they can be written now. */
  canPractice(id) {
    if (!this.mods[id]) return false;
    const exs = this.exercises[id];
    return exs ? exs.length > 0 : !this.repoError;
  }
  practicePassed(exId) { return Boolean(this.progress.modules[this.modId]?.practice?.[exId]?.passed); }

  /** Opens a module's practice at its first exercise not yet passed, writing it first if needed. `from` is where esc goes. */
  openPractice(id, cx, from) {
    if (!this.canPractice(id)) return;
    if (!this.exercises[id]) { this.writePracticeJob(id, from, cx); return; }
    if (this.modId !== id) this.leaveModule();
    this.leaveBox();
    this.code?.release(); this.code = null;
    this.modId = id; this.modIdLast = id; this.mod = this.mods[id];
    this.practiceFrom = from; this.phase = "practice";
    const exs = this.exercises[id], at = exs.findIndex(ex => !this.practicePassed(ex.id));
    this.showExercise(at >= 0 ? at : 0, cx);
  }

  /** Drops the shown exercise: its watch, hint chat and editors. */
  leavePractice() {
    this.prGen++;
    if (this.asking) this.leaveBox();
    const pr = this.pr;
    if (!pr) return;
    pr.session?.stop();
    pr.solution?.release(); pr.source?.release();
    this.pr = null;
  }

  /** Shows exercise `i` of this module: writes its starter if needed, then watches its folder. */
  showExercise(i, cx) {
    const exs = this.exercises[this.modId];
    if (!exs?.[i]) return;
    this.leavePractice();
    const ex = exs[i], gen = this.prGen;
    const pr = this.pr = { exs, i, ex, modId: this.modId, result: null, running: false, queued: false, runError: null,
      hints: [], level: 0, hinting: null, chatGen: 0, session: null, confirm: null, solution: null, source: null, sourceError: null };
    this.scrollPractice(0, cx);
    cx.spawn(async cx => {
      try { await ensureWork(this.slug, ex, this.lang); }
      catch (e) { pr.runError = `Could not write ${this.lang.practice.file}: ${e?.message ?? e}`; cx.notify(); return; }
      if (this.prGen === gen) this.watchWork(ex, gen, cx);
    });
  }

  scrollPractice(item, cx) {
    this.practiceScroll.scroll_to_item(item);
    cx.timer.after(50, () => this.practiceScroll.scroll_to_item(item));
  }

  /** Runs the exercise on each change to the learner's file, until another exercise is shown. */
  watchWork(ex, gen, cx) {
    const dir = workDir(this.slug, ex.id), norm = p => String(p).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    const file = `/${this.lang.practice.file.toLowerCase()}`;
    cx.spawn(async cx => {
      for (;;) {
        let paths;
        try { paths = await watchFolder(dir); } catch { return; }
        if (this.prGen !== gen) return;
        // Neovim also writes swap and backup files here: only the exercise file counts.
        if (paths.some(p => norm(p).endsWith(file) || norm(p) === norm(dir))) { this.practiceRun(cx); cx.notify(); }
      }
    });
  }

  /** Runs now. A run asked for while one is going queues exactly one more. */
  practiceRun(cx) {
    const pr = this.pr;
    if (!pr) return;
    if (pr.running) { pr.queued = true; return; }
    pr.running = true; pr.runError = null;
    const ex = pr.ex, gen = this.prGen, slug = this.slug, lang = this.lang;
    cx.spawn(async cx => {
      do {
        pr.queued = false;
        let out = null;
        try { out = await runExercise(slug, ex, lang); pr.runError = null; }
        catch (e) { pr.runError = String(e?.message ?? e); }
        if (out && slug === this.slug) this.recordPractice(pr.modId, ex.id, p => { p.runs = (p.runs ?? 0) + 1; if (out.passed) p.passed = true; }, cx);
        if (this.prGen !== gen) return;
        if (out) pr.result = out;
        if (out?.passed) this.loadPracticeSource(pr, cx);
        cx.notify();
      } while (pr.queued);
      pr.running = false;
      cx.notify();
    });
  }

  /** Updates one exercise's progress with `f` and saves. */
  recordPractice(modId, exId, f, cx) {
    const m = this.progress.modules[modId] ??= { seen: [], stop: 0 };
    const p = (m.practice ??= {})[exId] ??= { passed: false, runs: 0, hints: 0, gaveUp: false };
    f(p);
    p.at = new Date().toISOString();
    this.save(cx);
  }

  /** The repo's code shown after a pass, at the pinned commit. */
  loadPracticeSource(pr, cx) {
    if (pr.source || pr.sourceError) return;
    const src = pr.ex.source, gen = this.prGen;
    cx.spawn(async cx => {
      if (this.repoError) { pr.sourceError = this.repoError; cx.notify(); return; }
      const lines = await this.linesAt(src.file);
      if (this.prGen !== gen || pr.source) return;
      if (!lines) pr.sourceError = `Cannot read ${src.file} at ${this.course.commit.slice(0, 7)}`;
      else pr.source = codeState(src.file, lines.slice(src.start - 1, src.end).join("\n"), this.lang.grammar);
      cx.notify();
    });
  }

  /**
   * Opens the learner's file in the editor. Neovim opens in a pane to the right, unless this
   * exercise's editor is open. VS Code opens it in its window; saving there runs it too.
   */
  practiceEdit(cx) {
    const ex = this.pr?.ex;
    if (!ex) return;
    const file = workFile(this.slug, ex.id, this.lang);
    if (this.settings.editor === "vscode") { openInVSCode(file, 1); return; }
    const key = `${this.slug}/${ex.id}`;
    if (this.editorOpen(key)) { run("pane.focus", { terminal: this.editors[key] }); return; }
    this.splitEditor(key, ["nvim", "--listen", editorPipe(this.slug, ex.id), file], cx);
  }

  /** The next hint. The first three step up; every later one gives one more piece. */
  practiceHint(cx) {
    const pr = this.pr;
    if (!pr || pr.hinting || this.claude !== true) return;
    const n = pr.level + 1;
    this.practiceChat(`Hint ${n}`, "Getting a hint", source => hintPrompt(pr.ex, source, pr.result, n, this.lang, this.me()), cx, () => {
      pr.level = n;
      this.recordPractice(pr.modId, pr.ex.id, p => { p.hints = Math.max(p.hints ?? 0, n); }, cx);
    });
  }

  /** The learner's own question about this exercise, from the ask box. */
  practiceAsk(q, cx) {
    const pr = this.pr;
    if (!pr || pr.hinting || this.claude !== true) return;
    this.practiceChat(`You asked: ${q}`, "Asking", source => practiceQuestionPrompt(pr.ex, source, pr.result, q, this.lang, this.me()), cx);
  }

  /**
   * Sends one message in this exercise's chat and adds the reply under the results.
   * `prompt` gets the learner's file as it is now. `done` runs after a reply that did not fail.
   */
  practiceChat(label, busy, prompt, cx, done = null) {
    const pr = this.pr, ex = pr.ex, gen = this.prGen, chat = pr.chatGen, slug = this.slug, lang = this.lang;
    const session = pr.session ??= new AgentSession(workDir(slug, ex.id));
    pr.hinting = busy;
    this.scrollPractice(2, cx);
    cx.spawn(async cx => {
      let note, ok = false;
      try { note = { label, text: await session.ask(prompt(await readWork(slug, ex.id, lang))) }; ok = true; }
      catch (e) { note = { label: `${label} (failed)`, text: String(e?.message ?? e) }; }
      if (this.prGen !== gen || pr.chatGen !== chat) return; // left, or reset cleared the chat
      pr.hinting = null;
      pr.hints.push(note);
      if (ok) done?.();
      this.scrollPractice(2, cx);
      cx.notify();
    });
  }

  /** Shows the full solution. Counts as giving up on this exercise. */
  practiceSolution(cx) {
    const pr = this.pr;
    if (!pr) return;
    pr.confirm = null;
    if (!pr.solution) pr.solution = codeState(this.lang.practice.file, String(pr.ex.solution).replace(/\n$/, ""), this.lang.grammar);
    this.recordPractice(pr.modId, pr.ex.id, p => { p.gaveUp = true; }, cx);
    this.scrollPractice(2, cx);
  }

  /**
   * Puts the starter back and makes the Neovim Tutor opened reload it. The watch sees the write
   * and runs it. Also starts the chat over: hints and answers go, and the next hint is hint 1.
   */
  practiceReset(cx) {
    const pr = this.pr;
    if (!pr) return;
    pr.confirm = null;
    pr.chatGen++;
    pr.session?.stop(); pr.session = null;
    pr.hints = []; pr.level = 0; pr.hinting = null;
    const slug = this.slug, lang = this.lang;
    cx.spawn(async cx => {
      try { await resetWork(slug, pr.ex, lang); await reloadEditor(slug, pr.ex.id); }
      catch (e) { pr.runError = `Could not reset ${lang.practice.file}: ${e?.message ?? e}`; cx.notify(); }
    });
  }

  /** y after x or c confirms. Any other key cancels. */
  practiceConfirm(k, cx) {
    const what = this.pr?.confirm;
    if (!what) return;
    this.pr.confirm = null;
    if (k !== "y") return;
    if (what === "solution") this.practiceSolution(cx);
    else this.practiceReset(cx);
  }

  practiceMove(dir, cx) {
    const i = (this.pr?.i ?? 0) + dir;
    if (this.pr && i >= 0 && i < this.pr.exs.length) this.showExercise(i, cx);
  }

  /** esc: back to the lesson or home, whichever opened practice. */
  practiceBack(cx) {
    if (this.pr?.hinting) { this.pr.session?.stop(); return; }
    if (this.practiceFrom === "lesson") { this.leavePractice(); this.show(this.idx, cx); }
    else this.goHome(cx);
  }

  openPracticeSource(cx) {
    const src = this.pr?.ex.source;
    if (!src || !this.pr.result?.passed) return;
    const root = this.course.root;
    liveLine(root, src).then(line => this.openFileAt(`${root}/${src.file}`, line, cx)).catch(() => {});
  }

  // ---- keys and commands --------------------------------------------------------------------

  /** `tutor.<name>` commands. Each does what its key does. */
  command(c, cx) {
    const p = this.phase;
    if (c === "focus") this.handle.focus();
    else if (c === "home") { if (this.course) this.goHome(cx); }
    else if (c === "new-course") this.openSetup(cx);
    else if (c === "build" && p === "setup") this.setupEnter(cx);
    else if (c === "cancel" && p === "build") this.leaveJob(cx);
    else if (c === "retry-build" && p === "build") this.retryJob(cx);
    else if (c === "open-editor") this.openEditor(cx);
    else if (c.startsWith("open-")) { if (this.course) this.openModule(c.slice(5), cx); }
    else if (c === "next") this.press("j", cx);
    else if (c === "prev") this.press("k", cx);
    else if (c === "ask" && p === "lesson") this.startAsking(cx);
    else if (c === "deeper" && p === "lesson") this.deeper(cx);
    else if (c === "compare" && p === "lesson") this.likeKnown(cx);
    else if (c === "quiz") { if (p === "home") this.openAt(cx); if (this.phase === "lesson") this.startQuiz(cx); }
    else if (c.startsWith("answer-") && p === "quiz") this.answer("abcd".indexOf(c.slice(7)), cx);
    else if (c === "continue") this.press("enter", cx);
    else if (c === "retry" && p === "result") this.startQuiz(cx);
    else if (c === "split") this.toggleSplit();
    else if (c === "reset-progress" && this.course) this.resetProgress(cx);
    else if (c === "practice") this.press("p", cx);
    else if (c === "practice-range") this.press("g", cx);
    else if (c.startsWith("practice-") && p === "practice") {
      const what = c.slice(9);
      if (what === "edit") this.practiceEdit(cx);
      else if (what === "run") this.practiceRun(cx);
      else if (what === "hint") this.practiceHint(cx);
      else if (what === "ask") this.startAsking(cx);
      else if (what === "solution") this.practiceSolution(cx);
      else if (what === "reset") this.practiceReset(cx);
      else if (what === "next") this.practiceMove(1, cx);
      else if (what === "prev") this.practiceMove(-1, cx);
      else if (what === "open-source") this.openPracticeSource(cx);
      else if (what === "back") this.practiceBack(cx);
    }
  }

  /** Runs a plain key as if it were pressed. */
  press(key, cx) {
    this.key(/** @type {any} */ ({ key, modifiers: {}, keystroke: key }), /** @type {any} */ ({ stop_propagation() {}, notify() {} }), cx);
  }

  /** `kx` is the key event's context; `cxOverride` stands in for it when a command presses a key. */
  key(e, kx, cxOverride = null) {
    const cx = cxOverride ?? kx;
    const k = e.key;
    // A text box has the keyboard: it gets every key except esc and tab, which hand keys back.
    if (this.typing) {
      if (k === "escape" || k === "tab") { this.leaveBox(); kx.stop_propagation(); kx.notify(); }
      return;
    }
    if (e.modifiers?.control || e.modifiers?.alt || e.modifiers?.platform) return;
    let handled = true;
    if (this.phase === "setup") {
      if (k === "j" || k === "down") this.setupMove(1);
      else if (k === "k" || k === "up") this.setupMove(-1);
      else if (k === "enter") this.setupEnter(cx);
      else if (k === "e") this.editPath(cx);
      else if (k === "b") this.browse(cx);
      else if (k === "l") this.nextLanguage();
      else if (k === "w") this.editKnown(cx);
      else if (k === "v") this.nextEditor();
      else if (k === "escape" && this.course) this.goHome(cx);
      else handled = false;
    } else if (this.phase === "build") {
      if (k === "escape") this.leaveJob(cx);
      else if (k === "enter") this.retryJob(cx);
      else handled = false;
    } else if (this.phase === "home") {
      if (this.confirmReset) { if (k === "y") this.resetProgress(cx); else this.confirmReset = false; }
      else if (k === "r" && this.course) this.confirmReset = true;
      else if (k === "n") this.openSetup(cx);
      else if (k === "g" && this.canRange(this.course?.modules[this.nav.at]?.id)) this.goRange(this.course.modules[this.nav.at].id, cx);
      else if (k === "p") { const m = this.course?.modules[this.nav.at]; if (m) this.openPractice(m.id, cx, "home"); }
      else {
        const items = this.letters.map(hint => ({ hint }));
        const r = items.length ? navigateByLetter(this.nav, e, items) : null;
        if (r === "act") this.openAt(cx);
        else if (r === "done" || r === "hit") this.homeScroll.scroll_to_item(this.rowChild[this.nav.at] ?? 0);
        else handled = false;
      }
    } else if (this.phase === "lesson") {
      if (k === "j" || k === "down") this.move(1, cx);
      else if (k === "k" || k === "up") this.move(-1, cx);
      else if (k === "a") this.startAsking(cx);
      else if (k === "d") this.deeper(cx);
      else if (k === "t") this.likeKnown(cx);
      else if (k === "q") this.startQuiz(cx);
      else if (k === "p") this.openPractice(this.modId, cx, "lesson");
      else if (k === "o") this.openEditor(cx);
      else if (k === "s") this.toggleSplit();
      else if (k === "escape") { if (this.busy) this.stopAsking(); else this.goHome(cx); }
      else handled = false;
    } else if (this.phase === "quiz") {
      const n = ["a", "b", "c", "d"].indexOf(k);
      if (n >= 0) this.answer(n, cx);
      else if (k === "enter" || k === "space" || k === "j" || k === "down") this.continueQuiz(cx);
      else if (k === "escape") this.leaveQuiz(cx);
      else handled = false;
    } else if (this.phase === "result") {
      if (k === "r") this.startQuiz(cx);
      else if (k === "enter") this.afterResult(cx);
      else if (k === "m" || k === "escape") this.goHome(cx);
      else if (k === "g" && this.canRange(this.modId)) this.goRange(this.modId, cx);
      else if (/^[1-9]$/.test(k)) this.jumpToMissed(+k - 1, cx);
      else handled = false;
    } else if (this.phase === "practice" && this.pr) {
      if (this.pr.confirm) this.practiceConfirm(k, cx);
      else if (k === "e") this.practiceEdit(cx);
      else if (k === "r") this.practiceRun(cx);
      else if (k === "h") this.practiceHint(cx);
      else if (k === "a") this.startAsking(cx);
      else if (k === "x") this.pr.confirm = "solution";
      else if (k === "c") this.pr.confirm = "reset";
      else if (k === "j" || k === "down") this.practiceMove(1, cx);
      else if (k === "k" || k === "up") this.practiceMove(-1, cx);
      else if (k === "o") this.openPracticeSource(cx);
      else if (k === "escape") this.practiceBack(cx);
      else handled = false;
    } else handled = false;
    if (handled) { kx.stop_propagation(); kx.notify(); }
  }

  render(_cx) {
    const t = colors();
    const root = v_flex().id("tutor").relative().track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      // A click on the code, the text or a divider can take the keyboard away. Take it back
      // once the click is over, unless it landed in a text box.
      .on_mouse_up("left", (_e, cx) => { cx.timer.after(30, () => { if (!this.typing) this.handle.focus(); }); })
      .size_full().min_h(0).text_color(t.foreground).text_size(13)
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } });
    if (this.phase === "setup") return root.child(setupView(this, t));
    if (this.phase === "build" && this.job) return root.child(buildView(this, t));
    if (this.phase === "lesson" && this.mod) return root.child(lessonView(this, t));
    if (this.phase === "quiz" && this.mod) return root.child(quizView(this, t));
    if (this.phase === "result" && this.mod && this.result) return root.child(resultView(this, t));
    if (this.phase === "practice" && this.mod && this.pr) return root.child(practiceView(this, t));
    return root.child(homeView(this, t));
  }
}
