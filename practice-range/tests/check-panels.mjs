// Render the actual panel class in each important state with Herdr's native checker.
// All filesystem and editor actions are disabled in these fixtures.
import { mkdtemp, cp, rename, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../mods/practice-range");
const temporary = await mkdtemp(join(tmpdir(), "syntax-panels-"));
const states = ["practice", "topics", "exercises", "feedback", "error", "repeat", "advanced", "advanced-patterns", "advanced-types", "topics-bottom", "exercises-bottom", "editor-picker", "editor-default-neovim", "editor-default-vscode", "editor-default-declined", "editor-default-error", "setup-welcome", "setup-language", "setup-requirements-ready", "setup-requirements-missing", "setup-editor-picker", "setup-editor-default", "setup-editor-ready", "setup-tutorial", "languages-ready", "languages-add", "topic-navigation", "language-navigation", "language-add-navigation",
  "ts-setup-language", "ts-setup-missing", "ts-setup-tutorial", "ts-practice", "ts-feedback", "ts-topics", "ts-exercises-advanced", "ts-module"];
states.push("exercises-shuffle", "ts-exercises-shuffle");
states.push("tutor-empty", "tutor-off", "tutor-chat", "tutor-thinking", "tutor-error", "tutor-setup");
// TypeScript fixtures render the same panel with the TypeScript pack selected.
const typescriptExercise = { "ts-exercises-advanced": "mappedTypes/getters", "ts-module": "modules/import-named" };
try {
  for (const state of states) {
    const typescript = state.startsWith("ts-");
    const screen = state.startsWith("topics") || state === "ts-topics" ? "topics" : state.startsWith("exercises") || state === "ts-exercises-advanced" ? "exercises" : "practice";
    const exerciseId = typescript ? typescriptExercise[state] ?? "loops/for-of" : state === "advanced" ? "async/async-dispose" : state === "advanced-patterns" ? "patterns/extended-property" : state === "advanced-types" ? "typeMembers/static-abstract" : "loops/for";
    const folder = join(temporary, state);
    await cp(source, folder, { recursive: true, filter: path => !path.split(/[\\/]/).includes("node_modules") && !path.endsWith(".d.ts") && !path.endsWith("jsconfig.json") && !path.endsWith("tsconfig.json") });
    await rename(join(folder, "main.js"), join(folder, "panel.js"));
    const answerFolder = typescript ? `/tmp/syntax/languages/typescript/answers/${exerciseId}` : "/tmp/syntax/answers/loops/for";
    await writeFile(join(folder, "main.js"), `import Syntax from "./panel.js";
import { findLanguage } from "./languages/index.js";
export default class Fixture extends Syntax {
  perform(action, value) { this.lastPerformed = { action, value }; }
  init(props, cx) {
    super.init(props, cx);
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
        this.chooseLanguage("typescript", cx);
        if (this.screen !== "setup" || this.setupStep !== 1 || this.setupLanguage.id !== "typescript" || !this.enabledLanguages.includes("csharp")) throw new Error("Adding another language must retain existing packs");
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
    if (${state.startsWith("ts-setup-")}) {
      this.screen = "setup";
      this.setupLanguage = findLanguage("typescript");
      this.enabledLanguages = ["csharp"];
      this.setupStep = ${JSON.stringify({ "ts-setup-language": 1, "ts-setup-missing": 2, "ts-setup-tutorial": 4 }[state] ?? 0)};
      this.requirements = { node: { ready: true, detail: "Node.js 25.0.0" }, language: { ready: ${state !== "ts-setup-missing"}, detail: ${JSON.stringify(state === "ts-setup-missing" ? "Install this pack's TypeScript compiler (6.0.3): run npm ci in /Users/me/.config/herdr-app/mods/practice-range/languages/typescript, then recheck." : "TypeScript: TypeScript 6.0.3")} }, editor: { ready: true, detail: "nvim is available" } };
      this.action("topics", cx);
      if (this.screen !== "setup" || this.language.id !== "typescript") throw new Error("TypeScript setup must stay in setup with the TypeScript pack");
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
      if (${state === 'tutor-setup'}) { this.screen = "setup"; this.setupStep = 0; }
    }
    if (${state.startsWith("setup-")}) {
      this.screen = "setup";
      this.setupCompleted = false;
      this.setupStep = ${JSON.stringify({ 'setup-welcome': 0, 'setup-language': 1, 'setup-requirements-ready': 2, 'setup-requirements-missing': 2, 'setup-editor-picker': 3, 'setup-editor-default': 3, 'setup-editor-ready': 3, 'setup-tutorial': 4 }[state] ?? 0)};
      this.requirements = { node: { ready: true, detail: "Node.js 25.0.0" }, language: { ready: ${state !== "setup-requirements-missing"}, detail: ${JSON.stringify(state === 'setup-requirements-missing' ? 'Install a .NET SDK (8 or newer), then recheck.' : 'C#: 10.0.301')} }, editor: { ready: ${state === "setup-editor-ready"}, detail: ${JSON.stringify(state === 'setup-editor-ready' ? 'nvim is available' : 'Choose an editor and check its command.')} } };
      if (${['setup-editor-picker', 'setup-editor-default'].includes(state)}) {
        this.editor = null;
        this.editorDefaultSet = false;
        if (${state === 'setup-editor-default'}) this.chooseEditor("neovim", cx);
      }
      this.action("topics", cx);
      if (this.screen !== "setup") throw new Error("Setup must not be bypassed through practice shortcuts");
    }
  }
}
`);
    const result = spawnSync("herdr-app", ["check", folder], { encoding: "utf8", timeout: 30000 });
    if (result.status !== 0) throw new Error(`${state}: ${result.error?.message || result.stdout || result.stderr}`);
    console.log(`${state}: native render passed`);
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
