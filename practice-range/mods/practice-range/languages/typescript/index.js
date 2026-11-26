import { topics, exercises } from "./catalog.js";

// UI-safe metadata. The Node-only runner and the compiler are loaded separately.
/** @satisfies {import("../types.js").LanguagePack} */
const typescript = {
  id: "typescript",
  name: "TypeScript",
  short: "TS",
  color: "ansi4",
  install: { kind: "npm", what: "the TypeScript compiler" },
  answerFile: "Exercise.ts",
  fileExtension: ".ts",
  codeFence: "typescript",
  runtime: "TypeScript compiler 6.0.3 (pack-local)",
  setupInstructions: "This pack needs one external dependency: the pinned TypeScript compiler. Choose Install to download it once with npm ci, or run npm ci yourself in the mod's languages/typescript folder. Checks never download anything.",
  runnerModule: "./typescript/runner.mjs",
  dataDirectory: "languages/typescript",
  topics,
  exercises,
};

export default typescript;
