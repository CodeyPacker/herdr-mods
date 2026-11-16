import { topics, exercises } from "./catalog.js";

// UI-safe metadata. The Node-only runner and the compiler are loaded separately.
/** @satisfies {import("../types.js").LanguagePack} */
const typescript = {
  id: "typescript",
  name: "TypeScript",
  answerFile: "Exercise.ts",
  fileExtension: ".ts",
  codeFence: "typescript",
  runtime: "TypeScript compiler 6.0.3 (pack-local)",
  setupInstructions: "This pack needs one external dependency: the pinned TypeScript compiler. In a terminal, run npm ci in the mod's languages/typescript folder (for example ~/.config/herdr-app/mods/syntax/languages/typescript). npm downloads it once from its registry. Then recheck here. Checks never download anything.",
  runnerModule: "./typescript/runner.mjs",
  dataDirectory: "languages/typescript",
  topics,
  exercises,
};

export default typescript;
