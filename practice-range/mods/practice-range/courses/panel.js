import { div } from "gpui-kit";
import { v_flex, h_flex, TextView, InputState } from "gpui-base";
import { watchFolder, window as appWindow } from "herdr";
import { keyButton, spinner, textInput } from "../kit/controls.js";
import { banner, paneBar, sectionLabel } from "../kit/pane.js";
import { courseCommand, importTutorPreferences } from "./bridge.js";
import { configuredEditor, configuredTutor, generateRepoLesson } from "../bridge.js";
import { tutorChat } from "../tutor/panel.js";

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
    this.repoLessonId = "";
    this.generatingRepoLesson = false;
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
    /** @type {import("./types.js").TutorImport[]} */
    this.imports=[];
    /** @type {import("./types.js").TutorImport | null} */
    this.importPreview=null;
    this.applyImportPreferences=false;
    this.importInput=InputState.new({placeholder:"Tutor data folder (optional)…"});
    this.importInput.on("focus",()=>{this.host.typing=true;});
    this.importInput.on("blur",()=>{this.host.typing=false;});
    this.importInput.on("change",(_event,cx)=>cx.notify());
    this.importInput.on("submit",(_event,cx)=>this.run("import-list",{},cx));
    this.repoInput = InputState.new({ placeholder: "Local git repo folder…" });
    this.repoInput.on("focus", () => { this.host.typing = true; });
    this.repoInput.on("blur", () => { this.host.typing = false; });
    this.repoInput.on("change", (_event, cx) => cx.notify());
    this.repoInput.on("submit", (_event, cx) => this.run("attach-repo", { path: this.repoInput.value() }, cx));
  }

  /** @param {Context} cx */
  show(cx) {
    const resume = this.host.screen !== "courses" && this.data;
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

  /** @param {string} action @param {Record<string, unknown>} value @param {Context} cx */
  async dispatch(action, value, cx) {
    if (this.busy) return;
    if (action.startsWith("import-") || ["list", "enroll", "open", "source", "task", "review-start", "review-next", "review-end", "attach-repo", "detach-repo"].includes(action)) this.host.cancelTutor(cx);
    this.busy = ["check", "check-saved"].includes(action) ? "Checking every case…" : "Loading course…";
    this.error = ""; cx.notify();
    try {
      const request = { ...(action === "enroll" || action === "list" || action.startsWith("import-") ? {} : { courseId: this.data?.course.id, contentVersion: this.data?.course.contentVersion }),
        ...(action.startsWith("import-")&&this.importInput.value().trim()?{sourceRoot:this.importInput.value().trim()}:{}),...value };
      const result = await courseCommand(action, request);
      if (action === "list") {
        this.catalog = result.courses;
        this.page = "catalog";
      } else if (action === "source") {
        if (this.page !== "source") this.sourceReturnPage = this.page;
        this.source = result.source; this.sourceRequest = value; this.page = "source"; this.pause();
      } else if(action==="import-list") { this.imports=result.imports; this.page="imports"; this.pause(); }
      else if(action==="import-preview") { this.importPreview=result.preview; this.applyImportPreferences=false; this.page="import-preview"; }
      else if(action==="import-apply") {
        this.data=await courseCommand("enroll",{courseId:result.imported.courseId,contentVersion:result.imported.contentVersion});
        this.page="modules";
        if(this.applyImportPreferences) {
          try {
            await importTutorPreferences(result.imported.preferences??{});
            this.host.editor=await configuredEditor(); this.host.editorDefaultSet=Boolean(this.host.editor);
            this.host.tutor=await configuredTutor();
          } catch(error) { this.error=`The course was imported. Preference setup needs attention: ${error instanceof Error?error.message:String(error)}`; }
        }
      } else {
        this.data = result;
        if (action === "enroll") this.page = "modules";
        if (action === "open") { this.page = "lesson"; this.pause(); }
        if (action === "task") { this.page = "task"; this.startWatch(cx); }
        if (action === "status" && this.page === "task") { this.startWatch(cx); if (result.stale) this.queueSave(cx); }
        if (["review-start", "review-next", "review-end"].includes(action)) {
          this.page = result.enrollment.activeTask ? "task" : "modules";
          if (this.page === "task") this.startWatch(cx); else this.pause();
        }
        if (result.pendingSave) this.pendingSave = true;
      }
      if (this.host.sync && !["list", "status", "source", "import-list", "import-preview"].includes(action)) this.host.pushSoon(cx);
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
  task() { return this.data?.course.lessons.flatMap(lesson => lesson.tasks).find(task => task.id === this.data.enrollment.activeTask); }

  helpRequest() {
    const position = this.data?.enrollment.position;
    if (!position || !["lesson", "task"].includes(this.page)) return null;
    const taskId = this.page === "task" ? this.data.enrollment.activeTask : null;
    const lesson = taskId ? this.data.course.lessons.find(lesson => lesson.tasks.some(task => task.id === taskId)) : this.lesson();
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
    if(this.page==="import-preview") this.page="imports";
    else if(this.page==="imports") this.page="catalog";
    else if (this.page === "source") this.page = this.sourceReturnPage;
    else if (this.data?.enrollment.review) this.run("review-end", {}, cx);
    else if (this.page === "task" && this.data?.enrollment.position) this.run("open", this.data.enrollment.position, cx);
    else if (this.page === "lesson" || this.page === "repo-lesson") { this.page = "modules"; this.pause(); }
    else if (this.page === "modules") { this.page = "catalog"; this.pause(); }
    else { this.pause(); this.host.screen = "topics"; }
    cx.notify();
  }

  /** @param {Theme} t */
  render(t) {
    const body = v_flex().id("course-body").flex_1().min_h(0).overflow_y_scroll().p(16).gap(12);
    if (this.busy) body.child(h_flex().gap(8).child(spinner(t)).child(div().child(this.busy)));
    if (this.generatingRepoLesson) body.child(keyButton(t,"cancel-repo-lesson","","Cancel generation",Boolean(this.host.tutorRequestId),cx=>this.host.cancelTutor(cx)));
    if (this.error) body.child(banner(t, this.error, t.blocked));
    if (this.page === "catalog") {
      body.child(div().font_semibold().child("Courses"))
        .child(div().text_color(t.muted).child("Learn with included examples. No repo or AI connection needed."))
        .child(keyButton(t,"course-import","","Import Tutor courses",!this.busy,cx=>this.run("import-list",{},cx)));
      for (const course of this.catalog) {
        const actions=h_flex().gap(8).flex_wrap()
          .child(keyButton(t, `course-beginner-${course.id}`, "", "Start or resume", !this.busy && !course.error, cx => this.run("enroll", { courseId: course.id, entryPath: "beginner" }, cx)));
        if(!course.imported) actions.child(keyButton(t, `course-experienced-${course.id}`, "", "I know another language", !this.busy && !course.error, cx => this.run("enroll", { courseId: course.id, entryPath: "experienced" }, cx)));
        body.child(v_flex().gap(8).child(div().font_semibold().child(course.title ?? course.id))
          .child(div().text_color(t.muted).child(course.error ?? `${course.preview ? "Preview · " : ""}${course.available} of ${course.total} modules available`))
          .child(actions));
        for (const version of (course.versions ?? []).filter(version => version !== course.enrolledVersion)) body.child(keyButton(t, `course-version-${course.id}-${version}`, "", `Resume ${version}`, !this.busy && !course.error,
          cx => this.run("enroll", { courseId: course.id, contentVersion: version }, cx)));
        if (course.enrolledVersion && course.enrolledVersion !== course.contentVersion) body.child(keyButton(t, `course-latest-${course.id}`, "", "Start latest version separately", !this.busy && !course.error,
          cx => this.run("enroll", { courseId: course.id, contentVersion: course.contentVersion }, cx)));
      }
    } else if(this.page==="imports") this.importList(body,t);
    else if(this.page==="import-preview") this.importReview(body,t);
    else if (this.data) {
      body.child(div().font_semibold().child(this.data.course.title));
      if (this.data.course.legacy) body.child(banner(t,"Imported Tutor course. Original lessons and historical results are preserved. Tutor's files remain unchanged."));
      else if (this.data.course.preview) body.child(banner(t, "Course preview. Lesson pacing still needs learner testing. You can explore available modules without completing their prerequisites."));
      if (this.page === "modules") this.modules(body, t);
      else if (this.page === "lesson") this.lessonView(body, t);
      else if (this.page === "repo-lesson") this.repoLessonView(body, t);
      else if (this.page === "source") this.sourceView(body, t);
      else if (this.page === "task") this.taskView(body, t);
      if (["lesson", "task"].includes(this.page) && this.host.tutor.enabled) body.child(tutorChat(t, {
        messages: this.host.tutorThreads[this.helpKey()] ?? [], busy: this.host.tutorBusy, error: this.host.tutorError,
        input: this.host.tutorInput, typing: this.host.typing, send: cx => this.host.askTutor(cx),
      }));
    }
    return v_flex().flex_1().min_h(0).child(body).child(paneBar(t)
      .child(keyButton(t, "course-back", "esc", ["imports","import-preview"].includes(this.page)?"Back":this.data?.enrollment.review ? "End review" : this.page === "task" ? "Return to lesson" : this.page === "catalog" ? "Back to practice" : "Back", !this.busy, cx => this.back(cx))));
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  importList(body,t) {
    body.child(sectionLabel(t,"Import Tutor courses"))
      .child(div().text_color(t.muted).child("Finds Tutor beside your Practice Range data folder by default. Preview one course before copying. Originals are never changed."))
      .child(textInput(t,this.importInput,this.host.typing))
      .child(keyButton(t,"scan-tutor","","Find courses",!this.busy,cx=>this.run("import-list",{},cx)));
    if(!this.imports.length) body.child(div().child("No Tutor courses found. Enter its data folder if it is stored elsewhere."));
    for(const course of this.imports) body.child(v_flex().gap(6)
      .child(div().font_semibold().child(course.title))
      .child(div().text_color(t.muted).child(course.error??`${course.languageId} · ${course.written}/${course.modules} modules written · ${course.answers} saved answers`))
      .child(keyButton(t,`preview-${course.slug}`,"","Preview import",!this.busy&&!course.error,cx=>this.run("import-preview",{slug:course.slug},cx))));
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  importReview(body,t) {
    const preview=this.importPreview;
    if(!preview) return;
    body.child(sectionLabel(t,preview.title))
      .child(div().child(`${preview.written} written modules, ${preview.questions} questions, ${preview.exercises} exercises, ${preview.answers} saved answers.`))
      .child(div().text_color(t.muted).child("Quiz scores and practice results remain historical evidence. Imported answers need a fresh start before recording independent success. Unmatched answers are kept in imported history."));
    if(preview.known?.length) body.child(div().child(`Known languages: ${preview.known.join(", ")}`));
    for(const warning of preview.warnings??[]) body.child(banner(t,warning));
    body.child(keyButton(t,"import-preferences","",`Use Tutor editor and AI settings: ${this.applyImportPreferences?"on":"off"}`,!this.busy,cx=>{this.applyImportPreferences=!this.applyImportPreferences;cx.notify();}))
      .child(div().text_size(12).text_color(t.muted).child("Optional. Copy only into missing settings. Existing editor and AI choices stay unchanged."))
      .child(keyButton(t,"apply-tutor-import","",preview.alreadyImported?"Open existing import":"Import this course",!this.busy,cx=>this.run("import-apply",{slug:preview.slug,fingerprint:preview.fingerprint},cx)));
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  modules(body, t) {
    const position = this.data.enrollment.position;
    const repo = this.data.attachment;
    body.child(sectionLabel(t, "Optional repo examples"));
    if (repo) body.child(div().text_color(t.muted).child(repo.available ? `${repo.name} · pinned at ${repo.commit.slice(0, 10)}` : repo.detail));
    body.child(div().text_size(12).text_color(t.muted).child("Attach a repo in this language for optional AI lessons and questions. Generation sends a bounded source sample to your configured model."))
      .child(textInput(t, this.repoInput, this.host.typing))
      .child(h_flex().gap(8).flex_wrap()
        .child(keyButton(t, "course-attach-repo", "", "Attach repo", !this.busy && Boolean(this.repoInput.value().trim()), cx => this.run("attach-repo", { path: this.repoInput.value() }, cx)))
        .child(keyButton(t, "course-detach-repo", "", "Detach", !this.busy && Boolean(repo), cx => this.run("detach-repo", {}, cx))));
    body.child(keyButton(t,"course-repo-architecture","","Explain repo architecture",!this.busy && Boolean(repo?.available) && this.host.tutor.enabled,cx=>this.generateRepoLesson(null,cx)));
    if (!this.host.tutor.enabled) body.child(div().text_size(12).text_color(t.muted).child("Enable the AI tutor in Setup to generate repo lessons."));
    if (this.data.repoLessons?.error) body.child(banner(t,this.data.repoLessons.error));
    for (const lesson of this.data.repoLessons?.lessons ?? []) body.child(keyButton(t,`repo-lesson-${lesson.id}`,"",`${lesson.title} · ${lesson.commit.slice(0,10)}`,!this.busy,cx=>{this.repoLessonId=lesson.id;this.page="repo-lesson";cx.notify();}));
    const next = this.data.recommendation;
    if (next) body.child(v_flex().gap(6).child(div().text_color(t.muted).child(next.reason))
      .child(keyButton(t, "course-recommendation", "", "Suggested next step", !this.busy && next.kind !== "practice", cx => {
        if (next.kind === "review") this.run("review-start", {}, cx);
        else if (next.kind === "task") this.run("task", { taskId: next.taskId }, cx);
        else this.run("open", { moduleId: next.moduleId, step: next.step }, cx);
      })));
    body.child(keyButton(t, "course-review", "", this.data.enrollment.review ? "Resume review" : `Review · ${this.data.reviewReady} ready`,
      !this.busy && (Boolean(this.data.enrollment.review) || this.data.reviewReady > 0), cx => this.run("review-start", {}, cx)));
    if (position) body.child(keyButton(t, "course-resume", "", "Continue lesson", !this.busy, cx => this.run("open", position, cx)));
    let previousPart="";
    for (const module of this.data.course.modules) {
      if(module.part && module.part!==previousPart) {
        const part=this.data.course.legacy?.parts.find(part=>part.id===module.part);
        if(part) body.child(sectionLabel(t,part.title));
        previousPart=module.part;
      }
      const seen = this.data.enrollment.modules[module.id]?.seen.length ?? 0;
      body.child(h_flex().gap(8).items_center().flex_wrap()
        .child(keyButton(t, module.id, "", module.title, !this.busy && module.status === "available", cx => this.run("open", { moduleId: module.id, step:this.data.enrollment.modules[module.id]?.resumeStep??0 }, cx)))
        .child(div().text_size(11).text_color(t.dim).child(module.status === "planned" ? "Planned" : this.data.enrollment.modules[module.id]?.skipped ? "Skipped" : `${seen} steps read`))
        .child(keyButton(t, `skip-${module.id}`, "", this.data.enrollment.modules[module.id]?.skipped ? "Include" : "Skip", !this.busy && module.status === "available", cx => this.run("skip", { moduleId: module.id }, cx))));
      const legacy=this.data.enrollment.legacy?.modules[module.id];
      if(legacy) body.child(div().text_size(11).text_color(t.muted).child(`${legacy.doneAt?"Completed in Tutor. ":""}${legacy.quiz?.best!==undefined?`Tutor quiz best: ${legacy.quiz.best}${legacy.quiz.passed?" · passed":""}`:""}`));
    }
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
        .child(markdown(`repo-code-${lesson.id}-${index}-${refIndex}`,`\`\`\`${this.data.course.codeFence??"text"}\n${ref.code}\n\`\`\``))
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

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  lessonView(body, t) {
    const lesson = this.lesson(), position = this.data.enrollment.position;
    if (!lesson || !position) return;
    body.child(keyButton(t,"course-repo-module","","Explain this topic using my repo",!this.busy && Boolean(this.data.attachment?.available) && this.host.tutor.enabled,cx=>this.generateRepoLesson(lesson.id,cx)));
    const step = lesson.steps[position.step];
    body.child(sectionLabel(t, `${lesson.title} · ${position.step + 1} of ${lesson.steps.length}`));
    if (position.step === 0 && lesson.intro !== step.text) body.child(markdown("course-intro", lesson.intro));
    body.child(div().font_semibold().child(step.title)).child(markdown("course-step", step.text));
    for (const id of [...(step.examples ?? []), ...(step.example ? [step.example] : [])]) {
      const example = lesson.examples[id];
      if(example.repoRef) body.child(div().text_size(11).text_color(t.muted).child(`${example.repoRef.path}:${example.repoRef.start}-${example.repoRef.end} · ${String(example.repoRef.commit??"").slice(0,10)}`))
        .child(keyButton(t,`course-source-${id}`,"","Read source file",!this.busy,cx=>this.run("source",{moduleId:lesson.id,exampleId:id},cx)));
      if(example.sourceError) body.child(banner(t,example.sourceError));
      body.child(markdown(`course-example-${id}`, `\`\`\`${this.data.course.codeFence??"typescript"}\n${example.code}\n\`\`\``));
      if(!example.readOnly) body.child(keyButton(t, `course-run-example-${id}`, "", "Run example", !this.busy, cx => this.run("example", { moduleId: lesson.id, exampleId: id }, cx)));
      const result = this.data.enrollment.modules[lesson.id]?.examples?.[id];
      if (result) {
        body.child(banner(t, result.title));
        for (const [index, detail] of result.details.entries()) body.child(markdown(`course-example-result-${id}-${index}`, `\`\`\`text\n${detail}\n\`\`\``));
      }
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
    for (const topic of [...new Set((lesson.drills ?? []).map(id => id.split("/")[0]))]) {
      body.child(keyButton(t, `course-drill-${topic}`, "", `Practice ${topic}`, !this.busy && !this.data.enrollment.review, cx => this.practiceTopic(topic, cx)));
    }
  }

  /** @param {import("gpui-kit").Element} body @param {Theme} t */
  taskView(body, t) {
    const task = this.task();
    if (!task) return;
    const progress = this.data.enrollment.tasks[task.id];
    if(progress.assistanceUnknown) body.child(banner(t,"This answer was imported. Earlier assistance is unknown. Use Start fresh before recording independent success."));
    if(progress.legacy) body.child(div().text_size(11).text_color(t.muted).child(`Tutor history: ${progress.legacy.runs??0} runs · ${progress.legacy.passed?"passed":"not passed"} · ${progress.legacy.hints??0} hints`));
    const review = this.data.enrollment.review;
    if (review) body.child(banner(t, `Review ${review.index + 1} of ${review.ids.length}. Fresh files. Your saved practice answers are preserved.`));
    body.child(sectionLabel(t, task.title)).child(markdown("course-task-prompt", task.prompt));
    if (task.workspace) body.child(div().text_color(t.muted).child(`Edit these files in the same folder: ${task.workspace.editable.map(entry => entry.file).join(", ")}. Saving either checks the whole project.`));
    for (const fixture of task.fixtures) if(fixture.declarations.trim()) body.child(markdown(`course-fixture-${fixture.id}`, `Case ${fixture.id}\n\n\`\`\`${this.data.course.codeFence??"typescript"}\n${fixture.declarations}\n\`\`\``));
    body.child(div().text_color(t.muted).child("Save your answer to check every case. Your answer must pass them all."))
      .when(!this.host.editor || this.host.offerEditorDefault, element => element.child(banner(t, "Choose and confirm your editor in Setup before opening this file.")))
      .child(div().text_size(11).text_color(t.dim).child(this.data.file))
      .child(h_flex().gap(8).flex_wrap()
        .child(keyButton(t, "course-editor", "o", "Open editor", !this.busy && !this.host.busy && Boolean(this.host.editor) && !this.host.offerEditorDefault, cx => this.host.openEditor(cx)))
        .child(keyButton(t, "course-check", "c", "Check saved answer", !this.busy, cx => this.run("check", { taskId: task.id }, cx)))
        .child(keyButton(t, "course-hint", "h", "Another hint", !this.busy && task.hints.length < (task.hintTotal??3), cx => this.run("hint", { taskId: task.id }, cx)))
        .child(keyButton(t, "course-answer", "", "Show solution", !this.busy && !task.solution, cx => this.run("answer", { taskId: task.id }, cx)))
        .child(keyButton(t, "course-reset", "", "Start fresh", !this.busy, cx => { this.confirmReset = true; cx.notify(); })));
    if (this.confirmReset) body.child(h_flex().gap(8).flex_wrap().child(div().child("Save editor changes first. The current file will be backed up. Reload it after resetting."))
      .child(keyButton(t, "course-reset-confirm", "", "Reset saved file", !this.busy, cx => { this.confirmReset = false; this.run("reset", { taskId: task.id }, cx); }))
      .child(keyButton(t, "course-reset-cancel", "", "Cancel", true, cx => { this.confirmReset = false; cx.notify(); })));
    for (const [index, hint] of task.hints.entries()) body.child(markdown(`course-hint-${index}`, hint));
    if (task.solution) {
      if (task.workspace) for (const file of task.workspace.editable) body.child(markdown(`course-solution-${file.file}`, `${file.file}\n\n\`\`\`${this.data.course.codeFence??"typescript"}\n${file.solution}\n\`\`\``));
      else body.child(markdown("course-solution", `\`\`\`${this.data.course.codeFence??"typescript"}\n${task.solution}\n\`\`\``));
    }
    if (progress.result) {
      body.child(banner(t, `${this.data.stale ? "Saved code changed. " : ""}${progress.result.title}${progress.result.assisted ? " · with help" : ""}`, !this.data.stale && progress.result.passed ? t.done : t.foreground));
      for (const [index, detail] of progress.result.details.entries()) body.child(markdown(`course-result-${index}`, detail));
      if (!progress.result.passed) body.child(markdown("course-feedback", task.feedback));
    }
    body.child(div().text_size(11).text_color(t.dim).child(`${progress.attempts} attempts · ${progress.independentPasses} independent passes`));
    if (review) body.child(keyButton(t, "course-review-next", "", review.index + 1 === review.ids.length ? "Finish review" : "Next review exercise", !this.busy, cx => this.run("review-next", {}, cx)));
  }
}
