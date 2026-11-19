import { topics, exercises } from "./catalog.js";

// UI-safe metadata. The Node-only runner and the database engine are loaded separately.
/** @satisfies {import("../types.js").LanguagePack} */
const sql = {
  id: "sql",
  name: "SQL",
  answerFile: "Exercise.sql",
  fileExtension: ".sql",
  codeFence: "sql",
  runtime: "PGlite 0.5.16, PostgreSQL 18 in WebAssembly (pack-local)",
  setupInstructions: "This pack needs one external dependency: PGlite, which is PostgreSQL compiled to WebAssembly, so no database server is needed and it runs the same on macOS, Windows, and Linux. In a terminal, run npm ci in the mod's languages/sql folder (for example ~/.config/herdr-app/mods/syntax/languages/sql). npm downloads it once from its registry. Then recheck here. Checks never download anything.",
  runnerModule: "./sql/runner.mjs",
  dataDirectory: "languages/sql",
  suppliedLabel: "Tables",
  checkNote: "Every check starts from a fresh copy of the practice database, so you can insert, update, and drop freely. schema.sql beside this file has every table and row.",
  topics,
  exercises,
};

export default sql;
