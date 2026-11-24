import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView, InputState, ScrollHandle } from "gpui-base";
import { run, nextCommand, panes, props, watchFolder, focused, checking, appHome, closeOverlay, shared, setShared, exec, window as appWindow } from "herdr";
import { togglePractice, reopenPractice, openPractice, liveEditor, DIALOG_KEY } from "./toggle.js";
import { colors, SIZE, paneBackground } from "./kit/theme.js";
import { paneHeader, paneTitle, paneDetail, paneBar, tag, sectionLabel, banner } from "./kit/pane.js";
import { keyButton, spinner, textInput } from "./kit/controls.js";
import { listRow, rowText, listNote } from "./kit/list.js";
import { catalogFor } from "./catalog.js";
import { topicProgress, filteredTopics, visibleHints, savedExercise } from "./practice.js";
import { practiceCommand, appCommand, openVSCode, openVSCodeDiff, neovimDiff, reuseNeovim, configuredEditor, saveEditorPreference, setupStatus, checkSetupRequirements, completeSetup, configuredTutor, saveTutorPreference, checkTutorProvider, askTutorQuestion, cancelTutorRequest, syncEnabled, syncProgress } from "./bridge.js";
import { findPracticePane, neovimDiffCommands, neovimDiffExpression } from "./editor-pane.js";
import { defaultLanguage, findLanguage, languages } from "./languages/index.js";
import { setupPanel } from "./setup-panel.js";
import { languagePanel } from "./language-panel.js";
import { tutorSettings, tutorChat } from "./tutor/panel.js";
import { startTopic } from "./start-topic.js";
import { Shortcuts } from "./kit/shortcuts.js";
import { closeTab, sharedStorage, openAsOption, onOpenAsChange } from "./kit/open-as.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("./kit/theme.js").Theme} Theme */

/**
 * The keys a user can turn off or change in the settings. Each id is the action its key runs,
 * and each key is the one the shortcut starts with. "?" cannot be changed. The keys that move
 * (j, k, arrows), enter, esc, "," and the keys that answer a setup or editor question always
 * work, and so does every button.
 * @type {import("./kit/shortcuts.js").Shortcut[]}
 */
const SHORTCUTS = [
  { id: "languages", key: "l", what: "languages" }, { id: "setup", key: "?", what: "setup", fixed: true },
  { id: "topics", key: "t", what: "topics" }, { id: "exercises", key: "e", what: "exercises" },
  { id: "scratch", key: "x", what: "scratch, and back" }, { id: "shuffle", key: "s", what: "shuffle, in the exercise list" },
  { id: "review", key: "v", what: "review, or end it" }, { id: "hint", key: "h", what: "hint" },
  { id: "answer", key: "a", what: "show answer" }, { id: "check", key: "c", what: "check or run saved code" },
  { id: "compare", key: "d", what: "compare with reference" }, { id: "send-to-scratch", key: "s", what: "send to scratch" },
  { id: "repeat", key: "r", what: "repeat" }, { id: "next", key: "n", what: "next exercise" },
  { id: "open", key: "o", what: "open editor" }, { id: "tutor", key: "u", what: "ask tutor" },
];

/** How Practice Range opens: as a tab, or as the dialog with Neovim beside it (toggle.js). */
const HOW = { name: "Practice Range", tab: { practiceTab: true }, dialog: () => openPractice() };

/** Esc in the dialog: the app would close it, so esc is this copy's own action in this key context. */
const ESC_CONTEXT = "PracticeRangeDialog";
const ESC_ACTION = "practice-range-escape";
/** Esc as an action and as a key within this many ms is one press. */
const ESC_GAP_MS = 150;
/** Device sync pushes this long after the last check, so a run of saves makes one commit. */
const SYNC_PUSH_DELAY_MS = 5000;

/** Where the last dialog was, to show it again on the next open. @returns {{ languageId: string, screen: string, pickerTopicId: string | null } | null} */
function savedSpot() {
  // Shared, not localStorage: each dialog is a new copy, with its own storage.
  const spot = /** @type {any} */ (shared("practice-range.spot"));
  return spot && typeof spot.languageId === "string" && typeof spot.screen === "string" ? spot : null;
}

/** Shared by every copy: each dialog and each tab is a new copy with its own localStorage. */
const store = sharedStorage("practice-range");

/** @template T @param {string} key @param {T} fallback @returns {T} */
function saved(key, fallback) {
  try { return JSON.parse(store.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

/** @param {string} path */
function normalizePath(path) {
  const slashed = path.replaceAll("\\", "/");
  // Windows: Herdr can report \\?\C:\... paths, and paths there ignore letter case.
  return appWindow()?.platform === "windows" ? slashed.replace(/^\/\/\?\//, "").toLowerCase() : slashed;
}

/** @param {import("./types.js").ReviewSummary} summary */
function reviewSummary(summary) {
  const parts = [`${summary.clean} of ${summary.total} remembered`];
  if (summary.retried) parts.push(`${summary.retried} after a retry or help`);
  if (summary.missed) parts.push(`${summary.missed} not passed`);
  return parts.join(" · ");
}

/** Recent exercises per topic, per language. C# keeps reading the key it used before packs. @param {import("./languages/types.js").LanguagePack} language */
function savedRecent(language) {
  return saved(`recent-${language.id}`, language === defaultLanguage ? saved("recent", {}) : {});
}

/**
 * The theme's green at low opacity, for a finished topic's row in light and dark themes.
 * @param {Theme} t @param {string} alpha two hex digits
 */
function lightGreen(t, alpha) {
  const green = String(t.ansi2 ?? "").slice(0, 7);
  return /** @type {any} */ (`${/^#[0-9a-f]{6}$/i.test(green) ? green : "#22c55e"}${alpha}`);
}

export default class Syntax extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    // Opened by the toggle key (`mod.open:practice-range`) as a tiny overlay: open or close the
    // full-window dialog (toggle.js), then close. Nothing else starts.
    const overlay = props()?.overlay;
    this.toggleOnly = Boolean(overlay) && !props()?.dialog;
    if (this.toggleOnly) {
      cx.spawn(async () => { try { await togglePractice(); } catch {} finally { closeOverlay(overlay); } });
      return;
    }
    /** Shown in the full-window dialog, with Neovim beside it (toggle.js). */
    this.dialog = Boolean(props()?.dialog);
    /** @type {{ languageId: string, screen: string, pickerTopicId: string | null } | null} where the last dialog was, until it is shown again */
    this.restoreSpot = null;
    /**
     * True while the dialog finds its way back to the last spot. The screens it passes through
     * (setup, languages, topics) are not drawn, so they don't flash. Ends after 10s at most.
     */
    this.restoring = this.dialog && !checking() && Boolean(savedSpot());
    /** @type {string} the action whose end finishes restoring */
    this.restoreEnd = "";
    if (this.restoring) cx.timer.after(10000, cx => { if (this.restoring) { this.restoring = false; cx.notify(); } });
    // In the dialog the app closes it on esc, so esc is bound to this copy's own action there.
    if (this.dialog) cx.bind_keys([{ keystroke: "escape", action: ESC_ACTION, context: ESC_CONTEXT }]);
    /** When esc was last handled, so one press is not handled twice (see escape()). */
    this.lastEscape = 0;
    /** @type {string} the last spot saved, so render writes only changes */
    this.lastSpot = "";
    // Neovim shown again in a new block keeps its old screen until something redraws it.
    // The block attaches a moment after the dialog opens, so redraw a few times as it settles.
    if (this.dialog && !checking()) cx.spawn(async cx => {
      for (const wait of [500, 1000, 1500, 3000]) {
        await cx.sleep(wait);
        const editor = liveEditor();
        if (editor) await exec("nvim", ["--server", editor.server, "--remote-expr", "execute('redraw!')"]).catch(() => {});
      }
    });
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
    /** Device sync (sync.mjs), on only when practice-range.json has "sync": true. */
    this.sync = false;
    /** Why the last pull or push failed. Practice still works, so this does not block anything. */
    this.syncError = "";
    /** Each check bumps this. A waiting push runs only if no newer check came after it. */
    this.syncPushTurn = 0;
    /** True while a push after a check runs, so two never use git at once. */
    this.syncPushing = false;
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
    /** Shows the summary of a review that just ended, until the next action. */
    this.showReviewSummary = false;
    /** Shown in the result after comparing, when the answers only differ in formatting. */
    this.compareNote = "";
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
    /** @type {string | null} the topic another mod asked to open, until its language loads */
    this.pendingTopic = null;
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
    /** The settings panel: a switch per shortcut key. Opening it takes the keyboard out of a text box. */
    // Saved in shared state: every dialog and every tab is a new copy with its own localStorage.
    this.shortcuts = new Shortcuts({
      mod: "practice-range", keys: SHORTCUTS, rebind: true, storage: sharedStorage("practice-range"),
      options: [openAsOption("practice-range")],
      onOpen: () => this.handle.focus(),
      onChange: (id, on) => onOpenAsChange("practice-range", id, on, HOW),
    });
    this.handle.focus();
    if (checking()) return;
    // A new tab's pane isn't drawn yet, so the focus above is lost. Focus again once it is.
    cx.timer.after(50, () => { if (!this.typing) this.handle.focus(); });
    cx.timer.after(400, () => { if (!this.typing) this.handle.focus(); });
    this.loadSetup(cx);
    this.watchTutorPreferences(cx);
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        if (command === "focus") this.handle.focus();
        else if (this.shortcuts.command(command)) { /* the settings panel took it */ }
        else this.action(command, cx);
        cx.notify();
      }
    });
  }

  tutorKey() { return this.state ? `${this.state.languageId}/${this.state.exerciseId}` : ""; }

  /**
   * The background. In a tab over a background picture with see-through terminals, it matches
   * the terminals (kit/theme.js). Otherwise, and in the dialog, the surface color as always.
   * @param {Theme} t
   */
  background(t) {
    return this.dialog ? t.surface : paneBackground(t.surface);
  }

  /** @param {Context} cx */
  close(cx) {
    if (this.toggleOnly) return;
    if (this.dialog) {
      this.saveSpot();
      if (shared(DIALOG_KEY) === props()?.overlay) setShared(DIALOG_KEY, null);
    }
    this.cancelTutor(cx);
    // Not awaited: the dialog closes now and git finishes on its own.
    if (this.sync) syncProgress("push");
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
        if (!changed.some(path => [normalizePath(directory), normalizePath(`${directory}/practice-range.json`)].includes(normalizePath(path)))) continue;
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
    /** @type {{ languageId: string, topicId: string } | null} */
    let start = null;
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
        // Pull before the session loads, so the next save can't overwrite the pulled progress.
        try { this.sync = await syncEnabled(); }
        catch (error) { this.syncError = error instanceof Error ? error.message : String(error); }
        if (this.sync) {
          this.busy = "Syncing progress…";
          cx.notify();
          const failed = await syncProgress("pull");
          if (failed) this.syncError = `Device sync could not pull: ${failed}`;
          this.busy = "Loading setup…";
        }
        const status = await setupStatus();
        start = startTopic(props()?.startTopic, status);
        this.setupCompleted = status.completed;
        this.enabledLanguages = status.enabled;
        this.useLanguage(findLanguage(status.languageId));
        this.setupLanguage = this.language;
        this.screen = this.setupCompleted ? "languages" : "setup";
      } catch (error) {
        this.error = `Could not load setup: ${error instanceof Error ? error.message : String(error)}. If node cannot start, install Node.js 20 or newer and restart Herdr.`;
      } finally { this.busy = ""; cx.notify(); }
      // Opened by another mod at a topic: switch to its language, then show the topic's exercises.
      if (start && !this.error) { this.pendingTopic = start.topicId; this.perform("language", start.languageId, cx); }
      else if (this.dialog && !this.error && this.setupCompleted) {
        // Back where the last dialog was: its language, then its screen (see perform).
        const spot = savedSpot();
        if (spot && this.enabledLanguages.includes(spot.languageId)) { this.restoreSpot = spot; this.perform("language", spot.languageId, cx); }
      }
      if (!this.restoreSpot && this.restoring) { this.restoring = false; cx.notify(); }

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
    this.compareNote = "";
    /** @type {{ answerFile: string, referenceFile: string } | null} */
    let diff = null;
    const quiet = action === "hint" || action === "answer";
    const running = ["check", "check-saved"].includes(action) ? (this.state?.scratch ? `Running ${this.language.name}…` : `Checking ${this.language.name}…`) : "";
    this.busy = quiet ? "" : running || (action === "status" ? "Preparing practice…" : action === "scratch" ? "Opening scratch…"
      : action === "send-to-scratch" ? `Running ${this.language.name}…` : action === "review-start" ? "Choosing review exercises…" : "Updating…");
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
        const reviewEnded = Boolean(this.state?.review) && !state.review && Boolean(state.lastReview);
        this.showReviewSummary = reviewEnded || (this.showReviewSummary && ["status", "check-saved"].includes(action));
        this.useLanguage(findLanguage(state.languageId));
        this.state = state;
        if (["select", "next", "repeat", "review-start", "review-end"].includes(action)) this.pendingSaveCheck = null;
        const exercise = this.catalog.findExercise(state.exerciseId);
        // Review jumps around the catalog. Only your own path updates where each topic resumes.
        if (!state.review) {
          this.recent[exercise.topicId] = exercise.id;
          store.setItem(`recent-${this.language.id}`, JSON.stringify(this.recent));
        }
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
        } else if (["review-start", "review-end"].includes(action) || reviewEnded) {
          this.screen = "practice";
          this.pickerTopicId = exercise.topicId;
          this.automaticEditorStarted = false;
        } else if (action === "send-to-scratch") {
          this.screen = "scratch";
          this.automaticEditorStarted = false;
        } else if (action === "scratch" || action === "practice") {
          // The editor follows the file switch: Neovim reuses its buffer list, VS Code opens on demand.
          this.screen = action;
          this.automaticEditorStarted = false;
        }
        if (action === "compare" && state.compare) {
          if (state.compare.same) this.compareNote = "Same as the reference answer, apart from formatting and comments.";
          else {
            diff = state.compare;
            if (this.editor === "neovim") this.compareNote = "Opened in a new Neovim tab: yours on the left, the reference on the right. It closes when you move on.";
          }
        }
        if (!this.watching) this.watchAnswers(cx);
        if (this.sync && !state.scratch && ["check", "check-saved"].includes(action)) this.pushSoon(cx);
      } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
      finally { this.practicePending = false; this.busy = ""; cx.notify(); }
      // Restoring ends with its last step, or at once when a step failed.
      if (this.restoring && (this.error || action === this.restoreEnd)) { this.restoring = false; cx.notify(); }
      if (diff) this.openEditor(cx, diff);
      else this.startAutomaticEditor(cx);
      if (action === "language" && this.restoreSpot) {
        const spot = this.restoreSpot;
        this.restoreSpot = null;
        if (!this.error && this.state && (spot.screen === "practice" || spot.screen === "scratch")) { this.restoreEnd = spot.screen; this.perform(spot.screen, null, cx); }
        else {
          if (!this.error && this.state && spot.screen === "exercises" && spot.pickerTopicId) { this.pickerTopicId = spot.pickerTopicId; this.screen = "exercises"; this.selected = 0; this.revealSelection = true; }
          this.restoring = false;
          cx.notify();
        }
      }
      if (action === "language" && this.pendingTopic) {
        const topic = this.pendingTopic;
        this.pendingTopic = null;
        if (!this.error && this.screen === "topics") this.chooseTopic(topic, cx);
      }
    });
  }

  /**
   * Push progress a few seconds after a check, so another computer sees it even while this
   * tab stays open. A failed push shows in the panel. Closing still pushes as well.
   * @param {Context} cx
   */
  pushSoon(cx) {
    const turn = ++this.syncPushTurn;
    cx.spawn(async cx => {
      await cx.sleep(SYNC_PUSH_DELAY_MS);
      while (this.syncPushing) await cx.sleep(500);
      if (turn !== this.syncPushTurn || this.tutorWatchClosed) return;
      this.syncPushing = true;
      try {
        const failed = await syncProgress("push");
        this.syncError = failed ? `Device sync could not push: ${failed}` : "";
      } finally { this.syncPushing = false; }
      cx.notify();
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
    if (action === "review" && this.state && ["practice", "topics", "exercises"].includes(this.screen)) {
      // Resuming needs no command: the session already points at the review exercise.
      if (this.state.review) { this.screen = "practice"; this.automaticEditorStarted = false; cx.notify(); this.startAutomaticEditor(cx); }
      else if (this.state.reviewReady) this.perform("review-start", null, cx);
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
    if (action === "send-to-scratch") { this.perform("send-to-scratch", null, cx); return; }
    if (action === "compare" && this.state.result?.passed && !this.state.stale) { this.perform("compare", null, cx); return; }
    if (action === "review-end" && this.state.review) { this.perform("review-end", null, cx); return; }
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
    if (this.setupCompleted && ["practice", "scratch"].includes(this.screen) && (this.laidOut || this.dialog) && this.state && !this.busy && !this.practicePending && !this.error && !this.offerEditorDefault && (props()?.practiceTab || this.dialog)
        && !this.automaticEditorStarted && this.editor === "neovim") this.openEditor(cx);
  }

  /** The split always belongs to this panel, even if focus changes during an async action. */
  ownPane() {
    return panes().find(pane => pane.pane === this.panelPane);
  }

  /**
   * Open the current file, or with `diff`, your answer beside the read-only reference in the
   * editor's own diff view (a new Neovim tab, or VS Code's diff editor).
   * @param {Context} cx @param {{ answerFile: string, referenceFile: string } | null} [diff]
   */
  openEditor(cx, diff = null) {
    if (["setup", "languages"].includes(this.screen) || !this.state || !this.editor || this.offerEditorDefault || this.busy || this.practicePending) return;
    if (this.dialog) { this.openInDialog(cx, diff); return; }
    if (!props()?.practiceTab) {
      run("tab.new", { name: "Practice Range", mod: "practice-range", props: { practiceTab: true } });
      return;
    }
    const panel = this.ownPane();
    if (!panel) { this.error = "Could not find this practice tab. Reopen Practice Range from its shortcut."; cx.notify(); return; }
    const file = this.state.file;
    this.automaticEditorStarted = true;
    this.busy = `${diff ? "Comparing in" : "Opening"} ${this.editor === "neovim" ? "Neovim" : "VS Code"}…`;
    this.error = "";
    cx.notify();
    cx.spawn(async cx => {
      try {
        if (this.editor === "vscode") await (diff ? openVSCodeDiff(diff.answerFile, diff.referenceFile) : openVSCode(this.state.folder, file));
        else {
          const existing = panes().find(pane => pane.terminal === this.editorTerminal && pane.tab === panel.tab);
          const reused = existing && this.server && await (diff ? neovimDiff(this.server, neovimDiffExpression(diff.answerFile, diff.referenceFile)) : reuseNeovim(this.server, file));
          if (reused) {
            run("pane.focus", { pane: existing.pane });
          } else {
            // Loopback works on macOS, Linux, and Windows without socket path limits.
            const identifier = `syntax-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const server = props()?.serverDirectory ? `${props().serverDirectory}/${identifier}` : `127.0.0.1:${19000 + Math.floor(Math.random() * 30000)}`;
            // A new native split divides the sole practice pane equally. Target its ID
            // explicitly, so a changed keyboard focus cannot split another tab.
            const opened = await appCommand("pane.split", {
              pane: panel.pane, direction: "right",
              argv: ["nvim", "--listen", server, file, ...(diff ? neovimDiffCommands(diff.answerFile, diff.referenceFile).flatMap(command => ["-c", command]) : [])],
            });
            this.server = server;
            this.editorTerminal = opened.terminal;
            /** @type {Record<string, { terminal: string, server: string }>} */
            const sessions = saved("editorSessions", {});
            sessions[panel.pane] = { terminal: this.editorTerminal, server: this.server };
            store.setItem("editorSessions", JSON.stringify(sessions));
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

  /** Remembers the language and screen, so the next dialog opens here. Setup is not kept. */
  saveSpot() {
    if (!this.setupCompleted || this.restoreSpot || this.screen === "setup" || this.screen === "languages") return;
    const spot = JSON.stringify({ languageId: this.language.id, screen: this.screen, pickerTopicId: this.pickerTopicId });
    if (spot === this.lastSpot) return;
    this.lastSpot = spot;
    setShared("practice-range.spot", JSON.parse(spot));
  }

  /** Esc in the dialog, from its key context: what esc does everywhere else. @param {Context} cx */
  escape(cx) {
    // One press can arrive both here and as a key: the second within ESC_GAP_MS is the same press.
    if (Date.now() - this.lastEscape < ESC_GAP_MS) return;
    this.lastEscape = Date.now();
    // The settings panel first: esc stops waiting for a new key, else closes the panel.
    if (this.shortcuts.open) { this.shortcuts.back(); cx.notify(); return; }
    this.key(/** @type {any} */ ({ key: "escape", keystroke: "escape", modifiers: {}, fromAction: true }), cx);
  }

  /**
   * Opens the file in the dialog's Neovim, or VS Code. When Neovim is not running, the dialog
   * opens again with a new one beside it, back on this screen.
   * @param {Context} cx @param {{ answerFile: string, referenceFile: string } | null} diff
   */
  openInDialog(cx, diff) {
    if (!this.state || !this.editor) return;
    const file = this.state.file;
    const editor = this.editor === "neovim" ? liveEditor() : null;
    this.automaticEditorStarted = true;
    if (this.editor === "neovim" && !editor) {
      this.saveSpot();
      reopenPractice().catch(error => { this.error = error instanceof Error ? error.message : String(error); cx.notify(); });
      return;
    }
    this.busy = `${diff ? "Comparing in" : "Opening"} ${this.editor === "neovim" ? "Neovim" : "VS Code"}…`;
    this.error = "";
    cx.notify();
    cx.spawn(async cx => {
      try {
        if (this.editor === "vscode") await (diff ? openVSCodeDiff(diff.answerFile, diff.referenceFile) : openVSCode(this.state.folder, file));
        else if (editor) {
          const shown = await (diff ? neovimDiff(editor.server, neovimDiffExpression(diff.answerFile, diff.referenceFile)) : reuseNeovim(editor.server, file));
          if (!shown) this.error = "Neovim beside Practice Range did not answer. Close it (:qa) and press the toggle key twice to start a new one.";
        }
      } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
      finally { this.busy = ""; cx.notify(); }
    });
  }

  /** @param {import("gpui-kit").KeyEvent} event @param {Context} cx */
  key(event, cx) {
    // In the dialog, esc comes through escape() (its key context), so the app does not close it.
    // The settings panel takes esc from either path (see escape()).
    if (this.dialog && event.key === "escape" && !(/** @type {any} */ (event).fromAction)) {
      if (this.shortcuts.open) { this.escape(cx); cx.stop_propagation(); }
      return;
    }
    // While the settings panel is open, every key is its own.
    if (this.shortcuts.open) { this.shortcuts.key(event, cx); return; }
    // ctrl-x in the Practice Range tab closes it and goes back to the tab you came from.
    if (event.keystroke === "ctrl-x" && props()?.practiceTab) { closeTab("practice-range"); cx.stop_propagation(); return; }
    if (this.typing) {
      if (event.key === "escape") { this.handle.focus(); cx.stop_propagation(); }
      return;
    }
    // With ctrl, alt or cmd held, a press is ours only when the user put a shortcut on it.
    const held = event.modifiers.control || event.modifiers.platform || event.modifiers.alt;
    if (held && !this.shortcutFor(event.keystroke)) return;
    if (this.shortcuts.key(event, cx)) return;
    // The keys that are not shortcuts are plain keys.
    const key = held ? "" : event.key;
    if (this.screen === "exercises" && this.shortcuts.matches("shuffle", event.keystroke)) {
      this.action("shuffle", cx); cx.stop_propagation(); return;
    }
    if (key === "?" && !this.shortcuts.isOff("setup")) { this.action("setup", cx); cx.stop_propagation(); return; }
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
    // The settings say which key each shortcut is on. A key that is turned off, or that its
    // shortcut was moved away from, does nothing. A key the user gave to a shortcut wins over
    // the keys that move in a list. One switch and one key start and end a review.
    const id = this.shortcutFor(event.keystroke);
    if (id) {
      this.action(id === "review" && this.screen === "practice" && this.state?.review ? "review-end" : id, cx);
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
  }

  /**
   * The shortcut a key press means on this screen, or "" when it is none that is on. The setup
   * and language screens have no shortcuts but "?". The exercise list has shuffle where the
   * other screens have send to scratch: both start on "s".
   * @param {string} keystroke as the event spells it
   */
  shortcutFor(keystroke) {
    if (["setup", "languages"].includes(this.screen)) return "";
    const other = this.screen === "exercises" ? "send-to-scratch" : "shuffle";
    return SHORTCUTS.find(s => !s.fixed && s.id !== other && this.shortcuts.matches(s.id, keystroke))?.id ?? "";
  }

  /** The key shown on a button: the one the shortcut is on now, or nothing when the user turned it off. @param {string} id a SHORTCUTS id @param {string} key shown for "?", which cannot be changed */
  shown(id, key) {
    return this.shortcuts.shown(id, key);
  }

  /** The key to name in a sentence: the one the shortcut is on now, or "" when it is off or has none. @param {string} id a SHORTCUTS id */
  keyOf(id) {
    return this.shortcuts.isOff(id) ? "" : this.shortcuts.keyFor(id);
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
        .when(this.screen !== "setup", element => element.child(keyButton(t, "open-editor", this.shown("open", "o"), "Open editor", !this.busy && !this.offerEditorDefault, cx => this.action("open", cx)))))
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
      .when(this.screen === "topics" && Boolean(this.state), element => element.child(this.reviewEntry(t)))
      .child(this.screen === "topics" ? textInput(t, this.search, this.typing) : h_flex().gap(8).items_center().flex_wrap()
        .child(div().flex_1().text_color(t.muted).child(`${topic?.title ?? "Exercises"} · Choose an exercise to practice.`))
        .child(keyButton(t, "shuffle-exercise", this.shown("shuffle", "s"), "Shuffle", !this.busy && items.length > 0, cx => this.action("shuffle", cx))))
      .child(v_flex().id("syntax-picker").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.pickerScroll).gap(3)
        .when(items.length === 0, element => element.child(listNote(t, "No matching topics.")))
        .children(items.map((item, index) => {
          const isTopic = this.screen === "topics";
          const progress = isTopic ? topicProgress(this.state, item.id, this.catalog) : null;
          const current = isTopic ? this.state?.exerciseId?.startsWith(`${item.id}/`) : this.state?.exerciseId === item.id;
          const passed = !isTopic && this.state?.progress?.[item.id]?.passes > 0;
          // A finished topic (every exercise passed) gets a light green row. The selected row keeps its own color.
          const finished = isTopic && Boolean(progress?.total) && progress?.passed === progress?.total;
          return listRow(t, { id: `choose-${item.id}`, on: index === this.selected, tall: true,
            click: cx => { if (isTopic) this.chooseTopic(item.id, cx); else this.selectExercise(item.id, cx); } })
            .when(finished && index !== this.selected, element => element.bg(lightGreen(t, "26")).hover(style => style.bg(lightGreen(t, "40"))))
            .child(div().w(18).flex_none().text_color(current ? t.accent : passed ? t.done : t.dim).child(current ? "›" : passed ? "✓" : String(index + 1)))
            .child(rowText(t, item.title, "description" in item ? `${item.level === "advanced" ? "Advanced · " : ""}${item.description}` : item.prompt, true))
            .when(isTopic, element => element.child(tag(t, `${progress?.passed ?? 0}/${progress?.total ?? 0}`)));
        })))
      .child(div().text_size(11).text_color(t.dim).child("j/k move · enter choose · , settings · esc back"));
  }

  /** Opt-in review, offered only here: a count of what's ready, or the review in progress. @param {Theme} t */
  reviewEntry(t) {
    const review = this.state?.review;
    const ready = this.state?.reviewReady ?? 0;
    const label = review ? `Resume review · ${review.index + 1} of ${review.ids.length}` : ready ? `Review · ${ready} ready` : "Review · nothing ready yet";
    return v_flex().gap(4)
      .child(h_flex().gap(8).items_center().flex_wrap()
        .child(keyButton(t, "start-review", this.shown("review", "v"), label, !this.busy && (Boolean(review) || ready > 0), cx => this.action("review", cx)))
        .child(div().text_size(11).text_color(t.dim).child(review ? "Fresh files. Your saved answers stay untouched." : "Up to 8 exercises from topics you've practiced, from a blank file.")))
      .when(!review && Boolean(this.state?.lastReview), element => element.child(div().text_size(11).text_color(t.muted).child(`Last review: ${reviewSummary(this.state.lastReview)}`)));
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
        .when(Boolean(this.state.review), element => element.child(tag(t, `Review ${(this.state.review?.index ?? 0) + 1} of ${this.state.review?.ids.length ?? 0}`)))
        .when(topic.level === "advanced", element => element.child(tag(t, "Advanced")))
        .child(div().text_size(12).text_color(t.muted).child(topic.title))
        .when(!this.state.review, element => element.child(div().text_size(11).text_color(t.dim).child(`${index + 1} of ${items.length}`))))
      .when(this.showReviewSummary && Boolean(this.state.lastReview), element => element.child(banner(t, `Review finished: ${reviewSummary(this.state.lastReview)}. Back where you left off.`)))
      .when(Boolean(this.state.review), element => element.child(div().text_size(12).text_color(t.muted).child("Review: write it from memory in a blank file. Your earlier answer is hidden and kept as it was.")))
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
        .child(keyButton(t, "more-hint", this.shown("hint", "h"), "Hint", !this.busy && hints.length < exercise.hints.length, cx => this.action("hint", cx)))
        .child(div().text_size(12).text_color(t.muted).child(`${hints.length}/${exercise.hints.length}`)))
      .when(hints.length === 0, element => element.child(div().text_size(12).text_color(t.dim).child("Each press reveals a little more. The answer stays separate.")))
      .children(hints.map((hint, index) => v_flex().gap(6).p(10).rounded(8).bg(t.raised)
        .child(div().text_size(11).text_color(t.accent).child(`Hint ${index + 1}`))
        .child(this.markdown(`hint-${exercise.id}-${index}`, hint))))
      .when(this.state.answerShown, element => element.child(v_flex().gap(6)
        .child(sectionLabel(t, "One valid answer"))
        .child(this.markdown(`answer-${exercise.id}`, `\`\`\`${this.language.codeFence}\n${exercise.solution}\n\`\`\``))))
      .when(!this.state.answerShown, element => element.child(h_flex()
        .child(keyButton(t, "show-answer", this.shown("answer", "a"), "Show answer", !this.busy, cx => this.action("answer", cx)))))
      .when(Boolean(result), element => element.child(v_flex().gap(7).p(12).rounded(8).bg(t.raised)
        .child(div().font_semibold().text_color(this.state.stale ? t.muted : result?.passed ? t.ansi2 : t.blocked).child(this.state.stale ? "Saved code changed. Check again." : result?.title ?? ""))
        .when(Boolean(result?.assisted), element => element.child(div().text_size(11).text_color(t.dim).child("Checked after viewing the answer.")))
        .children((result?.details ?? []).map((detail, index) => this.markdown(`result-${result?.at}-${index}`, `\`\`\`text\n${detail}\n\`\`\``)))
        .when(Boolean(result?.passed) && !this.state.stale, element => element.child(h_flex().gap(8).items_center().flex_wrap()
          .child(keyButton(t, "compare", this.shown("compare", "d"), "Compare with reference", !this.busy && Boolean(this.editor), cx => this.action("compare", cx)))
          .when(Boolean(this.compareNote), element => element.child(div().text_size(12).text_color(t.done).child(this.compareNote)))))))
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
      .when(!result, element => element.child(div().text_size(12).text_color(t.dim).child(this.keyOf("check") ? `Save the file to run it. Press ${this.keyOf("check")} to run the saved file again.` : "Save the file to run it.")))
      .when(Boolean(result), element => element.child(v_flex().gap(7).p(12).rounded(8).bg(t.raised)
        .child(div().font_semibold().text_color(this.state?.stale ? t.muted : result?.passed ? t.ansi2 : t.blocked).child(this.state?.stale ? "Saved code changed. Run it again." : result?.title ?? ""))
        .children((result?.details ?? []).map((detail, index) => this.markdown(`scratch-${result?.at}-${index}`, `\`\`\`text\n${detail}\n\`\`\``)))));
  }

  nextLabel() {
    const review = this.state?.review;
    if (!review) return "Another exercise";
    return review.index + 1 >= review.ids.length ? "Finish review" : "Next in review";
  }

  /** @param {Context} cx */
  render(cx) {
    if (this.toggleOnly) return div();
    // Finding the way back: nothing until the screen it ends on.
    if (this.restoring) return v_flex().id("practice-range").size_full().bg(this.background(colors())).track_focus(this.handle);
    // Saved as it changes (only when it changed), so the next dialog opens here.
    if (this.dialog) this.saveSpot();
    const t = colors();
    return v_flex().id("practice-range").relative().size_full().min_w(0).min_h(0).bg(this.background(t)).text_color(t.foreground).text_size(13)
      .on_size_change((_size, cx) => this.bindPane(cx))
      .track_focus(this.handle).on_key_down((event, cx) => this.key(event, cx))
      .when(this.dialog, element => element.key_context(ESC_CONTEXT).on_action(ESC_ACTION, (_event, cx) => { this.escape(cx); cx.notify(); }))
      .child(paneHeader(t).flex_wrap()
        .child(paneTitle(t, "Practice Range"))
        .child(paneDetail(t, this.screen === "setup" ? "Getting started" : this.screen === "languages" ? "Languages" : this.screen === "scratch" ? `${this.language.name} scratch` : `${this.language.name} repetition`))
        .child(keyButton(t, "choose-languages", this.shown("languages", "l"), "Languages", !this.busy && this.setupCompleted, cx => this.action("languages", cx)))
        .child(keyButton(t, "open-setup", this.shown("setup", "?"), "Setup", !this.busy, cx => this.action("setup", cx)))
        .child(keyButton(t, "choose-topics", this.shown("topics", "t"), "Topics", !this.busy && !["setup", "languages"].includes(this.screen) && Boolean(this.state), cx => this.action("topics", cx)))
        .child(keyButton(t, "choose-exercises", this.shown("exercises", "e"), "Exercises", !this.busy && !["setup", "languages"].includes(this.screen) && Boolean(this.state) && (Boolean(this.pickerTopicId) || this.screen === "practice"), cx => this.action("exercises", cx)))
        .child(keyButton(t, "toggle-scratch", this.shown("scratch", "x"), this.screen === "scratch" ? "Back to exercise" : "Scratch", !this.busy && !["setup", "languages"].includes(this.screen) && Boolean(this.state), cx => this.action("scratch", cx)))
        .child(this.shortcuts.button(t)))
      .when(Boolean(this.error), element => element.child(v_flex().flex_none().px(SIZE.panePad).py(8).gap(8)
        .child(banner(t, this.error, t.blocked))
        .child(keyButton(t, "retry", "", "Retry", !this.busy, cx => this.action("retry", cx)))))
      .when(Boolean(this.syncError), element => element.child(v_flex().flex_none().px(SIZE.panePad).py(8)
        .child(banner(t, this.syncError, t.blocked))))
      .when(Boolean(this.busy), element => element.child(h_flex().flex_none().px(SIZE.panePad).py(8).gap(8).items_center()
        .child(spinner(t)).child(div().text_color(t.muted).child(this.busy))))
      .child(this.screen === "setup" ? setupPanel(t, { step: this.setupStep, busy: Boolean(this.busy), requirements: this.requirements,
        editor: this.editor, offerDefault: this.offerEditorDefault, language: this.setupLanguage, activeLanguageId: this.language.id,
        enabled: this.enabledLanguages, completed: this.setupCompleted, keyOf: id => this.keyOf(id), tutorContent: () => tutorSettings(t, { config: this.tutor, busy: this.tutorSettingBusy, error: this.tutorSettingsError, change: (provider, cx) => this.changeTutor(provider, cx) }), editorContent: () => this.editorControls(t), action: (action, cx) => this.action(action, cx) })
        : this.screen === "languages" ? languagePanel(t, { enabled: this.enabledLanguages, selected: this.selected, busy: Boolean(this.busy), languagesKey: this.keyOf("languages"), choose: (id, cx) => this.chooseLanguage(id, cx) })
        : this.screen === "practice" ? this.practice(t) : this.screen === "scratch" ? this.scratch(t) : this.topicList(t, cx))
      .when(this.confirmRepeat, element => element.child(v_flex().flex_none().px(SIZE.panePad).py(10).gap(8)
        .child(banner(t, "Start this exercise fresh? The saved answer is backed up. Save any editor changes first, then reload the file in your editor."))
        .child(h_flex().gap(6)
          .child(keyButton(t, "confirm-repeat", "enter", "Start fresh", !this.busy, cx => this.action("confirm-repeat", cx)))
          .child(keyButton(t, "cancel-repeat", "esc", "Keep working", true, cx => { this.confirmRepeat = false; cx.notify(); })))))
      .when(this.screen === "scratch", element => element.child(paneBar(t)
        .when(this.editorDefaultSet, element => element.child(keyButton(t, "open-scratch-editor", this.shown("open", "o"), "Open editor", !this.busy && Boolean(this.state), cx => this.action("open", cx))))
        .child(keyButton(t, "run-scratch", this.shown("check", "c"), "Run saved code", !this.busy && Boolean(this.state), cx => this.action("check", cx)))
        .child(keyButton(t, "leave-scratch", "esc", "Back to exercise", !this.busy && Boolean(this.state), cx => this.action("practice", cx)))))
      .when(this.screen === "practice", element => element.child(paneBar(t)
        .when(this.tutor.enabled, element => element.child(keyButton(t, "ask-tutor", this.shown("tutor", "u"), "Ask tutor", !this.busy, cx => this.action("tutor", cx))))
        .when(this.editorDefaultSet, element => element.child(keyButton(t, "open-editor", this.shown("open", "o"), "Open editor", !this.busy && Boolean(this.state), cx => this.action("open", cx))))
        .child(keyButton(t, "check", this.shown("check", "c"), "Check saved code", !this.busy && Boolean(this.state), cx => this.action("check", cx)))
        .child(keyButton(t, "send-to-scratch", this.shown("send-to-scratch", "s"), "Send to scratch", !this.busy && Boolean(this.state), cx => this.action("send-to-scratch", cx)))
        .child(keyButton(t, "repeat", this.shown("repeat", "r"), "Repeat", !this.busy && Boolean(this.state), cx => this.action("repeat", cx)))
        .child(keyButton(t, "next", this.shown("next", "n"), this.nextLabel(), !this.busy && Boolean(this.state), cx => this.action("next", cx)))
        .when(Boolean(this.state?.review), element => element.child(keyButton(t, "end-review", this.shown("review", "v"), "End review", !this.busy, cx => this.action("review-end", cx))))))
      // Under the header, which is one line tall until it wraps.
      .when(this.shortcuts.open, element => element.child(this.shortcuts.panel(t, { top: 52, right: SIZE.panePad, maxHeight: 360 })));
  }
}
