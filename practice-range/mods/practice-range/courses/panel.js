import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { watchFolder, window as appWindow } from "herdr";
import { keyButton, spinner } from "../kit/controls.js";
import { banner, paneBar, sectionLabel } from "../kit/pane.js";
import { courseCommand } from "./bridge.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @param {string} id @param {string} text */
const markdown = (id, text) => TextView.markdown(id, text).selectable();
/** @param {string} path */
const normalized = path => appWindow()?.platform === "windows" ? path.replaceAll("\\", "/").toLowerCase() : path.replaceAll("\\", "/");

export class CoursePanel {
  /** @param {import("../main.js").default} host */
  constructor(host) {
    this.host = host;
    /** @type {import("./types.js").CourseSummary[]} */
    this.catalog = [];
    /** @type {import("./types.js").CourseSnapshot | null} */
    this.data = null;
    this.page = "catalog";
    this.busy = "";
    this.error = "";
    this.pendingSave = false;
    this.saveLoop = false;
    this.watchTurn = 0;
    /** @type {import("herdr").FolderWatch | null} */
    this.watch = null;
    this.confirmReset = false;
  }

  /** @param {Context} cx */
  show(cx) {
    this.host.cancelTutor(cx);
    this.host.screen = "courses";
    this.host.pendingSaveCheck = null;
    this.host.confirmRepeat = false;
    this.host.typing = false;
    this.host.handle.focus();
    this.run("list", {}, cx);
  }

  pause() { this.watchTurn++; this.watch?.cancel(); this.watch = null; this.pendingSave = false; }

  /** @param {string} action @param {Record<string, unknown>} value @param {Context} cx */
  run(action, value, cx) {
    if (this.busy) return;
    cx.spawn(async cx => { await this.dispatch(action, value, cx); });
  }

  /** @param {string} action @param {Record<string, unknown>} value @param {Context} cx */
  async dispatch(action, value, cx) {
    if (this.busy) return;
    this.busy = ["check", "check-saved"].includes(action) ? "Checking every case…" : "Loading course…";
    this.error = ""; cx.notify();
    try {
      const request = { courseId: this.data?.course.id, ...value };
      const result = await courseCommand(action, request);
      if (action === "list") {
        this.catalog = result.courses;
        this.page = "catalog";
      } else {
        this.data = result;
        if (action === "enroll") this.page = "modules";
        if (action === "open") { this.page = "lesson"; this.pause(); }
        if (action === "task") { this.page = "task"; this.startWatch(cx); }
        if (result.pendingSave) this.pendingSave = true;
      }
      if (this.host.sync && !["list", "status"].includes(action)) this.host.pushSoon(cx);
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
    finally { this.busy = ""; cx.notify(); }
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
          if (changes.some(path => [normalized(file), normalized(directory)].includes(normalized(path)))) this.queueSave(cx);
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
  task() { return this.data?.course.lessons.flatMap(lesson => lesson.tasks).find(task => task.id === this.data.enrollment.activeTask); }

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
    else if (this.page === "lesson" && ["n", "right"].includes(key)) this.advance(1, cx);
    else if (this.page === "lesson" && ["p", "left"].includes(key)) this.advance(-1, cx);
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
    if (this.page === "task" && this.data?.enrollment.position) this.run("open", this.data.enrollment.position, cx);
    else if (this.page === "lesson") { this.page = "modules"; this.pause(); }
    else if (this.page === "modules") { this.page = "catalog"; this.pause(); }
    else { this.pause(); this.host.screen = "topics"; }
    cx.notify();
  }

  /** @param {Theme} t */
  render(t) {
    const body = v_flex().id("course-body").flex_1().min_h(0).overflow_y_scroll().p(16).gap(12);
    if (this.busy) body.child(h_flex().gap(8).child(spinner(t)).child(div().child(this.busy)));
    if (this.error) body.child(banner(t, this.error, t.blocked));
    if (this.page === "catalog") {
      body.child(div().font_semibold().child("Courses"))
        .child(div().text_color(t.muted).child("Learn with included examples. No repo or AI connection needed."));
      for (const course of this.catalog) {
        body.child(v_flex().gap(8).child(div().font_semibold().child(course.title ?? course.id))
          .child(div().text_color(t.muted).child(course.error ?? `${course.preview ? "Preview · " : ""}${course.available} of ${course.total} modules available`))
          .child(h_flex().gap(8).flex_wrap()
            .child(keyButton(t, `course-beginner-${course.id}`, "", "Start or resume", !this.busy && !course.error, cx => this.run("enroll", { courseId: course.id, entryPath: "beginner" }, cx)))
            .child(keyButton(t, `course-experienced-${course.id}`, "", "I know another language", !this.busy && !course.error, cx => this.run("enroll", { courseId: course.id, entryPath: "experienced" }, cx)))));
      }
    } else if (this.data) {
      body.child(div().font_semibold().child(this.data.course.title));
      if (this.data.course.preview) body.child(banner(t, "Course preview. Unwritten modules are shown as planned. You can explore available modules without completing their prerequisites."));
      if (this.page === "modules") this.modules(body, t);
      else if (this.page === "lesson") this.lessonView(body, t);
      else if (this.page === "task") this.taskView(body, t);
    }
    return v_flex().flex_1().min_h(0).child(body).child(paneBar(t)
      .child(keyButton(t, "course-back", "esc", this.page === "task" ? "Return to lesson" : this.page === "catalog" ? "Back to practice" : "Back", !this.busy, cx => this.back(cx))));
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  modules(body, t) {
    const position = this.data.enrollment.position;
    if (position) body.child(keyButton(t, "course-resume", "", "Continue lesson", !this.busy, cx => this.run("open", position, cx)));
    for (const module of this.data.course.modules) {
      const seen = this.data.enrollment.modules[module.id]?.seen.length ?? 0;
      body.child(h_flex().gap(8).items_center().flex_wrap()
        .child(keyButton(t, module.id, "", module.title, !this.busy && module.status === "available", cx => this.run("open", { moduleId: module.id }, cx)))
        .child(div().text_size(11).text_color(t.dim).child(module.status === "planned" ? "Planned" : `${seen} steps read`)));
    }
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  lessonView(body, t) {
    const lesson = this.lesson(), position = this.data.enrollment.position;
    if (!lesson || !position) return;
    const step = lesson.steps[position.step];
    body.child(sectionLabel(t, `${lesson.title} · ${position.step + 1} of ${lesson.steps.length}`))
      .child(markdown("course-intro", lesson.intro)).child(div().font_semibold().child(step.title)).child(markdown("course-step", step.text));
    for (const id of [...(step.examples ?? []), ...(step.example ? [step.example] : [])]) {
      const example = lesson.examples[id];
      body.child(markdown(`course-example-${id}`, `\`\`\`typescript\n${example.code}\n\`\`\``));
      body.child(div().text_color(t.muted).child(example.stdout ? `Output:\n${example.stdout.join("\n")}`
        : `Expected compiler error: ${example.diagnostics.map(d => `TS${d.code} on line ${d.line}`).join(", ")}`));
    }
    for (const id of step.questions ?? []) {
      const question = lesson.questions.find(question => question.id === id);
      const result = this.data.enrollment.modules[lesson.id]?.questions?.[id];
      body.child(markdown(`course-question-${id}`, question.prompt));
      question.choices.forEach((choice, index) => body.child(keyButton(t, `course-choice-${id}-${index}`, "", choice.text, !this.busy,
        cx => this.run("question", { moduleId: lesson.id, questionId: id, choice: index }, cx))));
      if (result) body.child(banner(t, `${result.correct ? "Correct. " : "Try again. "}${question.choices[result.choice].feedback}`, result.correct ? t.done : t.foreground));
    }
    for (const id of [...(step.tasks ?? []), ...(step.task ? [step.task] : [])]) {
      const task = lesson.tasks.find(task => task.id === id);
      body.child(keyButton(t, `course-task-${id}`, "", task.title, !this.busy, cx => this.run("task", { taskId: id }, cx)));
    }
    body.child(h_flex().gap(8).flex_wrap()
      .child(keyButton(t, "course-previous", "p", "Previous", !this.busy && position.step > 0, cx => this.advance(-1, cx)))
      .child(keyButton(t, "course-next", "n", position.step + 1 === lesson.steps.length ? "Finish reading" : "Continue", !this.busy, cx => this.advance(1, cx))));
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  taskView(body, t) {
    const task = this.task();
    if (!task) return;
    const progress = this.data.enrollment.tasks[task.id];
    body.child(sectionLabel(t, task.title)).child(markdown("course-task-prompt", task.prompt));
    for (const fixture of task.fixtures) body.child(markdown(`course-fixture-${fixture.id}`, `Case ${fixture.id}\n\n\`\`\`typescript\n${fixture.declarations}\n\`\`\``));
    body.child(div().text_color(t.muted).child("Save your answer to check every case. Your answer must pass them all."))
      .when(!this.host.editor || this.host.offerEditorDefault, element => element.child(banner(t, "Choose and confirm your editor in Setup before opening this file.")))
      .child(div().text_size(11).text_color(t.dim).child(this.data.file))
      .child(h_flex().gap(8).flex_wrap()
        .child(keyButton(t, "course-editor", "o", "Open editor", !this.busy && !this.host.busy && Boolean(this.host.editor) && !this.host.offerEditorDefault, cx => this.host.openEditor(cx)))
        .child(keyButton(t, "course-check", "c", "Check saved answer", !this.busy, cx => this.run("check", { taskId: task.id }, cx)))
        .child(keyButton(t, "course-hint", "h", "Another hint", !this.busy && task.hints.length < 3, cx => this.run("hint", { taskId: task.id }, cx)))
        .child(keyButton(t, "course-answer", "", "Show solution", !this.busy && !task.solution, cx => this.run("answer", { taskId: task.id }, cx)))
        .child(keyButton(t, "course-reset", "", "Start fresh", !this.busy, cx => { this.confirmReset = true; cx.notify(); })));
    if (this.confirmReset) body.child(h_flex().gap(8).flex_wrap().child(div().child("Save editor changes first. The current file will be backed up. Reload it after resetting."))
      .child(keyButton(t, "course-reset-confirm", "", "Reset saved file", !this.busy, cx => { this.confirmReset = false; this.run("reset", { taskId: task.id }, cx); }))
      .child(keyButton(t, "course-reset-cancel", "", "Cancel", true, cx => { this.confirmReset = false; cx.notify(); })));
    for (const [index, hint] of task.hints.entries()) body.child(markdown(`course-hint-${index}`, hint));
    if (task.solution) body.child(markdown("course-solution", `\`\`\`typescript\n${task.solution}\n\`\`\``));
    if (progress.result) {
      body.child(banner(t, `${this.data.stale ? "Saved code changed. " : ""}${progress.result.title}${progress.result.assisted ? " · with help" : ""}`, !this.data.stale && progress.result.passed ? t.done : t.foreground));
      for (const [index, detail] of progress.result.details.entries()) body.child(markdown(`course-result-${index}`, detail));
      if (!progress.result.passed) body.child(markdown("course-feedback", task.feedback));
    }
    body.child(div().text_size(11).text_color(t.dim).child(`${progress.attempts} attempts · ${progress.independentPasses} independent passes`));
  }
}
