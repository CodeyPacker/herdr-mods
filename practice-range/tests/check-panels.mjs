// Render the actual panel class in each important state with Herdr's native checker.
// All filesystem and editor actions are disabled in these fixtures.
import { mkdtemp, cp, rename, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../mods/practice-range");
const temporary = await mkdtemp(join(tmpdir(), "syntax-panels-"));
const states = ["practice", "topics", "exercises", "feedback", "error", "repeat", "advanced", "advanced-patterns", "advanced-types", "topics-bottom", "exercises-bottom", "editor-picker", "editor-default-neovim", "editor-default-vscode", "editor-default-declined", "editor-default-error", "setup-hub-checking", "setup-hub-ready", "setup-hub-missing", "setup-editor", "setup-editor-missing", "setup-layout", "setup-layout-compact", "setup-tutor", "languages-ready", "languages-add", "languages-checking", "languages-installing", "languages-manual", "setup-return", "return-languages", "topic-navigation", "language-navigation", "language-add-navigation",
  "ts-practice", "ts-feedback", "ts-topics", "ts-exercises-advanced", "ts-module"];
states.push("exercises-shuffle", "ts-exercises-shuffle");
states.push("settings-general", "settings-languages", "settings-editor", "settings-layout", "settings-tutor", "settings-courses", "settings-keyboard");
states.push("tutor-empty", "tutor-off", "tutor-chat", "tutor-thinking", "tutor-error", "tutor-setup");
// TypeScript fixtures render the same panel with the TypeScript pack selected.
const typescriptExercise = { "ts-exercises-advanced": "mappedTypes/getters", "ts-module": "modules/import-named" };
const requested = process.argv.slice(2);
for (const state of requested) if (!states.includes(state)) throw new Error(`Unknown native panel fixture: ${state}`);
try {
  for (const state of states.filter(state => !requested.length || requested.includes(state))) {
    const typescript = state.startsWith("ts-");
    const screen = state.startsWith("topics") || state === "ts-topics" ? "topics" : state.startsWith("exercises") || state === "ts-exercises-advanced" ? "exercises" : "practice";
    const exerciseId = typescript ? typescriptExercise[state] ?? "loops/for-of" : state === "advanced" ? "async/async-dispose" : state === "advanced-patterns" ? "patterns/extended-property" : state === "advanced-types" ? "typeMembers/static-abstract" : "loops/for";
    const folder = join(temporary, state);
    await cp(source, folder, { recursive: true, filter: path => !path.split(/[\\/]/).includes("node_modules") && !path.endsWith(".d.ts") && !path.endsWith("jsconfig.json") && !path.endsWith("tsconfig.json") });
    await rename(join(folder, "main.js"), join(folder, "panel.js"));
    const answerFolder = typescript ? `/tmp/syntax/languages/typescript/answers/${exerciseId}` : "/tmp/syntax/answers/loops/for";
    await writeFile(join(folder, "main.js"), `import Syntax from "./panel.js";
import { findLanguage } from "./languages/index.js";
/** A scan of a computer with C# and TypeScript ready, SQL not installed, and only Neovim. */
const SCAN = { node: { ready: true, version: "25.0.0" },
  languages: { csharp: { ready: true, detail: ".NET SDK 10.0.301", passed: 312, total: 800 }, typescript: { ready: true, detail: "TypeScript 6.0.3", passed: 88, total: 800 },
    sql: { ready: false, detail: "Install this pack's database engine.", passed: 0, total: 800 } },
  editors: { neovim: { found: true, version: "NVIM v0.12.6" }, vscode: { found: false, version: "" } } };
const TUTORS = { claude: { found: true, version: "2.1.0 (Claude Code)", ready: true, detail: "" }, codex: { found: true, version: "codex-cli 0.1", ready: false, detail: "Sign in first: run codex login in your terminal, then reconnect." } };
export default class Fixture extends Syntax {
  perform(action, value) { this.lastPerformed = { action, value }; }
  init(props, cx) {
    super.init(props, cx);
    this.setup.tools = ${state.endsWith("-checking") ? "null" : "SCAN"};
    this.setup.tutors = ${state.endsWith("-checking") ? "null" : "TUTORS"};
    if (${typescript}) {
      this.useLanguage(findLanguage("typescript"));
      this.enabledLanguages = ["csharp", "typescript"];
      if (this.catalog.findExercise(${JSON.stringify(exerciseId)}).id !== ${JSON.stringify(exerciseId)}) throw new Error("TypeScript fixtures must use the TypeScript catalog");
    }
    this.state = { version: 1, exerciseId: ${JSON.stringify(exerciseId)}, hintCount: 3, answerShown: true,
      progress: { "loops/for": { attempts: 2, passes: 1, independentPasses: 1 } },
      result: ${state === "ts-feedback" ? '{ passed: false, kind: "types", title: "The types need a correction", details: ["Check 1: total(values) === 6\\nThis comparison appears to be unintentional because the types \'string\' and \'number\' have no overlap."], at: 1 }' : state === "feedback" ? '{ passed: false, kind: "compile", title: "Fix the compilation errors", details: ["Exercise.cs(12,3): error CS1002: ; expected"], at: 1 }' : "null"},
      file: ${JSON.stringify(`${answerFolder}/Exercise.${typescript ? "ts" : "cs"}`)}, folder: ${JSON.stringify(answerFolder)}, root: ${JSON.stringify(typescript ? "/tmp/syntax/languages/typescript" : "/tmp/syntax")},
      languageId: ${JSON.stringify(typescript ? "typescript" : "csharp")}, runtimeVersion: ${JSON.stringify(typescript ? "TypeScript 6.0.3" : "10.0.301")}, stale: false };
    this.screen = ${JSON.stringify(screen)};
    if (${screen === "exercises"}) this.pickerTopicId = this.catalog.findExercise(this.state.exerciseId).topicId;
    this.selected = ${state === "topics-bottom" ? 19 : state === "exercises-bottom" ? 35 : 0};
    this.error = ${JSON.stringify(state === "error" ? "Install a .NET SDK (8 or newer), then press Retry." : "")};
    this.confirmRepeat = ${state === "repeat"};
    this.editorSettingsLoaded = true;
    this.setupCompleted = true;
    if (${state.startsWith("editor-")}) {
      this.editor = null;
      if (${state !== "editor-picker"}) {
        this.chooseEditor(${JSON.stringify(state === "editor-default-vscode" ? "vscode" : "neovim")}, cx);
        if (!this.offerEditorDefault) throw new Error("First editor choice must offer to save a default");
        if (${state === "editor-default-declined"}) {
          this.finishEditorChoice(cx);
          if (this.offerEditorDefault || this.editor !== "neovim") throw new Error("Declining must keep the tab's editor without another prompt");
        }
        if (${state === "editor-default-error"}) this.error = "Could not save your default editor: configuration changed. Retry or use Just this tab.";
      }
    } else {
      this.editor = "neovim";
      this.editorDefaultSet = true;
      this.chooseEditor("vscode", cx);
      if (this.offerEditorDefault || this.editor !== "neovim") throw new Error("Configured users must skip the editor picker and prompt");
    }
    if (${state.startsWith("languages-") || state.startsWith("language-")}) {
      this.screen = "languages";
      this.enabledLanguages = ${JSON.stringify(state === 'languages-add' || state === 'language-add-navigation' ? ['csharp'] : ['csharp', 'typescript'])};
      this.state = null;
      this.action("topics", cx);
      this.action("next", cx);
      if (this.screen !== "languages" || this.lastPerformed) throw new Error("Choose a language before using topic or exercise commands");
      if (${state === 'language-navigation'}) {
        this.chooseLanguage("typescript", cx);
        if (this.lastPerformed?.action !== "language" || this.lastPerformed?.value !== "typescript" || this.screen !== "languages") throw new Error("A language choice must load its topics before practice");
      }
      if (${state === 'language-add-navigation'}) {
        this.chooseLanguage("sql", cx);
        if (this.screen !== "languages" || this.lastPerformed || this.selected !== 2) throw new Error("A pack that isn't installed must offer its install, not open");
      }
      if (${state === 'languages-installing'}) { this.selected = 2; this.setup.installing = "sql"; }
      if (${state === 'languages-manual'}) {
        this.setup.tools = { ...SCAN, languages: { ...SCAN.languages, csharp: { ready: false, detail: "Install a .NET SDK (8 or newer).", passed: 0, total: 800 } } };
        this.setup.installErrors.sql = "npm ci failed\\nnpm ERR! network";
      }
    }
    if (${state === 'topic-navigation'}) {
      this.screen = "topics";
      this.action("next", cx);
      this.action("exercises", cx);
      this.action("topics", cx);
      if (this.screen !== "topics" || this.lastPerformed) throw new Error("Choose a topic before an exercise");
      this.chooseTopic("arrays", cx);
      if (this.screen !== "exercises" || this.state.exerciseId !== "loops/for" || !this.items().every(item => item.topicId === "arrays")) throw new Error("A topic choice must show exercises before opening an answer");
    }
    if (${state.endsWith("exercises-shuffle")}) {
      this.screen = "exercises";
      this.pickerTopicId = this.catalog.findExercise(this.state.exerciseId).topicId;
      this.action("shuffle", cx);
      const chosen = this.catalog.findExercise(this.lastPerformed?.value);
      if (this.lastPerformed?.action !== "select" || chosen.topicId !== this.pickerTopicId || chosen.id === this.state.exerciseId) throw new Error("Shuffle must choose another exercise from the displayed topic");
    }
    if (${state.startsWith("tutor-")}) {
      if (${state !== 'tutor-off'}) this.tutor = { enabled: true, provider: "codex" };
      this.tutorThreads[this.tutorKey()] = [{ role: "user", content: "Why does the loop start at zero?" }, { role: "assistant", content: "The starting value is chosen by the loop. In this exercise, **zero** is the first value added." }];
      if (${state === 'tutor-empty'}) this.tutorThreads[this.tutorKey()] = [];
      this.tutorBusy = ${state === 'tutor-thinking'};
      this.tutorError = ${JSON.stringify(state === 'tutor-error' ? 'The tutor took too long. Try again.' : '')};
      if (${state === 'tutor-off'}) {
        this.askTutor(cx);
        if (this.tutorBusy || this.tutorRequestId) throw new Error("Disabled AI must never start a request");
      }
      if (${state === 'tutor-setup'}) { this.screen = "setup"; this.setup.page = "tutor"; }
    }
    if (${state === "setup-return" || state === "return-languages"}) {
      this.screen = "practice";
      if (${state === "setup-return"}) { this.openSetup("hub", cx); this.openSetup("layout", cx); this.key({ key: "escape", keystroke: "escape", modifiers: {} }, cx); if (this.settingsOpen) throw new Error("Escape must close settings"); }
      else { this.action("languages", cx); this.key({ key: "escape", keystroke: "escape", modifiers: {} }, cx); }
      if (this.screen !== "practice" || this.returnScreen || ${state !== "setup-return"} && this.lastPerformed?.action !== "status") throw new Error("esc must go back to the exercise and check it for saves");
      this.action("languages", cx);
    }
    if (${state.startsWith("setup-") && state !== "setup-return"}) {
      this.screen = "setup";
      this.setupCompleted = false;
      this.setup.page = ${JSON.stringify(state.startsWith("setup-hub") ? "hub" : state.split("-")[1])};
      if (${state === "setup-hub-missing" || state === "setup-editor-missing"}) { this.editor = "vscode"; this.editorDefaultSet = false; }
      if (${state === "setup-layout-compact"}) this.useLayout({ side: "right", width: 0.4, compact: true });
      this.action("topics", cx);
      if (this.screen !== "setup") throw new Error("Setup must not be bypassed through practice shortcuts");
      if (${state === "setup-hub-missing"}) {
        this.startPracticing(cx);
        if (this.busy || this.lastPerformed) throw new Error("Start must wait for an editor that is installed");
      }
      if (${state === "setup-layout"}) {
        this.setupKey("l", cx);
        this.setupKey("s", cx);
        if (this.layout.width !== 0.55 || this.layout.side !== "right") throw new Error("Layout keys must change the width and side");
      }
      if (${state === "setup-editor"}) {
        this.setupKey("escape", cx);
        if (this.setup.page !== "hub") throw new Error("esc on a setup page goes back to the hub");
        this.setup.page = "editor";
      }
    }
    if (${state.startsWith("settings-")}) {
      this.screen = "practice";
      this.openSetup("hub", cx);
      this.selectSettingsTab(${JSON.stringify(state.replace("settings-", ""))}, cx);
      if (!this.settingsOpen || this.screen !== "practice") throw new Error("Settings must overlay the current page");
    }
  }
}
`);
    const result = spawnSync("herdr-app", ["check", folder], { encoding: "utf8", timeout: 30000 });
    if (result.status !== 0) throw new Error(`${state}: ${result.error?.message || result.stdout || result.stderr}`);
    console.log(`${state}: native render passed`);
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
