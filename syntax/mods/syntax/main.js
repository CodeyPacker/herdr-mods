import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView, InputState, ScrollHandle } from "gpui-base";
import { run, nextCommand, panes, props, watchFolder, focused, checking, appHome } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { paneHeader, paneTitle, paneDetail, paneBar, tag, sectionLabel, banner } from "./kit/pane.js";
import { keyButton, spinner, textInput } from "./kit/controls.js";
import { listRow, rowText, listNote } from "./kit/list.js";
import { catalogFor } from "./catalog.js";
import { topicProgress, filteredTopics, visibleHints, savedExercise } from "./practice.js";
import { practiceCommand, appCommand, openVSCode, reuseNeovim, configuredEditor, saveEditorPreference, setupStatus, checkSetupRequirements, completeSetup, configuredTutor, saveTutorPreference, checkTutorProvider, askTutorQuestion, cancelTutorRequest } from "./bridge.js";
import { findPracticePane } from "./editor-pane.js";
import { defaultLanguage, findLanguage, languages } from "./languages/index.js";
import { setupPanel } from "./setup-panel.js";
import { languagePanel } from "./language-panel.js";
import { tutorSettings, tutorChat } from "./tutor/panel.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("./kit/theme.js").Theme} Theme */

/** @template T @param {string} key @param {T} fallback @returns {T} */
function saved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

/** @param {string} path */
function normalizePath(path) { return path.replaceAll("\\", "/"); }

/** Recent exercises per topic, per language. C# keeps reading the key it used before packs. @param {import("./languages/types.js").LanguagePack} language */
function savedRecent(language) {
  return saved(`recent-${language.id}`, language === defaultLanguage ? saved("recent", {}) : {});
}

export default class Syntax extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    this.handle = cx.focus_handle();
    /** @type {import("./types.js").Session | null} */
    this.state = null;
    /** @type {import("./languages/types.js").LanguagePack} */
    this.language = defaultLanguage;
    this.catalog = catalogFor(this.language);
    /** The pack chosen on the setup language page. */
    this.setupLanguage = defaultLanguage;
    /** @type {string[]} */
    this.enabledLanguages = [];
    this.busy = "";
    this.practicePending = false;
    this.error = "";
    this.screen = "setup";
    this.setupStep = 0;
    this.setupCompleted = false;
    /** @type {import("./types.js").SetupRequirements | null} */
    this.requirements = null;
    this.query = "";
    this.selected = 0;
    /** @type {string | null} */
    this.pickerTopicId = null;
    this.pickerScroll = ScrollHandle.new();
    this.revealSelection = true;
    this.typing = false;
    this.confirmRepeat = false;
    /** @type {Record<string, string>} */
    this.recent = savedRecent(this.language);
    /** @type {"neovim" | "vscode" | null} */
    this.editor = null;
    this.editorSettingsLoaded = false;
    this.editorDefaultSet = false;
    this.offerEditorDefault = false;
    /** @type {import("./tutor/config.js").TutorConfig} */
    this.tutor = { enabled: false, provider: null };
    this.tutorBusy = false;
    this.tutorSettingBusy = false;
    this.tutorError = "";
    this.tutorSettingsError = "";
    /** @type {Record<string, import("./tutor/panel.js").TutorMessage[]>} */
    this.tutorThreads = {};
    /** @type {string | null} */
    this.tutorRequestId = null;
    /** @type {import("herdr").FolderWatch | null} */
    this.tutorSettingsWatch = null;
    this.tutorWatchClosed = false;
    this.tutorInput = InputState.new({ placeholder: "Ask about your code…" });
    this.tutorInput.on("focus", () => { this.typing = true; });
    this.tutorInput.on("blur", () => { this.typing = false; });
    this.tutorInput.on("change", (_event, cx) => cx.notify());
    this.tutorInput.on("submit", (_event, cx) => this.askTutor(cx));
    /** @type {string | null} */
    this.panelPane = null;
    /** @type {string | null} */
    this.editorTerminal = null;
    /** @type {string | null} */
    this.server = null;
    this.automaticEditorStarted = false;
    this.laidOut = false;
    this.watching = false;
    /** @type {import("herdr").FolderWatch | null} */
    this.answerWatch = null;
    /** @type {{ languageId: string, exerciseId: string, sourceHash: string } | null} */
    this.pendingSaveCheck = null;
    this.saveCheckRunning = false;
    this.search = InputState.new({ placeholder: "Find a topic or syntax form…" });
    this.search.on("change", (_event, cx) => { this.query = this.search.value(); this.selected = 0; this.revealSelection = true; cx.notify(); });
    this.search.on("focus", () => { this.typing = true; });
    this.search.on("blur", () => { this.typing = false; });
    this.search.on("submit", (_event, cx) => { this.handle.focus(); cx.notify(); });
    this.handle.focus();
    if (checking()) return;
    this.loadSetup(cx);
    this.watchTutorPreferences(cx);
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        if (command === "focus") this.handle.focus();
        else this.action(command, cx);
        cx.notify();
      }
    });
  }

  tutorKey() { return this.state ? `${this.state.languageId}/${this.state.exerciseId}` : ""; }

  /** @param {Context} cx */
  close(cx) {
    this.cancelTutor(cx);
    this.answerWatch?.cancel();
    this.tutorWatchClosed = true;
    this.tutorSettingsWatch?.cancel();
  }

  /** Keep open copies in sync when AI is turned off in another tab or in the config. @param {Context} cx */
  watchTutorPreferences(cx) {
    const directory = appHome();
    cx.spawn(async cx => {
      while (!this.tutorWatchClosed) {
        let changed;
        try { this.tutorSettingsWatch = watchFolder(directory); changed = await this.tutorSettingsWatch; }
        catch { return; }
        if (this.tutorWatchClosed) return;
        if (!changed.some(path => [normalizePath(directory), normalizePath(`${directory}/syntax.json`)].includes(normalizePath(path)))) continue;
        try {
          const config = await configuredTutor();
          if (config.enabled !== this.tutor.enabled || config.provider !== this.tutor.provider) {
            this.cancelTutor(cx);
            this.tutorThreads = {};
            this.tutor = config;
          }
        } catch (error) {
          this.cancelTutor(cx);
          this.tutor = { enabled: false, provider: null };
          this.tutorSettingsError = error instanceof Error ? error.message : String(error);
        }
        cx.notify();
      }
    });
  }

  /** @param {Context} cx */
  cancelTutor(cx) {
    const id = this.tutorRequestId;
    this.tutorRequestId = null;
    this.tutorBusy = false;
    this.tutorError = "";
    if (id && !checking()) cx.spawn(async () => { try { await cancelTutorRequest(id); } catch {} });
  }

  /** @param {import("./tutor/config.js").TutorProvider | null} provider @param {Context} cx */
  changeTutor(provider, cx) {
    if (this.tutorSettingBusy) return;
    this.cancelTutor(cx);
    this.tutorSettingsError = "";
    this.tutorSettingBusy = true;
    if (!provider) { this.tutor = { enabled: false, provider: null }; this.tutorThreads = {}; }
    cx.notify();
    cx.spawn(async cx => {
      try {
        if (provider) await checkTutorProvider(provider);
        await saveTutorPreference(provider);
        this.tutor = { enabled: provider !== null, provider };
        this.tutorThreads = {};
        this.tutorInput.set_value("");
      } catch (error) {
        this.tutorSettingsError = error instanceof Error ? error.message : String(error);
        if (!provider) this.error = `AI is off in this tab, but its setting could not be saved: ${this.tutorSettingsError}`;
      }
      finally { this.tutorSettingBusy = false; cx.notify(); }
    });
  }

  /** @param {Context} cx */
  askTutor(cx) {
    if (!this.tutor.enabled || !this.tutor.provider || !this.state || this.screen !== "practice" || this.tutorBusy || this.tutorSettingBusy) return;
    const question = this.tutorInput.value().trim();
    if (!question) return;
    if (question.length > 4000) { this.tutorError = "Keep your question under 4,000 characters."; cx.notify(); return; }
    const key = this.tutorKey();
    const previous = this.tutorThreads[key] ?? [];
    const messages = previous.slice(-12).map(message => ({ ...message, content: message.content.slice(0, 4000) }));
    // Keep the CLI request small enough for command-line limits on supported editors' platforms.
    while (JSON.stringify(messages).length > 16000) messages.shift();
    const id = `question-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const request = { id, languageId: this.state.languageId, exerciseId: this.state.exerciseId, question, messages };
    this.tutorThreads[key] = [...previous, { role: "user", content: question }];
    this.tutorRequestId = id;
    this.tutorBusy = true;
    this.tutorError = "";
    this.tutorInput.set_value("");
    cx.notify();
    cx.spawn(async cx => {
      try {
        const { reply } = await askTutorQuestion(request);
        if (this.tutorRequestId === id && this.tutor.enabled) this.tutorThreads[key].push({ role: "assistant", content: reply });
      } catch (error) {
        if (this.tutorRequestId === id) {
          this.tutorError = error instanceof Error ? error.message : String(error);
          this.tutorThreads[key] = previous;
          this.tutorInput.set_value(question);
        }
      } finally {
        if (this.tutorRequestId === id) { this.tutorRequestId = null; this.tutorBusy = false; }
        cx.notify();
      }
    });
  }

  /** @param {Context} cx */
  loadSetup(cx) {
    if (this.busy) return;
    this.busy = "Loading setup…";
    this.error = "";
    cx.spawn(async cx => {
      try {
        this.editor = await configuredEditor();
        this.editorDefaultSet = Boolean(this.editor);
        this.editorSettingsLoaded = true;
        try { this.tutor = await configuredTutor(); }
        catch (error) {
          this.tutor = { enabled: false, provider: null };
          this.tutorSettingsError = error instanceof Error ? error.message : String(error);
        }
        const status = await setupStatus();
        this.setupCompleted = status.completed;
        this.enabledLanguages = status.enabled;
        this.useLanguage(findLanguage(status.languageId));
        this.setupLanguage = this.language;
        this.screen = this.setupCompleted ? "languages" : "setup";
      } catch (error) {
        this.error = `Could not load setup: ${error instanceof Error ? error.message : String(error)}. If node cannot start, install Node.js 20 or newer and restart Herdr.`;
      } finally { this.busy = ""; cx.notify(); }

    });
  }

  /** @param {string} action @param {Context} cx */
  setupAction(action, cx) {
    if (this.busy) return;
    if (action === "setup-change-editor" && this.setupStep === 3) {
      this.editor = null; this.editorDefaultSet = false; this.offerEditorDefault = false;
      cx.notify(); return;
    }
    if (action === "setup-back") { this.setupStep = Math.max(0, this.setupStep - 1); this.error = ""; cx.notify(); return; }
    if (action === "setup-next" && this.setupStep === 0) { this.setupStep = 1; cx.notify(); return; }
    if (action.startsWith("setup-language-") && this.setupStep === 1) {
      this.setupLanguage = findLanguage(action.slice("setup-language-".length));
      this.requirements = null; this.error = "";
      cx.notify(); return;
    }
    // An enabled pack needs no setup. Return to the language picker.
    if (action === "setup-next" && this.setupStep === 1 && this.setupCompleted && this.enabledLanguages.includes(this.setupLanguage.id)) {
      this.showLanguages(cx);
      return;
    }
    if (action === "setup-next" && this.setupStep === 2) {
      if (this.requirements?.node.ready && this.requirements?.language.ready) this.setupStep = 3;
      cx.notify(); return;
    }
    if (action === "setup-next" && this.setupStep === 3 && (!this.editor || this.offerEditorDefault)) return;
    if (action !== "setup-next" && action !== "setup-recheck") return;
    this.busy = this.setupStep === 4 ? "Finishing setup…" : "Checking requirements…";
    this.error = "";
    cx.notify();
    cx.spawn(async cx => {
      try {
        if (!this.editorSettingsLoaded) {
          this.editor = await configuredEditor();
          this.editorDefaultSet = Boolean(this.editor);
          this.editorSettingsLoaded = true;
        }
        if (this.setupStep === 4 && this.editor) {
          this.enabledLanguages = (await completeSetup(this.editor, this.setupLanguage.id)).enabled;
          this.setupCompleted = true;
          this.showLanguages(cx);
        } else {
          this.requirements = await checkSetupRequirements(this.setupStep === 3 ? this.editor : null, this.setupLanguage.id);
          if (this.setupStep === 1) this.setupStep = 2;
          else if (this.setupStep === 3 && this.requirements.editor.ready && this.requirements.node.ready && this.requirements.language.ready) this.setupStep = 4;
        }
      } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
      finally { this.busy = ""; cx.notify(); }
    });
  }

  /** Show another pack. Pending saves and editor state from the previous pack are dropped. @param {import("./languages/types.js").LanguagePack} language */
  useLanguage(language) {
    if (language === this.language) return;
    this.language = language;
    this.catalog = catalogFor(language);
    this.recent = savedRecent(language);
    this.pendingSaveCheck = null;
    this.pickerTopicId = null;
    this.automaticEditorStarted = false;
    this.answerWatch?.cancel();
  }

  /**
   * All actions serialize here. An error keeps the current file and exercise visible.
   * @param {string} action @param {string | null} value @param {Context} cx
   */
  perform(action, value, cx) {
    if (this.busy || this.practicePending) return;
    this.practicePending = true;
    const quiet = action === "hint" || action === "answer";
    const running = ["check", "check-saved"].includes(action) ? (this.state?.scratch ? `Running ${this.language.name}…` : `Checking ${this.language.name}…`) : "";
    this.busy = quiet ? "" : running || (action === "status" ? "Preparing practice…" : action === "scratch" ? "Opening scratch…" : "Updating…");
    this.error = "";
    if (!quiet) cx.notify();
    cx.spawn(async cx => {
      try {
        if (!this.editorSettingsLoaded) {
          this.editor = await configuredEditor();
          this.editorDefaultSet = Boolean(this.editor);
          this.editorSettingsLoaded = true;
        }
        const state = await practiceCommand(action, value);
        if (this.state && (this.state.languageId !== state.languageId || this.state.exerciseId !== state.exerciseId)) this.cancelTutor(cx);
        this.useLanguage(findLanguage(state.languageId));
        this.state = state;
        if (["select", "next", "repeat"].includes(action)) this.pendingSaveCheck = null;
        const exercise = this.catalog.findExercise(state.exerciseId);
        this.recent[exercise.topicId] = exercise.id;
        localStorage.setItem(`recent-${this.language.id}`, JSON.stringify(this.recent));
        if (action === "language") {
          this.screen = "topics";
          this.query = "";
          this.search.set_value("");
          this.pickerTopicId = null;
          this.selected = 0;
          this.revealSelection = true;
        } else if (action === "next" || action === "select") {
          this.screen = "practice";
          this.pickerTopicId = exercise.topicId;
          this.automaticEditorStarted = false;
        } else if (action === "scratch" || action === "practice") {
          // The editor follows the file switch: Neovim reuses its buffer list, VS Code opens on demand.
          this.screen = action;
          this.automaticEditorStarted = false;
        }
        if (!this.watching) this.watchAnswers(cx);
      } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
      finally { this.practicePending = false; this.busy = ""; cx.notify(); }
      this.startAutomaticEditor(cx);
    });
  }

  /** Check saves from either editor, including atomic file replacements. @param {Context} cx */
  watchAnswers(cx) {
    this.watching = true;
    cx.spawn(async cx => {
      for (;;) {
        // Each language has its own answers folder. Switching cancels the old watch.
        const directory = `${this.state.root}/answers`;
        let changed;
        try { this.answerWatch = watchFolder(directory); changed = await this.answerWatch; } catch { this.watching = false; return; }
        if (this.state && changed.some(path => normalizePath(path) === normalizePath(this.state.file) || normalizePath(path) === normalizePath(directory))) {
          this.checkSavedAnswer(cx);
        }
      }
    });
  }

  /** Coalesce save events and wait for an in-flight action without losing newer saves. @param {Context} cx */
  checkSavedAnswer(cx) {
    if (["setup", "languages"].includes(this.screen) || !this.state) return;
    if (this.state.scratch ? this.state.scratchResult : this.state.result) this.state.stale = true;
    this.pendingSaveCheck ??= { languageId: this.state.languageId, exerciseId: this.state.exerciseId, sourceHash: this.state.sourceHash };
    cx.notify();
    if (this.saveCheckRunning) return;
    this.saveCheckRunning = true;
    cx.spawn(async cx => {
      try {
        while (this.pendingSaveCheck) {
          await cx.sleep(250);
          if (this.busy || this.practicePending) continue;
          const pending = this.pendingSaveCheck;
          this.pendingSaveCheck = null;
          if (pending.languageId === this.state?.languageId && pending.exerciseId === this.state?.exerciseId) this.perform("check-saved", JSON.stringify(pending), cx);
        }
      } finally { this.saveCheckRunning = false; }
    });
  }

  /** @param {string} action @param {Context} cx */
  action(action, cx) {
    if (this.busy || this.practicePending) return;
    if (action === "setup") { this.screen = "setup"; this.setupStep = 0; this.setupLanguage = this.language; this.requirements = null; this.pendingSaveCheck = null; this.confirmRepeat = false; this.error = ""; cx.notify(); return; }
    if (action.startsWith("setup-")) { this.setupAction(action, cx); return; }
    if (action === "languages" && this.setupCompleted) { this.showLanguages(cx); return; }
    if (action.startsWith("choose-language-") && this.screen === "languages") { this.chooseLanguage(action.slice("choose-language-".length), cx); return; }
    if (this.screen === "languages") {
      if (action === "retry") this.loadSetup(cx);
      else if (action === "up" || action === "down") this.moveSelection(action === "down" ? 1 : -1, cx);
      return;
    }
    if (this.screen === "setup" && ["topics", "exercises", "up", "down"].includes(action)) return;
    if (action === "topics") { this.screen = "topics"; this.selected = 0; this.revealSelection = true; this.confirmRepeat = false; cx.notify(); return; }
    if (action === "exercises") {
      if (!this.pickerTopicId && this.screen !== "practice") return;
      this.pickerTopicId ??= this.state ? this.catalog.findExercise(this.state.exerciseId).topicId : null;
      this.screen = "exercises"; this.selected = 0; this.revealSelection = true; this.confirmRepeat = false; cx.notify(); return;
    }
    if (this.screen !== "practice" && (action === "up" || action === "down")) { this.moveSelection(action === "down" ? 1 : -1, cx); return; }
    if (action === "retry") { if (this.screen === "setup") this.loadSetup(cx); else this.perform("status", null, cx); return; }
    if (action === "choose-neovim") { this.chooseEditor("neovim", cx); return; }
    if (action === "choose-vscode") { this.chooseEditor("vscode", cx); return; }
    if (action === "save-editor-default") { this.saveEditorDefault(cx); return; }
    if (action === "skip-editor-default") { this.finishEditorChoice(cx); return; }
    if (action === "shuffle" && this.screen === "exercises") { this.shuffleExercise(cx); return; }
    if (this.screen === "scratch" && this.state) {
      if (action === "check") this.perform("check", null, cx);
      else if (action === "scratch" || action === "practice") this.perform("practice", null, cx);
      else if (action === "open") this.openEditor(cx);
      return;
    }
    if (action === "scratch" && this.state && ["practice", "topics", "exercises"].includes(this.screen)) {
      this.confirmRepeat = false;
      this.perform("scratch", null, cx);
      return;
    }
    if (this.screen !== "practice" || !this.state) return;
    if (action === "tutor" && this.tutor.enabled) {
      this.tutorInput.focus();
      cx.notify(); return;
    }
    if (action === "hint") { this.perform("hint", null, cx); return; }
    if (action === "answer") { this.perform("answer", null, cx); return; }
    if (action === "check") { this.perform("check", null, cx); return; }
    if (action === "repeat") { this.confirmRepeat = true; cx.notify(); return; }
    if (action === "confirm-repeat") {
      this.confirmRepeat = false;
      this.perform("repeat", null, cx);
      return;
    }
    if (action === "next") { this.perform("next", null, cx); return; }
    if (action === "open") this.openEditor(cx);
  }

  /** @param {"neovim" | "vscode"} editor @param {Context} cx */
  chooseEditor(editor, cx) {
    if (!this.editorSettingsLoaded || this.editor || this.busy) return;
    this.editor = editor;
    this.offerEditorDefault = true;
    cx.notify();
  }

  /** @param {Context} cx */
  saveEditorDefault(cx) {
    if (!this.editor || !this.offerEditorDefault || this.busy) return;
    const editor = this.editor;
    this.busy = "Saving editor preference…";
    this.error = "";
    cx.notify();
    cx.spawn(async cx => {
      try {
        await saveEditorPreference(editor);
        this.editorDefaultSet = true;
        this.offerEditorDefault = false;
      } catch (error) { this.error = `Could not save your default editor: ${error instanceof Error ? error.message : String(error)}`; }
      finally { this.busy = ""; cx.notify(); }
      this.startAutomaticEditor(cx);
    });
  }

  /** Use the choice for this tab without writing any configuration. @param {Context} cx */
  finishEditorChoice(cx) {
    if (!this.offerEditorDefault || this.busy) return;
    this.offerEditorDefault = false;
    this.error = "";
    cx.notify();
    this.startAutomaticEditor(cx);
  }

  /** @param {number} by @param {Context} cx */
  moveSelection(by, cx) {
    const count = this.screen === "languages" ? languages.length : this.items().length;
    this.selected = Math.max(0, Math.min(count - 1, this.selected + by));
    this.revealSelection = true;
    cx.notify();
  }

  /** Capture this view's pane only while it is actually laid out on screen. @param {Context} cx */
  bindPane(cx) {
    if (checking()) return;
    const panel = findPracticePane(panes(), this.panelPane, focused(), props()?.pane ?? null);
    if (!panel) return;
    if (!this.panelPane) {
      this.panelPane = panel.pane;
      /** @type {Record<string, { terminal: string, server: string }>} */
      const sessions = saved("editorSessions", {});
      const previous = sessions[panel.pane];
      if (previous) { this.editorTerminal = previous.terminal; this.server = previous.server; }
    }
    this.laidOut = true;
    this.startAutomaticEditor(cx);
  }

  /** @param {Context} cx */
  startAutomaticEditor(cx) {
    if (this.setupCompleted && ["practice", "scratch"].includes(this.screen) && this.laidOut && this.state && !this.busy && !this.practicePending && !this.error && !this.offerEditorDefault && props()?.practiceTab
        && !this.automaticEditorStarted && this.editor === "neovim") this.openEditor(cx);
  }

  /** The split always belongs to this panel, even if focus changes during an async action. */
  ownPane() {
    return panes().find(pane => pane.pane === this.panelPane);
  }

  /** @param {Context} cx */
  openEditor(cx) {
    if (["setup", "languages"].includes(this.screen) || !this.state || !this.editor || this.offerEditorDefault || this.busy || this.practicePending) return;
    if (!props()?.practiceTab) {
      run("tab.new", { name: "Practice Range", mod: "syntax", props: { practiceTab: true } });
      return;
    }
    const panel = this.ownPane();
    if (!panel) { this.error = "Could not find this practice tab. Reopen Practice Range from its shortcut."; cx.notify(); return; }
    const file = this.state.file;
    this.automaticEditorStarted = true;
    this.busy = `Opening ${this.editor === "neovim" ? "Neovim" : "VS Code"}…`;
    this.error = "";
    cx.notify();
    cx.spawn(async cx => {
      try {
        if (this.editor === "vscode") await openVSCode(this.state.folder, file);
        else {
          const existing = panes().find(pane => pane.terminal === this.editorTerminal && pane.tab === panel.tab);
          if (existing && this.server && await reuseNeovim(this.server, file)) {
            run("pane.focus", { pane: existing.pane });
          } else {
            // Loopback works on macOS, Linux, and Windows without socket path limits.
            const identifier = `syntax-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const server = props()?.serverDirectory ? `${props().serverDirectory}/${identifier}` : `127.0.0.1:${19000 + Math.floor(Math.random() * 30000)}`;
            // A new native split divides the sole practice pane equally. Target its ID
            // explicitly, so a changed keyboard focus cannot split another tab.
            const opened = await appCommand("pane.split", {
              pane: panel.pane, direction: "right", argv: ["nvim", "--listen", server, file],
            });
            this.server = server;
            this.editorTerminal = opened.terminal;
            /** @type {Record<string, { terminal: string, server: string }>} */
            const sessions = saved("editorSessions", {});
            sessions[panel.pane] = { terminal: this.editorTerminal, server: this.server };
            localStorage.setItem("editorSessions", JSON.stringify(sessions));
          }
        }
      } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
      finally { this.busy = ""; cx.notify(); }
    });
  }

  /** @param {Context} cx */
  showLanguages(cx) {
    this.cancelTutor(cx);
    this.screen = "languages";
    this.pendingSaveCheck = null;
    this.confirmRepeat = false;
    this.typing = false;
    this.error = "";
    this.selected = Math.max(0, languages.findIndex(language => language.id === this.language.id));
    this.handle.focus();
    cx.notify();
  }

  /** @param {string} id @param {Context} cx */
  chooseLanguage(id, cx) {
    if (this.busy || !this.setupCompleted) return;
    const language = findLanguage(id);
    if (this.enabledLanguages.includes(id)) this.perform("language", id, cx);
    else {
      this.setupLanguage = language;
      this.setupStep = 1;
      this.requirements = null;
      this.screen = "setup";
      cx.notify();
    }
  }

  /** @param {string} id @param {Context} cx */
  chooseTopic(id, cx) {
    if (this.busy || !this.catalog.topics.some(topic => topic.id === id)) return;
    this.pickerTopicId = id;
    this.screen = "exercises";
    this.selected = Math.max(0, this.catalog.topicExercises(id).findIndex(exercise => exercise.id === savedExercise(id, this.recent, this.catalog).id));
    this.revealSelection = true;
    cx.notify();
  }

  /** @param {string} id @param {Context} cx */
  selectExercise(id, cx) {
    this.cancelTutor(cx);
    this.confirmRepeat = false;
    this.perform("select", id, cx);
  }

  /** Open a different exercise from the topic currently being browsed. @param {Context} cx */
  shuffleExercise(cx) {
    if (this.busy || !this.state || this.screen !== "exercises") return;
    const items = this.items();
    const alternatives = items.filter(exercise => exercise.id !== this.state?.exerciseId);
    const choices = alternatives.length ? alternatives : items;
    const exercise = choices[Math.floor(Math.random() * choices.length)];
    if (exercise) this.selectExercise(exercise.id, cx);
  }

  items() {
    if (this.screen === "topics") return filteredTopics(this.query, this.catalog);
    return this.state ? this.catalog.topicExercises(this.pickerTopicId ?? this.catalog.findExercise(this.state.exerciseId).topicId) : [];
  }

  /** @param {import("gpui-kit").KeyEvent} event @param {Context} cx */
  key(event, cx) {
    if (this.typing) {
      if (event.key === "escape") { this.handle.focus(); cx.stop_propagation(); }
      return;
    }
    if (event.modifiers.control || event.modifiers.platform || event.modifiers.alt) return;
    const key = event.key;
    if (key === "s" && this.screen === "exercises") { this.action("shuffle", cx); cx.stop_propagation(); return; }
    if (key === "?") { this.action("setup", cx); cx.stop_propagation(); return; }
    if (this.screen === "setup") {
      if (key === "enter") this.setupAction("setup-next", cx);
      else if (key === "b") this.setupAction("setup-back", cx);
      else if (key === "v" && this.setupStep === 2) this.setupAction("setup-recheck", cx);
      else if (this.setupStep === 1 && languages[Number(key) - 1]) this.setupAction(`setup-language-${languages[Number(key) - 1].id}`, cx);
      else if (key === "g" && this.setupStep === 3) this.setupAction("setup-change-editor", cx);
      else if (this.setupStep === 3 && ["1", "2", "d", "x"].includes(key)) {
        this.action(key === "1" ? "choose-neovim" : key === "2" ? "choose-vscode" : key === "d" ? "save-editor-default" : "skip-editor-default", cx);
      } else if (key === "escape" && this.setupCompleted && !this.busy) {
        this.showLanguages(cx);
      }
      cx.stop_propagation(); return;
    }
    if (this.screen === "languages") {
      if (["j", "k", "up", "down"].includes(key)) this.moveSelection(["j", "down"].includes(key) ? 1 : -1, cx);
      else if (key === "enter" && languages[this.selected]) this.chooseLanguage(languages[this.selected].id, cx);
      else if (languages[Number(key) - 1]) this.chooseLanguage(languages[Number(key) - 1].id, cx);
      cx.stop_propagation(); return;
    }
    if (this.screen === "practice" && ((!this.editor && ["1", "2"].includes(key)) || (this.offerEditorDefault && ["d", "x"].includes(key)))) {
      this.action(key === "1" ? "choose-neovim" : key === "2" ? "choose-vscode" : key === "d" ? "save-editor-default" : "skip-editor-default", cx);
      cx.stop_propagation(); return;
    }
    if (key === "escape" && this.screen === "scratch") { this.action("practice", cx); cx.stop_propagation(); return; }
    if (key === "escape") {
      this.confirmRepeat = false;
      if (this.screen === "topics") this.showLanguages(cx);
      else if (this.screen === "exercises") { this.screen = "topics"; this.selected = 0; this.revealSelection = true; }
      else { this.screen = "topics"; this.selected = 0; this.revealSelection = true; }
      cx.notify(); cx.stop_propagation(); return;
    }
    if (this.confirmRepeat) {
      if (key === "enter") this.action("confirm-repeat", cx);
      cx.stop_propagation(); return;
    }
    if (!["practice", "scratch"].includes(this.screen) && ["j", "k", "up", "down", "enter"].includes(key)) {
      const items = this.items();
      if (key === "enter" && items[this.selected]) {
        const item = items[this.selected];
        if (this.screen === "topics") this.chooseTopic(item.id, cx);
        else this.selectExercise(item.id, cx);
      } else this.moveSelection(["j", "down"].includes(key) ? 1 : -1, cx);
      cx.stop_propagation(); cx.notify(); return;
    }
    /** @type {Record<string, string>} */
    const actions = { u: "tutor", l: "languages", h: "hint", a: "answer", c: "check", n: "next", r: "repeat", t: "topics", e: "exercises", o: "open", x: "scratch" };
    if (actions[key]) { this.action(actions[key], cx); cx.stop_propagation(); }
  }

  /** @param {string} id @param {string} text */
  markdown(id, text) {
    return TextView.markdown(id, text).selectable();
  }

  /** @param {Theme} t */
  editorControls(t) {
    if (!this.editor) return v_flex().gap(8)
      .child(div().text_size(12).text_color(t.muted).child("Choose an editor to get started."))
      .child(h_flex().gap(6).flex_wrap()
        .child(keyButton(t, "choose-neovim", "1", "Neovim", !this.busy, cx => this.action("choose-neovim", cx)))
        .child(keyButton(t, "choose-vscode", "2", "VS Code", !this.busy, cx => this.action("choose-vscode", cx))));
    const name = this.editor === "neovim" ? "Neovim" : "VS Code";
    return v_flex().gap(8)
      .child(h_flex().gap(6).flex_wrap()
        .child(tag(t, name))
        .when(this.screen !== "setup", element => element.child(keyButton(t, "open-editor", "o", "Open editor", !this.busy && !this.offerEditorDefault, cx => this.action("open", cx)))))
      .when(this.offerEditorDefault, element => element.child(v_flex().gap(8)
        .child(div().text_size(12).child(`Set ${name} as your default editor?`))
        .child(h_flex().gap(6).flex_wrap()
          .child(keyButton(t, "save-editor-default", "d", "Set default", !this.busy, cx => this.action("save-editor-default", cx)))
          .child(keyButton(t, "skip-editor-default", "x", "Just this tab", !this.busy, cx => this.action("skip-editor-default", cx))))));
  }

  /** @param {Theme} t @param {Context} cx */
  topicList(t, cx) {
    const items = this.items();
    const topic = this.catalog.topics.find(topic => topic.id === this.pickerTopicId);
    if (this.revealSelection && items.length) { this.pickerScroll.scroll_to_item(this.selected); this.revealSelection = false; }
    return v_flex().flex_1().min_h(0).gap(8).px(SIZE.panePad).py(12)
      .child(this.screen === "topics" ? textInput(t, this.search, this.typing) : h_flex().gap(8).items_center().flex_wrap()
        .child(div().flex_1().text_color(t.muted).child(`${topic?.title ?? "Exercises"} · Choose an exercise to practice.`))
        .child(keyButton(t, "shuffle-exercise", "s", "Shuffle", !this.busy && items.length > 0, cx => this.action("shuffle", cx))))
      .child(v_flex().id("syntax-picker").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.pickerScroll).gap(3)
        .when(items.length === 0, element => element.child(listNote(t, "No matching topics.")))
        .children(items.map((item, index) => {
          const isTopic = this.screen === "topics";
          const progress = isTopic ? topicProgress(this.state, item.id, this.catalog) : null;
          const current = isTopic ? this.state?.exerciseId?.startsWith(`${item.id}/`) : this.state?.exerciseId === item.id;
          const passed = !isTopic && this.state?.progress?.[item.id]?.passes > 0;
          return listRow(t, { id: `choose-${item.id}`, on: index === this.selected, tall: true,
            click: cx => { if (isTopic) this.chooseTopic(item.id, cx); else this.selectExercise(item.id, cx); } })
            .child(div().w(18).flex_none().text_color(current ? t.accent : passed ? t.done : t.dim).child(current ? "›" : passed ? "✓" : String(index + 1)))
            .child(rowText(t, item.title, "description" in item ? `${item.level === "advanced" ? "Advanced · " : ""}${item.description}` : item.prompt, true))
            .when(isTopic, element => element.child(tag(t, `${progress?.passed ?? 0}/${progress?.total ?? 0}`)));
        })))
      .child(div().text_size(11).text_color(t.dim).child("j/k move · enter choose · esc back"));
  }

  /** @param {Theme} t */
  practice(t) {
    if (!this.state) return v_flex().flex_1().p(18).gap(12)
      .child(div().font_semibold().child(`${this.language.name} syntax, one repetition at a time.`))
      .child(div().text_color(t.muted).child("Choose a topic. Write in your editor. Ask for a little more help whenever you need it."))
      .child(div().text_color(t.dim).child(`${this.catalog.topics.length} topics · ${this.catalog.exercises.length} exercises · local files`));
    const exercise = this.catalog.findExercise(this.state.exerciseId);
    const topic = this.catalog.topics.find(topic => topic.id === exercise.topicId);
    const items = this.catalog.topicExercises(exercise.topicId);
    const index = items.findIndex(item => item.id === exercise.id);
    const hints = visibleHints(exercise, this.state.hintCount);
    const result = this.state.result;
    return v_flex().id("syntax-practice").flex_1().min_h(0).overflow_y_scrollbar().px(SIZE.panePad).py(14).gap(12)
      .child(h_flex().gap(8).items_center().flex_wrap()
        .child(tag(t, this.language.name))
        .when(topic.level === "advanced", element => element.child(tag(t, "Advanced")))
        .child(div().text_size(12).text_color(t.muted).child(topic.title))
        .child(div().text_size(11).text_color(t.dim).child(`${index + 1} of ${items.length}`)))
      .child(div().text_size(20).font_semibold().child(exercise.title))
      .child(v_flex().p(12).rounded(8).bg(t.raised)
        .child(this.markdown(`prompt-${exercise.id}`, exercise.prompt)))
      .when(!this.editorDefaultSet, element => element.child(v_flex().p(12).gap(8).rounded(8).bg(t.raised)
        .child(div().text_size(12).font_semibold().child("Write in your editor"))
        .child(div().text_size(11).text_color(t.muted).child("Write your answer in the file. You can replace everything. Save to check automatically."))
        .child(this.markdown("exercise-path", `\`${this.state.file}\``))
        .child(this.editorControls(t))))
      .when(Boolean(exercise.declarations), element => element.child(this.markdown(`setup-${exercise.id}`, `${this.language.suppliedLabel ?? "Supplied types"}:\n\n\`\`\`${this.language.codeFence}\n${exercise.declarations}\n\`\`\``)))
      .child(h_flex().items_center().flex_wrap().gap(8)
        .child(keyButton(t, "more-hint", "h", "Hint", !this.busy && hints.length < exercise.hints.length, cx => this.action("hint", cx)))
        .child(div().text_size(12).text_color(t.muted).child(`${hints.length}/${exercise.hints.length}`)))
      .when(hints.length === 0, element => element.child(div().text_size(12).text_color(t.dim).child("Each press reveals a little more. The answer stays separate.")))
      .children(hints.map((hint, index) => v_flex().gap(6).p(10).rounded(8).bg(t.raised)
        .child(div().text_size(11).text_color(t.accent).child(`Hint ${index + 1}`))
        .child(this.markdown(`hint-${exercise.id}-${index}`, hint))))
      .when(this.state.answerShown, element => element.child(v_flex().gap(6)
        .child(sectionLabel(t, "One valid answer"))
        .child(this.markdown(`answer-${exercise.id}`, `\`\`\`${this.language.codeFence}\n${exercise.solution}\n\`\`\``))))
      .when(!this.state.answerShown, element => element.child(h_flex()
        .child(keyButton(t, "show-answer", "a", "Show answer", !this.busy, cx => this.action("answer", cx)))))
      .when(Boolean(result), element => element.child(v_flex().gap(7).p(12).rounded(8).bg(t.raised)
        .child(div().font_semibold().text_color(this.state.stale ? t.muted : result?.passed ? t.done : t.blocked).child(this.state.stale ? "Saved code changed. Check again." : result?.title ?? ""))
        .when(Boolean(result?.assisted), element => element.child(div().text_size(11).text_color(t.dim).child("Checked after viewing the answer.")))
        .children((result?.details ?? []).map((detail, index) => this.markdown(`result-${result?.at}-${index}`, `\`\`\`text\n${detail}\n\`\`\``)))))
      .when(this.tutor.enabled, element => element.child(v_flex().border_t_1().border_color(t.border).pt(12)
        .child(tutorChat(t, {
          messages: this.tutorThreads[this.tutorKey()] ?? [], busy: this.tutorBusy, error: this.tutorError,
          input: this.tutorInput, typing: this.typing, send: cx => this.askTutor(cx),
        }))));
  }

  /** Free-form code: save to run it. Nothing is checked. @param {Theme} t */
  scratch(t) {
    const result = this.state?.scratchResult;
    return v_flex().id("syntax-scratch").flex_1().min_h(0).overflow_y_scrollbar().px(SIZE.panePad).py(14).gap(12)
      .child(h_flex().gap(8).items_center().flex_wrap()
        .child(tag(t, this.language.name))
        .child(tag(t, "Scratch")))
      .child(div().text_size(20).font_semibold().child(`${this.language.name} scratch`))
      .child(div().text_color(t.muted).child(`Write anything in ${this.language.answerFile.replace("Exercise", "Scratch")} and save to run it. Nothing is checked, and runs don't count toward progress.`))
      .when(Boolean(this.language.scratchNote), element => element.child(div().text_size(12).text_color(t.muted).child(this.language.scratchNote ?? "")))
      .child(this.markdown("scratch-path", `\`${this.state?.file ?? ""}\``))
      .when(!this.editorDefaultSet, element => element.child(this.editorControls(t)))
      .when(!result, element => element.child(div().text_size(12).text_color(t.dim).child("Save the file to run it. Press c to run the saved file again.")))
      .when(Boolean(result), element => element.child(v_flex().gap(7).p(12).rounded(8).bg(t.raised)
        .child(div().font_semibold().text_color(this.state?.stale ? t.muted : result?.passed ? t.done : t.blocked).child(this.state?.stale ? "Saved code changed. Run it again." : result?.title ?? ""))
        .children((result?.details ?? []).map((detail, index) => this.markdown(`scratch-${result?.at}-${index}`, `\`\`\`text\n${detail}\n\`\`\``)))));
  }

  /** @param {Context} cx */
  render(cx) {
    const t = colors();
    return v_flex().id("syntax").size_full().min_w(0).min_h(0).bg(t.surface).text_color(t.foreground).text_size(13)
      .on_size_change((_size, cx) => this.bindPane(cx))
      .track_focus(this.handle).on_key_down((event, cx) => this.key(event, cx))
      .child(paneHeader(t).flex_wrap()
        .child(paneTitle(t, "Practice Range"))
        .child(paneDetail(t, this.screen === "setup" ? "Getting started" : this.screen === "languages" ? "Languages" : this.screen === "scratch" ? `${this.language.name} scratch` : `${this.language.name} repetition`))
        .child(keyButton(t, "choose-languages", "l", "Languages", !this.busy && this.setupCompleted, cx => this.action("languages", cx)))
        .child(keyButton(t, "open-setup", "?", "Setup", !this.busy, cx => this.action("setup", cx)))
        .child(keyButton(t, "choose-topics", "t", "Topics", !this.busy && !["setup", "languages"].includes(this.screen) && Boolean(this.state), cx => this.action("topics", cx)))
        .child(keyButton(t, "choose-exercises", "e", "Exercises", !this.busy && !["setup", "languages"].includes(this.screen) && Boolean(this.state) && (Boolean(this.pickerTopicId) || this.screen === "practice"), cx => this.action("exercises", cx)))
        .child(keyButton(t, "toggle-scratch", "x", this.screen === "scratch" ? "Back to exercise" : "Scratch", !this.busy && !["setup", "languages"].includes(this.screen) && Boolean(this.state), cx => this.action("scratch", cx))))
      .when(Boolean(this.error), element => element.child(v_flex().flex_none().px(SIZE.panePad).py(8).gap(8)
        .child(banner(t, this.error, t.blocked))
        .child(keyButton(t, "retry", "", "Retry", !this.busy, cx => this.action("retry", cx)))))
      .when(Boolean(this.busy), element => element.child(h_flex().flex_none().px(SIZE.panePad).py(8).gap(8).items_center()
        .child(spinner(t)).child(div().text_color(t.muted).child(this.busy))))
      .child(this.screen === "setup" ? setupPanel(t, { step: this.setupStep, busy: Boolean(this.busy), requirements: this.requirements,
        editor: this.editor, offerDefault: this.offerEditorDefault, language: this.setupLanguage, activeLanguageId: this.language.id,
        enabled: this.enabledLanguages, completed: this.setupCompleted, tutorContent: () => tutorSettings(t, { config: this.tutor, busy: this.tutorSettingBusy, error: this.tutorSettingsError, change: (provider, cx) => this.changeTutor(provider, cx) }), editorContent: () => this.editorControls(t), action: (action, cx) => this.action(action, cx) })
        : this.screen === "languages" ? languagePanel(t, { enabled: this.enabledLanguages, selected: this.selected, busy: Boolean(this.busy), choose: (id, cx) => this.chooseLanguage(id, cx) })
        : this.screen === "practice" ? this.practice(t) : this.screen === "scratch" ? this.scratch(t) : this.topicList(t, cx))
      .when(this.confirmRepeat, element => element.child(v_flex().flex_none().px(SIZE.panePad).py(10).gap(8)
        .child(banner(t, "Start this exercise fresh? The saved answer is backed up. Save any editor changes first, then reload the file in your editor."))
        .child(h_flex().gap(6)
          .child(keyButton(t, "confirm-repeat", "enter", "Start fresh", !this.busy, cx => this.action("confirm-repeat", cx)))
          .child(keyButton(t, "cancel-repeat", "esc", "Keep working", true, cx => { this.confirmRepeat = false; cx.notify(); })))))
      .when(this.screen === "scratch", element => element.child(paneBar(t)
        .when(this.editorDefaultSet, element => element.child(keyButton(t, "open-scratch-editor", "o", "Open editor", !this.busy && Boolean(this.state), cx => this.action("open", cx))))
        .child(keyButton(t, "run-scratch", "c", "Run saved code", !this.busy && Boolean(this.state), cx => this.action("check", cx)))
        .child(keyButton(t, "leave-scratch", "esc", "Back to exercise", !this.busy && Boolean(this.state), cx => this.action("practice", cx)))))
      .when(this.screen === "practice", element => element.child(paneBar(t)
        .when(this.tutor.enabled, element => element.child(keyButton(t, "ask-tutor", "u", "Ask tutor", !this.busy, cx => this.action("tutor", cx))))
        .when(this.editorDefaultSet, element => element.child(keyButton(t, "open-editor", "o", "Open editor", !this.busy && Boolean(this.state), cx => this.action("open", cx))))
        .child(keyButton(t, "check", "c", "Check saved code", !this.busy && Boolean(this.state), cx => this.action("check", cx)))
        .child(keyButton(t, "repeat", "r", "Repeat", !this.busy && Boolean(this.state), cx => this.action("repeat", cx)))
        .child(keyButton(t, "next", "n", "Another exercise", !this.busy && Boolean(this.state), cx => this.action("next", cx)))));
  }
}
