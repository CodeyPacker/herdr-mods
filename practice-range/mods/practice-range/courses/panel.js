import { div } from "gpui-kit";
import { v_flex, h_flex, TextView, InputState } from "gpui-base";
import { watchFolder, window as appWindow } from "herdr";
import { keyButton, spinner, textInput } from "../kit/controls.js";
import { banner, card, inkOn, paneBar, sectionLabel } from "../kit/pane.js";
import { courseCommand } from "./bridge.js";
import { generateRepoLesson, generateExtraPractice } from "../bridge.js";
import { tutorChat } from "../tutor/panel.js";
import { findLanguage } from "../languages/index.js";
import { codeBlock, initCode, richText, sweepCode } from "./code.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @param {string} id @param {string} text */
const markdown = (id, text) => TextView.markdown(id, text).selectable();
/** A progress bar whose empty part shows on a raised card. @param {Theme} t @param {number} fraction */
const progressBar = (t, fraction) => div().w_full().h(4).rounded(2).bg(t.border).overflow_hidden()
  .child(div().h_full().rounded(2).bg(t.accent).w(`${Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10}%`));
/**
 * The screen's main action: filled in the accent when ready, outlined otherwise. Still clickable when not ready.
 * @param {Theme} t @param {string} id @param {string} label @param {boolean} enabled @param {boolean} ready @param {(cx: Context) => void} click
 */
const primaryButton = (t, id, label, enabled, ready, click) => h_flex().id(id).flex_none().h(30).px(16).items_center().rounded(8).border_1()
  .border_color(ready ? t.accent : t.border).bg(ready ? t.accent : t.raised).text_size(12).font_semibold()
  .text_color(!enabled ? t.dim : ready ? inkOn(t.accent) : t.foreground)
  .when(enabled, el => el.cursor_pointer().hover(s => s.border_color(t.accent)).on_click((_e, cx) => click(cx))).child(label);
/** A numbered stage label: "1  Read the code". @param {Theme} t @param {number} n @param {string} label @param {boolean} active */
const stage = (t, n, label, active) => h_flex().gap(8).items_center().pt(4)
  .child(h_flex().w(20).h(20).flex_none().rounded(10).border_1().border_color(active ? t.accent : t.border).bg(active ? t.selected : t.raised)
    .items_center().justify_center().text_size(11).font_semibold().child(String(n)))
  .child(div().text_size(12).when(active, el => el.font_semibold()).text_color(active ? t.foreground : t.muted).child(label));
/** The kicker over a step title. */
const KIND = { explanation: "LEARN", walkthrough: "WALKTHROUGH", prediction: "PREDICT", modification: "EXERCISE", independent: "EXERCISE", debugging: "EXERCISE" };
/** A course's short name: its language (TypeScript, C#, SQL), or its own title for a reading course. @param {{ languageId?: string, title?: string, id: string }} course */
const courseName = course => (course.languageId && findLanguage(course.languageId)?.name) || course.title || course.id;
/** @param {string} path */
const normalized = path => appWindow()?.platform === "windows" ? path.replaceAll("\\", "/").toLowerCase() : path.replaceAll("\\", "/");

export class CoursePanel {
  /** @param {import("../main.js").default} host */
  constructor(host) {
    this.host = host;
    initCode();
    /** @type {import("./types.js").CourseSummary[]} */
    this.catalog = [];
    /** @type {import("./types.js").CourseSnapshot | null} */
    this.data = null;
    this.page = "catalog";
    this.languageFilter = "";
    this.openAfterList = "";
    this.returnScreen = "topics";
    /** @type {import("./types.js").LearningProfile} */
    this.profile = {configured:false,knownLanguages:[]};
    this.busy = "";
    this.error = "";
    this.repoLessonId = "";
    this.generatingRepoLesson = false;
    this.generatingExtras = false;
    /** @type {import("./types.js").RepoSource | null} */
    this.source = null;
    /** @type {Record<string, unknown>} */
    this.sourceRequest = {};
    this.sourceReturnPage = "modules";
    this.pendingSave = false;
    this.saveLoop = false;
    this.watchTurn = 0;
    /** @type {import("herdr").FolderWatch | null} */
    this.watch = null;
    this.confirmReset = false;
    this.settingsReturn = "catalog";
    this.showReadiness = false;
    this.showFixtures = false;
    this.knownInput=InputState.new({placeholder:"Python, JavaScript…"});
    this.knownInput.on("focus",()=>{this.host.typing=true;});
    this.knownInput.on("blur",()=>{this.host.typing=false;});
    this.knownInput.on("change",(_event,cx)=>cx.notify());
    this.knownInput.on("submit",(_event,cx)=>this.saveProfile(cx));
    this.repoInput = InputState.new({ placeholder: "Local git repo folder…" });
    this.repoInput.on("focus", () => { this.host.typing = true; });
    this.repoInput.on("blur", () => { this.host.typing = false; });
    this.repoInput.on("change", (_event, cx) => cx.notify());
    this.repoInput.on("submit", (_event, cx) => this.run("attach-repo", { path: this.repoInput.value() }, cx));
  }

  /** @param {Context} cx @param {string} [languageId] */
  show(cx, languageId = "") {
    if (this.busy || this.host.busy) return;
    const resume = !languageId && ["practice", "topics", "exercises", "scratch"].includes(this.host.screen) && this.data;
    if (this.host.screen !== "courses") this.returnScreen = this.host.screen;
    this.languageFilter = languageId;
    this.host.cancelTutor(cx);
    this.host.screen = "courses";
    this.host.pendingSaveCheck = null;
    this.host.confirmRepeat = false;
    this.host.typing = false;
    this.host.handle.focus();
    this.run(resume ? "status" : "list", {}, cx);
  }

  pause() { this.watchTurn++; this.watch?.cancel(); this.watch = null; this.pendingSave = false; }

  /** @param {string} action @param {Record<string, unknown>} value @param {Context} cx */
  run(action, value, cx) {
    if (this.busy) return;
    cx.spawn(async cx => { await this.dispatch(action, value, cx); });
  }

  /** @param {Context} cx */
  saveProfile(cx) {
    this.run("profile-save",{knownLanguages:this.knownInput.value().split(",").map(name=>name.trim()).filter(Boolean)},cx);
  }

  /** @param {string | null} moduleId @param {Context} cx */
  generateRepoLesson(moduleId, cx) {
    if (this.busy || !this.data || !this.host.tutor.enabled) return;
    this.host.cancelTutor(cx);
    const id = `repo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const request = { id, courseId: this.data.course.id, contentVersion: this.data.course.contentVersion, ...(moduleId ? {moduleId} : {}) };
    this.host.tutorRequestId = id;
    this.host.tutorBusy = true;
    this.generatingRepoLesson = true;
    this.busy = "Writing a lesson from sampled repo files…";
    this.error = ""; cx.notify();
    cx.spawn(async cx => {
      try {
        const result = await generateRepoLesson(request);
        if (this.host.tutorRequestId !== id) return;
        this.data = result;
        const lesson = this.data.repoLessons?.lessons.find(lesson => lesson.target === (moduleId ?? "architecture") && lesson.commit === this.data.attachment?.commit);
        if (lesson) { this.repoLessonId = lesson.id; this.page = "repo-lesson"; }
        if (this.host.sync) this.host.pushSoon(cx);
      } catch (error) {
        if (this.host.tutorRequestId === id) this.error = error instanceof Error ? error.message : String(error);
      } finally {
        if (this.host.tutorRequestId === id) { this.host.tutorRequestId = null; this.host.tutorBusy = false; }
        this.generatingRepoLesson = false; this.busy = ""; cx.notify();
      }
    });
  }

  /** Extra practice is saved beside the enrollment, so the lesson stays open. @param {string} moduleId @param {Context} cx */
  generateExtraPractice(moduleId, cx) {
    if (this.busy || !this.data || !this.host.tutor.enabled) return;
    this.host.cancelTutor(cx);
    const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const request = { id, courseId: this.data.course.id, contentVersion: this.data.course.contentVersion, moduleId };
    this.host.tutorRequestId = id; this.host.tutorBusy = true; this.generatingExtras = true;
    this.busy = "Writing extra practice, then checking every answer…"; this.error = ""; cx.notify();
    cx.spawn(async cx => {
      try {
        await generateExtraPractice(request);
        if (this.host.tutorRequestId !== id) return;
        this.data = await courseCommand("status", { courseId: request.courseId, contentVersion: request.contentVersion });
        if (this.host.sync) this.host.pushSoon(cx);
      } catch (error) {
        if (this.host.tutorRequestId === id) this.error = error instanceof Error ? error.message : String(error);
      } finally {
        if (this.host.tutorRequestId === id) { this.host.tutorRequestId = null; this.host.tutorBusy = false; }
        this.generatingExtras = false; this.busy = ""; cx.notify();
      }
    });
  }

  /** @param {string} action @param {Record<string, unknown>} value @param {Context} cx */
  async dispatch(action, value, cx) {
    if (this.busy) return;
    if (["profile-save", "list", "enroll", "open", "source", "task", "review-start", "review-next", "review-end", "attach-repo", "detach-repo"].includes(action)) this.host.cancelTutor(cx);
    this.busy = ["check", "check-saved"].includes(action) ? "Checking every case…" : "Loading course…";
    this.error = ""; cx.notify();
    try {
      const request = { ...(action === "enroll" || action === "list" ? {} : { courseId: this.data?.course.id, contentVersion: this.data?.course.contentVersion }), ...value };
      const result = await courseCommand(action, request);
      if (result.profile) {
        const untouched=this.knownInput.value()===this.profile.knownLanguages.join(", ");
        this.profile=result.profile;
        if (untouched || action==="profile-save") this.knownInput.set_value(this.profile.knownLanguages.join(", "));
      }
      if (action === "profile-save") {
        if(this.data) this.data.profile=this.profile;
      } else if (action === "list") {
        this.catalog = result.courses;
        this.page = "catalog";
        // A language card with one course opens that course, not a list of one.
        const matches = this.languageFilter ? this.catalog.filter(course => course.languageId === this.languageFilter && !course.error) : [];
        if (matches.length === 1) this.openAfterList = matches[0].id;
      } else if (action === "source") {
        if (this.page !== "source") this.sourceReturnPage = this.page;
        this.source = result.source; this.sourceRequest = value; this.page = "source"; this.pause();
      } else {
        this.data = result;
        if (action === "enroll") this.page = "modules";
        if (action === "open") { this.page = "lesson"; this.pause(); }
        if (action === "task") { this.page = "task"; this.startWatch(cx); }
        if (result.migrated) { this.data = await courseCommand("status", result.migrated); this.page = "modules"; this.pause(); }
        if (action === "status" && this.page === "task") { this.startWatch(cx); if (result.stale) this.queueSave(cx); }
        if (["review-start", "review-next", "review-end"].includes(action)) {
          this.page = result.enrollment.activeTask ? "task" : "modules";
          if (this.page === "task") this.startWatch(cx); else this.pause();
        }
        if (result.pendingSave) this.pendingSave = true;
      }
      if (this.host.sync && !["list", "status", "source"].includes(action)) this.host.pushSoon(cx);
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
    finally { this.busy = ""; cx.notify(); }
    if (this.openAfterList) {
      const courseId = this.openAfterList;
      this.openAfterList = ""; this.languageFilter = "";
      await this.dispatch("enroll", { courseId, entryPath: "beginner" }, cx);
    }
  }

  /** @param {Context} cx */
  startWatch(cx) {
    this.pause();
    if (!this.data?.folder || !this.data.file) return;
    const turn = this.watchTurn, directory = this.data.folder, file = this.data.file;
    cx.spawn(async cx => {
      while (turn === this.watchTurn && this.host.screen === "courses" && this.page === "task") {
        try {
          this.watch = watchFolder(directory);
          const changes = await this.watch;
          if (turn !== this.watchTurn) return;
          const files = this.task()?.workspace?.editable.map(entry => `${directory}/${entry.file}`) ?? [file];
          if (changes.some(path => [normalized(directory), ...files.map(normalized)].includes(normalized(path)))) this.queueSave(cx);
        } catch { return; }
      }
    });
  }

  /** @param {Context} cx */
  queueSave(cx) {
    this.pendingSave = true;
    if (this.data) this.data.stale = true;
    if (this.saveLoop) return;
    this.saveLoop = true;
    cx.spawn(async cx => {
      try {
        while (this.pendingSave && this.host.screen === "courses" && this.page === "task") {
          await cx.sleep(250);
          if (this.busy || this.host.busy) continue;
          this.pendingSave = false;
          await this.dispatch("check-saved", { taskId: this.data?.enrollment.activeTask }, cx);
        }
      } finally { this.saveLoop = false; cx.notify(); }
    });
  }

  lesson() { return this.data?.course.lessons.find(lesson => lesson.id === this.data.enrollment.position?.moduleId); }
  task() { return [...(this.data?.course.lessons.flatMap(lesson => [...lesson.tasks, ...(lesson.extraTasks ?? [])]) ?? []), ...(this.data?.course.readiness ?? []).map(group => group.task)].find(task => task.id === this.data.enrollment.activeTask); }

  /** Readiness checks belong to no lesson. @param {string | null | undefined} id */
  isReadiness(id) { return Boolean(id && this.data?.course.readiness?.some(group => group.task.id === id)); }

  /** @param {string} id */
  isExtra(id) { return Boolean(this.data?.course.lessons.some(lesson => lesson.extraTasks?.some(task => task.id === id))); }

  helpRequest() {
    const position = this.data?.enrollment.position;
    if (!position || !["lesson", "task"].includes(this.page)) return null;
    const taskId = this.page === "task" ? this.data.enrollment.activeTask : null;
    const lesson = taskId ? this.data.course.lessons.find(lesson => [...lesson.tasks, ...(lesson.extraTasks ?? [])].some(task => task.id === taskId)) : this.lesson();
    // Readiness checks are assessments, so they offer no AI help.
    if (!lesson) return null;
    return { courseId: this.data.course.id, contentVersion: this.data.course.contentVersion, moduleId: lesson.id, step: lesson.id === position.moduleId ? position.step : 0, taskId };
  }

  helpKey() {
    const request = this.helpRequest();
    return request ? `${request.courseId}/${request.moduleId}/${request.taskId ?? request.step}` : "";
  }

  /** @param {string} id @param {Context} cx */
  practiceTopic(id, cx) {
    if (!this.data || this.busy) return;
    const languageId = this.data.course.languageId;
    if (!this.host.enabledLanguages.includes(languageId)) {
      this.error = "Enable this language in Setup before opening its practice topics."; cx.notify(); return;
    }
    this.pause();
    this.host.pendingTopic = id.split("/")[0];
    this.host.screen = "topics";
    this.host.perform("language", languageId, cx);
  }

  /** Opens Practice topics, where Review shows every due drill. @param {Context} cx */
  practiceReview(cx) {
    if (!this.data || this.busy) return;
    const languageId = this.data.course.languageId;
    if (!this.host.enabledLanguages.includes(languageId)) {
      this.error = "Enable this language in Setup before opening practice review."; cx.notify(); return;
    }
    this.pause();
    this.host.screen = "topics";
    this.host.perform("language", languageId, cx);
  }

  /** @param {number} by @param {Context} cx */
  advance(by, cx) {
    const position = this.data?.enrollment.position, lesson = this.lesson();
    if (!position || !lesson || this.busy) return;
    cx.spawn(async cx => {
      if (by > 0) await this.dispatch("seen", { moduleId: lesson.id, step: position.step }, cx);
      if (this.error) return;
      const step = position.step + by;
      if (!lesson.steps[step]) { this.page = "modules"; this.pause(); cx.notify(); }
      else await this.dispatch("open", { moduleId: lesson.id, step }, cx);
    });
  }

  /** @param {string} key @param {Context} cx */
  key(key, cx) {
    if (this.busy || this.host.busy) return;
    if (key === "escape") this.back(cx);
    else if (this.page === "modules" && key === "enter") { const next = this.nextStep(); if (next) this.run("open", next, cx); }
    else if (this.page === "lesson" && ["n", "right"].includes(key)) this.advance(1, cx);
    else if (this.page === "lesson" && ["p", "left"].includes(key)) this.advance(-1, cx);
    else if (this.page === "lesson" && key === "r") {
      const lesson = this.lesson(), step = lesson?.steps[this.data?.enrollment.position?.step ?? -1];
      const id = [...(step?.examples ?? []), ...(step?.example ? [step.example] : [])].find(id => !lesson?.examples[id].readOnly);
      const answered = (step?.questions ?? []).every(q => this.data?.enrollment.modules[lesson?.id ?? ""]?.questions?.[q]);
      if (lesson && id && answered) this.run("example", { moduleId: lesson.id, exampleId: id }, cx);
    }
    else if (this.page === "task") {
      const taskId = this.data?.enrollment.activeTask;
      if (key === "o") this.host.openEditor(cx);
      else if (key === "c") this.run("check", { taskId }, cx);
      else if (key === "h") this.run("hint", { taskId }, cx);
    }
  }

  /** @param {Context} cx */
  back(cx) {
    if (this.busy) return;
    this.confirmReset = false;
    if (this.page === "settings") this.page = this.settingsReturn === "settings" ? "catalog" : this.settingsReturn;
    else if (this.page === "source") this.page = this.sourceReturnPage;
    else if (this.page !== "catalog" && this.data?.enrollment.review) this.run("review-end", {}, cx);
    else if (this.page === "task" && this.isReadiness(this.data?.enrollment.activeTask)) { this.page = "modules"; this.pause(); }
    else if (this.page === "task" && this.data?.enrollment.position) this.run("open", this.data.enrollment.position, cx);
    else if (this.page === "lesson" || this.page === "repo-lesson") { this.page = "modules"; this.pause(); }
    else if (this.page === "modules") { this.page = "catalog"; this.pause(); }
    else {
      this.pause(); this.host.screen = this.returnScreen;
      if (["practice", "scratch"].includes(this.returnScreen) && this.host.state) this.host.perform("status", null, cx);
    }
    cx.notify();
  }

  /** @param {Theme} t */
  render(t) {
    const body = v_flex().id("course-body").flex_1().min_h(0).overflow_y_scroll().p(16);
    // Content sits in a centred column instead of the full window. The lesson is wider because it has a step list.
    const column = v_flex().w_full().max_w(this.page === "lesson" ? 1040 : 760).mx_auto().gap(12);
    if (this.generatingRepoLesson || this.generatingExtras) column.child(keyButton(t,"cancel-repo-lesson","","Cancel generation",Boolean(this.host.tutorRequestId),cx=>this.host.cancelTutor(cx)));
    if (this.error) column.child(banner(t, this.error, t.blocked));
    if (this.page === "catalog") this.catalogView(column, t);
    else if (this.page === "settings") this.settingsView(column, t);
    else if (this.data) {
      if (this.page === "modules") this.modules(column, t);
      else if (this.page === "lesson") this.lessonView(column, t);
      else if (this.page === "repo-lesson") this.repoLessonView(column, t);
      else if (this.page === "source") this.sourceView(column, t);
      else if (this.page === "task") this.taskView(column, t);
      // The AI box belongs to exercises. On reading steps it looked like the place to write code.
      if (this.page === "task" && this.host.tutor.enabled) column.child(sectionLabel(t, "ASK THE AI TUTOR")).child(tutorChat(t, {
        messages: this.host.tutorThreads[this.helpKey()] ?? [], busy: this.host.tutorBusy, error: this.host.tutorError,
        input: this.host.tutorInput, typing: this.host.typing, send: cx => this.host.askTutor(cx),
      }));
    }
    const backLabel = this.page === "catalog" ? `Back to ${this.returnScreen === "setup" ? "setup" : this.returnScreen === "languages" ? "languages" : "practice"}`
      : this.page === "settings" ? "Back"
      : this.data?.enrollment.review ? "End review" : this.page === "task" && !this.isReadiness(this.data?.enrollment.activeTask) ? "Back to lesson"
      : this.page === "lesson" ? "Course page" : this.page === "modules" ? "Courses" : "Back";
    body.child(column);
    sweepCode();
    // Loading shows in the footer, so the page never shifts while a step opens.
    const footer = paneBar(t).items_center().child(keyButton(t, "course-back", "", backLabel, !this.busy, cx => this.back(cx)))
      .child(h_flex().flex_1().gap(8).items_center().px(12).when(Boolean(this.busy), el => el.child(spinner(t)).child(div().text_size(12).text_color(t.muted).child(this.busy))));
    const lesson = this.page === "lesson" ? this.lesson() : null, position = this.data?.enrollment.position;
    if (lesson && position) {
      // Previous, where you are, and Continue: the one filled button, bright once the step is done.
      const step = lesson.steps[position.step], last = position.step + 1 === lesson.steps.length;
      const done = (step.questions ?? []).every(id => this.data?.enrollment.modules[lesson.id]?.questions?.[id]?.correct);
      footer.child(keyButton(t, "course-previous", "", "Previous", !this.busy && position.step > 0, cx => this.advance(-1, cx)))
        .child(div().px(12).text_size(12).text_color(t.muted).child(`${position.step + 1} / ${lesson.steps.length}`))
        .child(primaryButton(t, "course-next", last ? "Finish module" : "Continue \u2192", !this.busy, done, cx => this.advance(1, cx)));
    }
    // One line of shortcuts for this screen, instead of a key on every button.
    const keys = ["esc back", ...(this.page === "modules" ? ["enter continue"] : this.page === "lesson" ? ["p previous", "n continue", "r run"] : this.page === "task" ? ["o open in editor", "c check", "h hint"] : [])];
    return v_flex().flex_1().min_h(0).child(body).child(footer)
      .child(h_flex().px(16).pb(6).justify_end().text_size(11).text_color(t.dim).child(keys.join("  \u00b7  ")));
  }

  /**
   * A course screen's top line: where esc goes, what this is, and an optional right side.
   * @param {Theme} t @param {string} back @param {string} title @param {any} [right]
   */
  header(t, back, title, right) {
    return h_flex().gap(12).items_center().pb(4).border_b_1().border_color(t.border)
      .child(div().id("course-header-back").flex_none().text_size(12).text_color(t.muted).cursor_pointer().hover(s => s.text_color(t.foreground))
        .on_click((_e, cx) => this.back(cx)).child(`\u2190 ${back}`))
      .child(div().flex_1().font_semibold().child(title))
      .when(Boolean(right), el => el.child(right));
  }

  /** @param {Theme} t @param {string} id */
  settingsButton(t, id) {
    return keyButton(t, id, "", "Settings", !this.busy, cx => { this.settingsReturn = this.page; this.page = "settings"; cx.notify(); });
  }

  /** The 1-based place of a module in its course. @param {string} moduleId */
  moduleNumber(moduleId) { return (this.data?.course.modules.findIndex(module => module.id === moduleId) ?? -1) + 1; }

  /** "done", "started" or "new", from the steps read. @param {string} moduleId */
  moduleState(moduleId) {
    const lesson = this.data?.course.lessons.find(lesson => lesson.id === moduleId);
    const seen = new Set(this.data?.enrollment.modules[moduleId]?.seen ?? []).size;
    if (lesson && seen >= lesson.steps.length) return "done";
    return seen || this.data?.enrollment.position?.moduleId === moduleId ? "started" : "new";
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  catalogView(body, t) {
    body.child(h_flex().gap(12).items_center()
      .child(div().flex_1().font_semibold().child(this.languageFilter ? `${findLanguage(this.languageFilter).name} courses` : "Courses"))
      .child(this.settingsButton(t, "course-catalog-settings")));
    if (this.languageFilter) body.child(keyButton(t,"course-all-languages","","All courses",!this.busy,cx=>{this.languageFilter="";cx.notify();}));
    for (const course of this.catalog.filter(course=>!this.languageFilter || course.languageId===this.languageFilter)) {
      const total = course.total ?? 0, done = course.done ?? 0, started = Boolean(course.enrolledVersion);
      const summary = course.error ?? `${total} ${course.reading ? "reading modules" : "modules"}${course.preview ? " \u00b7 Preview" : ""}`;
      const open = (/** @type {Context} */ cx) => this.run("enroll", { courseId: course.id, entryPath: "beginner" }, cx);
      body.child(card(t, { id: `course-card-${course.id}`, click: this.busy || course.error ? undefined : open })
        .child(div().font_semibold().child(courseName(course)))
        .child(div().text_size(12).text_color(t.muted).child(summary))
        .child(h_flex().gap(10).items_center()
          .child(div().w(200).child(progressBar(t, total ? done / total : 0)))
          .child(div().text_size(12).text_color(t.muted).child(started ? `${done} of ${total} done` : "Not started")))
        .child(h_flex().gap(12).items_center()
          .child(div().text_size(12).text_color(t.accent).child(started ? "Continue \u2192" : "Start \u2192"))
          // A newer version is offered here. Updating carries reading and answers over and opens the course.
          .when(Boolean(started && course.contentVersion && course.enrolledVersion !== course.contentVersion), el => el.child(
            h_flex().id(`course-update-${course.id}`).h(26).px(10).items_center().rounded(8).border_1().border_color(t.accent).text_size(12)
              .when(!this.busy, b => b.cursor_pointer().hover(s => s.bg(t.selected)).on_click((_e, cx) => {
                cx.stop_propagation();
                this.run("update-version", { courseId: course.id, contentVersion: course.enrolledVersion, to: course.contentVersion }, cx);
              }))
              .child(`Update to ${course.contentVersion}`)))));
    }
  }

  /** Course settings: known languages, the repo, older versions. @param {import("gpui-kit").Element} body @param {Theme} t */
  settingsView(body, t) {
    body.child(this.header(t, this.settingsReturn === "catalog" ? "Courses" : "Back", this.data && this.settingsReturn !== "catalog" ? `${courseName(this.data.course)} settings` : "Course settings"));
    this.profileView(body, t);
    const summary = this.data && this.settingsReturn !== "catalog" ? this.catalog.find(course => course.id === this.data?.course.id) : null;
    if (summary) {
      const older = (summary.versions ?? []).filter(version => version !== summary.enrolledVersion);
      if (older.length || (summary.enrolledVersion && summary.enrolledVersion !== summary.contentVersion)) body.child(sectionLabel(t, "Course versions"));
      for (const version of older) body.child(keyButton(t, `course-version-${summary.id}-${version}`, "", `Resume ${version}`, !this.busy,
        cx => this.run("enroll", { courseId: summary.id, contentVersion: version }, cx)));
      if (summary.enrolledVersion && summary.enrolledVersion !== summary.contentVersion) body.child(keyButton(t, `course-latest-${summary.id}`, "", "Start latest version separately", !this.busy,
        cx => this.run("enroll", { courseId: summary.id, contentVersion: summary.contentVersion }, cx)));
    }
    if (!this.data || this.settingsReturn === "catalog" || this.data.course.reading) return;
    const repo = this.data.attachment;
    body.child(sectionLabel(t, "Optional repo examples"));
    if (repo) body.child(div().text_color(t.muted).child(repo.available ? `${repo.name} \u00b7 pinned at ${repo.commit?.slice(0, 10)}` : repo.detail));
    body.child(div().text_size(12).text_color(t.muted).child("Attach a repo in this language for optional AI lessons and questions. Generation sends a bounded source sample to your configured model."))
      .child(textInput(t, this.repoInput, this.host.typing))
      .child(h_flex().gap(8).flex_wrap()
        .child(keyButton(t, "course-attach-repo", "", "Attach repo", !this.busy && Boolean(this.repoInput.value().trim()), cx => this.run("attach-repo", { path: this.repoInput.value() }, cx)))
        .child(keyButton(t, "course-detach-repo", "", "Detach", !this.busy && Boolean(repo), cx => this.run("detach-repo", {}, cx))));
    body.child(keyButton(t,"course-repo-architecture","","Explain repo architecture",!this.busy && Boolean(repo?.available) && this.host.tutor.enabled,cx=>this.generateRepoLesson(null,cx)));
    if (!this.host.tutor.enabled) body.child(div().text_size(12).text_color(t.muted).child("Enable the AI tutor in Setup to generate repo lessons."));
    if (this.data.repoLessons?.error) body.child(banner(t,this.data.repoLessons.error));
    for (const lesson of this.data.repoLessons?.lessons ?? []) body.child(keyButton(t,`repo-lesson-${lesson.id}`,"",`${lesson.title} \u00b7 ${lesson.commit.slice(0,10)}`,!this.busy,cx=>{this.repoLessonId=lesson.id;this.page="repo-lesson";cx.notify();}));
  }

  /** Where Continue goes: the saved position, else the first unfinished module. */
  nextStep() {
    const position = this.data?.enrollment.position;
    if (position) return position;
    const module = this.data?.course.modules.find(module => module.status === "available" && this.moduleState(module.id) !== "done");
    return module ? { moduleId: module.id, step: 0 } : null;
  }

  /** The course page: one Continue box, then the numbered modules. @param {import("gpui-kit").Element} body @param {Theme} t */
  modules(body, t) {
    const course = this.data.course;
    // Drills are optional, so they are one quiet button, never a reminder.
    const tools = h_flex().gap(8).when(!course.reading, el => el.child(keyButton(t, "course-practice-review", "", "Practice drills", !this.busy, cx => this.practiceReview(cx))))
      .child(this.settingsButton(t, "course-settings"));
    body.child(this.header(t, "Courses", courseName(course), tools));
    this.updateView(body, t);
    if (this.data.drillError) body.child(banner(t, this.data.drillError));
    const next = this.nextStep();
    const nextLesson = next && course.lessons.find(lesson => lesson.id === next.moduleId);
    if (next && nextLesson) {
      const step = nextLesson.steps[next.step];
      body.child(card(t, { id: "course-up-next", on: true, click: this.busy ? undefined : cx => this.run("open", next, cx) })
        .child(div().text_size(11).text_color(t.dim).child("Up next"))
        .child(h_flex().gap(12).items_center()
          .child(v_flex().flex_1().gap(2)
            .child(div().font_semibold().child(`${this.moduleNumber(nextLesson.id)}. ${nextLesson.title}${step ? ` \u00b7 ${step.title}` : ""}`))
            .child(div().text_size(12).text_color(t.muted).child(`Step ${next.step + 1} of ${nextLesson.steps.length}`)))
          .child(div().flex_none().text_size(12).text_color(t.accent).child("Continue \u2192"))));
    } else body.child(banner(t, "You have read every module. Open any module below to revisit it.", t.done));
    const reviewing = Boolean(this.data.enrollment.review);
    if (reviewing || this.data.reviewReady > 0) body.child(h_flex().gap(8).items_center()
      .child(keyButton(t, "course-review", "", reviewing ? "Resume review" : `Review \u00b7 ${this.data.reviewReady} ready`, !this.busy, cx => this.run("review-start", {}, cx)))
      .child(div().text_size(12).text_color(t.muted).child("Exercises you passed, back for another try.")));
    body.child(sectionLabel(t, "MODULES"));
    for (const [index, module] of course.modules.entries()) {
      const state = module.status === "planned" ? "planned" : this.moduleState(module.id);
      const lesson = course.lessons.find(lesson => lesson.id === module.id);
      const seen = new Set(this.data.enrollment.modules[module.id]?.seen ?? []).size;
      const status = state === "done" ? "Done" : state === "started" && lesson ? `${seen} of ${lesson.steps.length} steps` : state === "planned" ? "Planned" : "";
      const mark = state === "done" ? "\u2713" : state === "started" ? "\u25cf" : "\u25cb";
      const open = module.status === "available" && !this.busy;
      body.child(h_flex().id(`course-module-${module.id}`).gap(10).items_center().px(8).py(6).rounded(8)
        .when(state === "started", el => el.bg(t.selected))
        .when(open, el => el.cursor_pointer().hover(s => s.bg(t.raised)).on_click((_e, cx) => this.run("open", { moduleId: module.id, step: 0 }, cx)))
        .child(div().w(16).flex_none().text_color(state === "new" || state === "planned" ? t.dim : t.accent).child(mark))
        .child(div().flex_1().when(state === "started", el => el.font_semibold()).child(`${index + 1}. ${module.title}`))
        .child(div().flex_none().text_size(12).text_color(t.muted).child(status)));
    }
    this.readinessView(body, t);
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  profileView(body,t) {
    body.child(sectionLabel(t,"Languages you already know"))
      .child(div().text_size(12).text_color(t.muted).child("Optional. AI explanations can compare with these languages. Separate names with commas. Leave empty if you are new to programming."))
      .child(textInput(t,this.knownInput,this.host.typing))
      .child(keyButton(t,"save-learning-profile","","Save languages",!this.busy && !this.profile.error,cx=>this.saveProfile(cx)));
    if(this.profile.error) body.child(banner(t,this.profile.error));
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  repoLessonView(body, t) {
    const lesson=this.data.repoLessons?.lessons.find(lesson=>lesson.id===this.repoLessonId);
    if (!lesson) return;
    body.child(sectionLabel(t,lesson.title))
      .child(div().text_color(t.muted).child(`AI-generated reading · ${lesson.name} · ${lesson.commit.slice(0,10)}`))
      .child(banner(t,`${lesson.scope} Source references are checked. The explanation may still contain mistakes.`));
    for (const [index,section] of lesson.sections.entries()) {
      body.child(sectionLabel(t,section.title)).child(markdown(`repo-text-${lesson.id}-${index}`,section.text));
      for (const [refIndex,ref] of section.references.entries()) body.child(div().text_size(11).text_color(t.muted).child(`${ref.path}:${ref.start}-${ref.end}`))
        .child(codeBlock(t,`repo-code-${lesson.id}-${index}-${refIndex}`,ref.code,this.data.course.codeFence??"text"))
        .child(keyButton(t,`repo-source-${index}-${refIndex}`,"","Read source file",!this.busy,cx=>this.run("source",{repoLessonId:lesson.id,sectionIndex:index,referenceIndex:refIndex},cx)));
    }
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  sourceView(body, t) {
    const source = this.source;
    if (!source) return;
    body.child(sectionLabel(t, source.path))
      .child(div().text_color(t.muted).child(`Pinned commit ${source.commit.slice(0,10)} · lines ${source.start}–${source.end}${source.total ? ` of ${source.total}` : ""}`));
    if (source.detail) body.child(banner(t,source.detail));
    body.child(div().text_size(12).text_color(t.muted).child(`Referenced lines ${source.referenceStart}–${source.referenceEnd} are marked >.`));
    const code = source.code.split("\n").map((line,index)=>{
      const number=source.start+index;
      return `${number>=source.referenceStart && number<=source.referenceEnd ? ">" : " "} ${String(number).padStart(5)}  ${line}`;
    }).join("\n");
    // A longer fence preserves code containing Markdown fences.
    const fence="`".repeat([...code.matchAll(/`+/g)].reduce((length,match)=>Math.max(length,match[0].length+1),3));
    if (source.code) body.child(markdown("repo-source-code",`${fence}text\n${code}\n${fence}`));
    body.child(h_flex().gap(8).flex_wrap()
      .child(keyButton(t,"source-previous","","Previous lines",!this.busy && Boolean(source.previous),cx=>this.run("source",{...this.sourceRequest,line:source.previous},cx)))
      .child(keyButton(t,"source-reference","","Referenced lines",!this.busy && Boolean(source.total),cx=>this.run("source",{...this.sourceRequest,line:Math.max(1,source.referenceStart-20)},cx)))
      .child(keyButton(t,"source-next","","Next lines",!this.busy && Boolean(source.next),cx=>this.run("source",{...this.sourceRequest,line:source.next},cx))));
  }

  /** The lesson: every step of the module on the left, the current step on the right. @param {import("gpui-kit").Element} body @param {Theme} t */
  lessonView(body, t) {
    const lesson = this.lesson(), position = this.data.enrollment.position;
    if (!lesson || !position) return;
    const step = lesson.steps[position.step], last = position.step + 1 === lesson.steps.length;
    const progress = this.data.enrollment.modules[lesson.id];
    const seen = new Set(progress?.seen ?? []);
    const exercise = (/** @type {any} */ item) => Boolean(item.task || item.tasks?.length);
    body.child(this.header(t, courseName(this.data.course), `${this.moduleNumber(lesson.id)}. ${lesson.title}`,
      div().text_size(12).text_color(t.muted).child(`Step ${position.step + 1} of ${lesson.steps.length}`)));
    // Step list: reading steps under Learn, exercise steps under Practice. Any step can be opened.
    const rail = v_flex().w(220).flex_none().gap(2).p(10).rounded(10).bg(t.raised);
    const row = (/** @type {any} */ item, /** @type {number} */ index) => {
      const current = index === position.step, read = seen.has(index);
      const mark = read && !current ? "\u2713" : current ? "\u25cf" : exercise(item) ? "\u25a1" : "\u25cb";
      return h_flex().id(`course-step-${index}`).gap(8).px(8).py(5).rounded(6).items_center()
        .when(current, el => el.bg(t.selected))
        .when(!this.busy && !current, el => el.cursor_pointer().hover(s => s.bg(t.background)).on_click((_e, cx) => this.run("open", { moduleId: lesson.id, step: index }, cx)))
        .child(div().w(14).flex_none().text_size(12).text_color(read && !current ? t.done : current ? t.accent : t.dim).child(mark))
        .child(div().text_size(12).text_color(current ? t.foreground : read ? t.muted : t.foreground).when(current, el => el.font_semibold()).child(item.title));
    };
    rail.child(div().px(8).pb(4).text_size(10).font_semibold().text_color(t.dim).child("LEARN"));
    lesson.steps.forEach((item, index) => { if (!exercise(item)) rail.child(row(item, index)); });
    if (lesson.steps.some(exercise)) {
      rail.child(div().px(8).pt(10).pb(4).text_size(10).font_semibold().text_color(t.dim).child("PRACTICE IN YOUR EDITOR"));
      lesson.steps.forEach((item, index) => { if (exercise(item)) rail.child(row(item, index)); });
    }
    rail.child(div().px(8).pt(12).text_size(11).text_color(t.dim).child(`${lesson.steps.filter((_item, index) => seen.has(index)).length} of ${lesson.steps.length} done`));
    // The step, in a column about 70 characters wide.
    const main = v_flex().flex_1().min_w(0).max_w(680).gap(12);
    // An element takes no children once it has a parent, so the panes are attached after they are filled.
    const attach = () => { body.child(h_flex().gap(24).items_start().child(rail).child(main)); };
    if (!this.data.course.reading && this.data.attachment?.available && this.host.tutor.enabled) main.child(h_flex().child(keyButton(t,"course-repo-module","","Explain this topic using my repo",!this.busy,cx=>this.generateRepoLesson(lesson.id,cx))));
    main.child(div().text_size(11).font_semibold().text_color(t.accent).child(`STEP ${position.step + 1} OF ${lesson.steps.length} \u00b7 ${KIND[step.kind] ?? "LEARN"}`))
      .child(div().text_size(18).font_semibold().child(step.title));
    if (position.step === 0) {
      const exerciseSteps = lesson.steps.flatMap((item, index) => exercise(item) ? [index + 1] : []);
      if (lesson.intro !== step.text) main.child(richText(t, "course-intro", lesson.intro, this.data.course.codeFence));
      if (exerciseSteps.length) main.child(div().text_size(12).text_color(t.muted).child(`Read each step, then Continue. ${exerciseSteps.length === 1 ? `Step ${exerciseSteps[0]} opens` : `Steps ${exerciseSteps.slice(0, -1).join(", ")} and ${exerciseSteps.at(-1)} open`} a file in your editor and check it when you save.`));
    }
    if (step.text) main.child(richText(t, "course-step", step.text, this.data.course.codeFence));
    const exampleIds = [...(step.examples ?? []), ...(step.example ? [step.example] : [])];
    const questions = step.questions ?? [];
    // Predict first: a step's question comes before its Run button, which unlocks once every question is answered.
    const answered = questions.every(id => progress?.questions?.[id]);
    const runnable = exampleIds.filter(id => !lesson.examples[id].readOnly);
    const staged = questions.length > 0 && exampleIds.length > 0;
    if (staged) main.child(stage(t, 1, "Read the code", false));
    for (const id of exampleIds) {
      const example = lesson.examples[id];
      // An example can name its own fence, such as http or json. Otherwise it is in the course's language.
      main.child(codeBlock(t, `course-example-${id}`, example.code, example.fence ?? this.data.course.codeFence ?? "typescript"));
    }
    if (questions.length) main.child(stage(t, staged ? 2 : 1, questions.length > 1 ? "Pick your answers" : "Pick your answer", !answered));
    for (const id of questions) {
      const question = lesson.questions.find(question => question.id === id);
      const result = progress?.questions?.[id];
      main.child(richText(t, `course-question-${id}`, question.prompt, this.data.course.codeFence));
      question.choices.forEach((choice, index) => {
        const picked = result?.choice === index;
        main.child(h_flex().id(`course-choice-${id}-${index}`).px(12).py(8).rounded(8).border_1()
          .border_color(picked ? (result?.correct ? t.done : t.blocked) : t.border).bg(picked ? t.selected : t.raised)
          .when(!this.busy, el => el.cursor_pointer().hover(s => s.border_color(t.accent)).on_click((_e, cx) => this.run("question", { moduleId: lesson.id, questionId: id, choice: index }, cx)))
          .child(div().flex_1().child(markdown(`course-choice-text-${id}-${index}`, choice.text)))
          .when(picked, el => el.child(div().text_color(result?.correct ? t.done : t.blocked).child(result?.correct ? "\u2713" : "\u2715"))));
      });
      if (result) main.child(richText(t, `course-feedback-${id}`, `**${result.correct ? "Right." : "Not quite."}** ${question.choices[result.choice].feedback}`));
    }
    if (runnable.length) {
      if (questions.length) main.child(stage(t, staged ? 3 : 2, "Run it to check", answered));
      for (const id of runnable) {
        const result = progress?.examples?.[id];
        const out = result ? result.details.join("\n") : "";
        main.child(h_flex().gap(12).items_start()
          .child(keyButton(t, `course-run-example-${id}`, "", "\u25b6 Run", !this.busy && answered, cx => this.run("example", { moduleId: lesson.id, exampleId: id }, cx)))
          .child(v_flex().flex_1().min_w(0).gap(4)
            .when(!answered, el => el.child(div().text_size(12).text_color(t.dim).child("Unlocks after you answer.")))
            .when(Boolean(result), el => el.child(div().text_size(11).text_color(result?.passed ? t.done : t.foreground).child(result?.title ?? ""))
              .child(markdown(`course-example-result-${id}`, `\`\`\`text\n${out}\n\`\`\``)))));
      }
    }
    for (const id of [...(step.tasks ?? []), ...(step.task ? [step.task] : [])]) {
      const task = lesson.tasks.find(task => task.id === id);
      const done = this.data.enrollment.tasks[id];
      main.child(card(t, { id: `course-task-card-${id}`, click: this.busy ? undefined : cx => this.run("task", { taskId: id }, cx) })
        .child(h_flex().gap(8).items_center()
          .child(div().flex_1().font_semibold().child(task.title))
          .child(div().text_size(12).text_color(done?.passes ? t.done : t.muted).child(done?.passes ? "Passed" : done?.attempts ? "Started" : "Open exercise \u2192"))));
    }
    if (!last) { attach(); return; }
    const topics = [...new Set((lesson.drills ?? []).map(id => id.split("/")[0]))];
    if (topics.length) main.child(sectionLabel(t, "KEEP PRACTICING")).child(h_flex().gap(8).flex_wrap().children(topics.map(topic =>
      keyButton(t, `course-drill-${topic}`, "", `Practice ${topic}`, !this.busy && !this.data.enrollment.review, cx => this.practiceTopic(topic, cx)))));
    if (this.data.extrasError) main.child(banner(t, this.data.extrasError));
    if ((lesson.extraTasks ?? []).length) main.child(sectionLabel(t, "EXTRA PRACTICE"));
    for (const task of lesson.extraTasks ?? []) main.child(keyButton(t, `course-extra-${task.id}`, "", `${task.title} \u00b7 AI-generated`, !this.busy && !this.data.enrollment.review, cx => this.run("task", { taskId: task.id }, cx)));
    if (this.data.course.reading || !this.host.tutor.enabled) { attach(); return; }
    if ((lesson.extraTasks ?? []).length < 6) main.child(h_flex().child(keyButton(t, "course-write-extra", "", "Write extra practice", !this.busy && !this.data.enrollment.review && !this.data.extrasError, cx => this.generateExtraPractice(lesson.id, cx))))
      .child(div().text_size(11).text_color(t.muted).child("Optional. Each exercise is saved only after its reference passes and its starter and known wrong answers fail. Extra practice does not count toward module status or course review."));
    attach();
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  updateView(body, t) {
    const update = this.data.update, migration = this.data.migration;
    if (migration?.retiredTasks?.length) body.child(div().text_size(11).text_color(t.muted).child(`Updated from ${migration.from}. ${migration.retiredTasks.length} removed exercises keep their answers and history.`));
    if (!update) return;
    if (update.started) { body.child(banner(t, `Version ${update.to} is already started. Resume it from Courses.`)); return; }
    if (!update.compatible) { body.child(banner(t, `Version ${update.to} cannot take progress from this version. You can start it separately from Courses.`)); return; }
    // A compatible update is offered on the course's card in the catalog, not here.
  }

  /** Skip-ahead tests (readiness checks). A pass covers that task only. @param {import("gpui-kit").Element} body @param {Theme} t */
  readinessView(body, t) {
    const groups = this.data.course.readiness ?? [];
    if (!groups.length) return;
    const tried = groups.some(group => this.data.enrollment.tasks[group.task.id]?.attempts);
    if (!this.showReadiness && this.data.enrollment.entryPath !== "experienced" && !tried) {
      body.child(h_flex().pt(8).gap(8).items_center()
        .child(div().text_size(12).text_color(t.muted).child(`Already know some ${findLanguage(this.data.course.languageId)?.name ?? "of this"}?`))
        .child(keyButton(t, "course-skip-ahead", "", "Take a skip-ahead test", !this.busy, cx => { this.showReadiness = true; cx.notify(); })));
      return;
    }
    body.child(sectionLabel(t, "SKIP-AHEAD TESTS"))
      .child(div().text_size(12).text_color(t.muted).child("Each test is a new problem covering several modules. The result says which modules you can skim."));
    const title = (/** @type {string} */ id) => this.data.course.modules.find(module => module.id === id)?.title ?? id;
    for (const group of groups) {
      const progress = this.data.enrollment.tasks[group.task.id];
      const names = group.modules.map(title).join(", ");
      const result = !progress?.attempts ? `Covers ${names}.`
        : progress.independentPasses ? `Passed without help. You could skim ${names}.`
        : progress.passes ? `Passed with help. Review ${title(group.modules[0])} first.`
        : `Not passed yet. Start with ${title(group.modules[0])}.`;
      body.child(h_flex().gap(8).flex_wrap()
        .child(keyButton(t, `course-readiness-${group.id}`, "", `${group.id} \u00b7 ${group.title}`, !this.busy && !this.data.enrollment.review, cx => this.run("task", { taskId: group.task.id }, cx)))
        .child(div().text_size(11).text_color(t.dim).child(result)));
    }
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  taskView(body, t) {
    const task = this.task();
    if (!task) return;
    const progress = this.data.enrollment.tasks[task.id];
    const fence = this.data.course.codeFence ?? "typescript";
    const lesson = this.data.course.lessons.find(lesson => lesson.tasks.some(item => item.id === task.id));
    const readiness = this.isReadiness(task.id);
    const siblings = lesson?.tasks.filter(item => item.role !== "review") ?? [];
    const place = siblings.findIndex(item => item.id === task.id);
    body.child(this.header(t, readiness ? courseName(this.data.course) : lesson ? `${this.moduleNumber(lesson.id)}. ${lesson.title}` : "Lesson",
      readiness ? `Skip-ahead test: ${task.title}` : `Exercise: ${task.title}`,
      place >= 0 ? div().text_size(12).text_color(t.muted).child(`${place + 1} of ${siblings.length}`) : null));
    if(task.generated) body.child(banner(t,`AI-generated exercise. Its reference passed and known wrong answers failed before saving. It checks printed output only.${this.isExtra(task.id) ? " Extra practice does not count toward module status or course review." : ""}`));
    const review = this.data.enrollment.review;
    if (review) body.child(banner(t, `Review ${review.index + 1} of ${review.ids.length}. Fresh files. Your saved practice answers are preserved.`));
    const editorReady = Boolean(this.host.editor) && !this.host.offerEditorDefault;
    body.child(h_flex().gap(8).flex_wrap().items_center()
      .child(primaryButton(t, "course-editor", "Open in editor", !this.busy && !this.host.busy && editorReady, editorReady, cx => this.host.openEditor(cx)))
      .child(keyButton(t, "course-check", "", "Check", !this.busy, cx => this.run("check", { taskId: task.id }, cx)))
      .child(keyButton(t, "course-hint", "", "Hint", !this.busy && task.hints.length < (task.hintTotal??3), cx => this.run("hint", { taskId: task.id }, cx)))
      .child(keyButton(t, "course-answer", "", "Show solution", !this.busy && !task.solution, cx => this.run("answer", { taskId: task.id }, cx)))
      .child(keyButton(t, "course-reset", "", "Start fresh", !this.busy, cx => { this.confirmReset = true; cx.notify(); }))
      .child(div().flex_1().text_size(11).text_color(t.dim).child("Checked when you save")));
    if (!editorReady) body.child(banner(t, "Choose and confirm your editor in Setup before opening this file."));
    if (this.confirmReset) body.child(h_flex().gap(8).flex_wrap().child(div().child("Save editor changes first. The current file will be backed up. Reload it after resetting."))
      .child(keyButton(t, "course-reset-confirm", "", "Reset saved file", !this.busy, cx => { this.confirmReset = false; this.run("reset", { taskId: task.id }, cx); }))
      .child(keyButton(t, "course-reset-cancel", "", "Cancel", true, cx => { this.confirmReset = false; cx.notify(); })));
    body.child(richText(t, "course-task-prompt", task.prompt, fence));
    if (task.workspace) body.child(div().text_color(t.muted).child(`Edit these files in the same folder: ${task.workspace.editable.map(entry => entry.file).join(", ")}. Saving either checks the whole project.`));
    if (progress.result) {
      const passed = !this.data.stale && progress.result.passed;
      const box = card(t, { id: "course-result" })
        .child(div().font_semibold().text_color(passed ? t.done : t.foreground).child(`${this.data.stale ? "Saved code changed. " : ""}${progress.result.title}${progress.result.assisted ? " \u00b7 with help" : ""}`));
      for (const [index, detail] of progress.result.details.entries()) box.child(richText(t, `course-result-${index}`, detail));
      if (!progress.result.passed && task.feedback) box.child(richText(t, "course-feedback", task.feedback, fence));
      body.child(box);
    }
    for (const [index, hint] of task.hints.entries()) body.child(card(t, { id: `course-hint-box-${index}` }).child(div().text_size(11).text_color(t.dim).child(`HINT ${index + 1}`)).child(richText(t, `course-hint-${index}`, hint, fence)));
    if (task.solution) {
      body.child(sectionLabel(t, "SOLUTION"));
      if (task.workspace) for (const file of task.workspace.editable) body.child(div().text_size(12).text_color(t.muted).child(file.file)).child(codeBlock(t, `course-solution-${file.file}`, file.solution ?? "", fence));
      else body.child(codeBlock(t, "course-solution", task.solution, fence));
    }
    const fixtures = task.fixtures.filter(fixture => fixture.declarations.trim());
    if (fixtures.length) {
      body.child(h_flex().child(keyButton(t, "course-fixtures", "", `${this.showFixtures ? "Hide" : "Show"} test inputs (${fixtures.length})`, true, cx => { this.showFixtures = !this.showFixtures; cx.notify(); })));
      if (this.showFixtures) for (const fixture of fixtures) body.child(div().text_size(12).text_color(t.muted).child(`Case ${fixture.id}`)).child(codeBlock(t, `course-fixture-${fixture.id}`, fixture.declarations, fence));
    }
    body.child(div().text_size(11).text_color(t.dim).child(`${progress.attempts} attempts \u00b7 ${progress.independentPasses} passes without help \u00b7 ${(this.data.file ?? "").split(/[\\/]/).pop()}`));
    if (review) { body.child(h_flex().child(keyButton(t, "course-review-next", "", review.index + 1 === review.ids.length ? "Finish review" : "Next review exercise", !this.busy, cx => this.run("review-next", {}, cx)))); return; }
    const next = place >= 0 ? siblings[place + 1] : null;
    if (next) body.child(h_flex().child(keyButton(t, "course-next-task", "", `Next exercise: ${next.title}`, !this.busy && Boolean(progress.passes), cx => { this.showFixtures = false; this.run("task", { taskId: next.id }, cx); })));
  }
}
