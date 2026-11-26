import { topics, exercises } from "./catalog.js";

// UI-safe metadata. The Node-only runner and the database engine are loaded separately.
/** @satisfies {import("../types.js").LanguagePack} */
const sql = {
  id: "sql",
  name: "SQL",
  short: "SQL",
  color: "ansi6",
  install: { kind: "npm", what: "PGlite" },
  answerFile: "Exercise.sql",
  fileExtension: ".sql",
  codeFence: "sql",
  runtime: "PGlite 0.5.16, PostgreSQL 18 in WebAssembly (pack-local)",
  setupInstructions: "This pack needs one external dependency: PGlite, which is PostgreSQL compiled to WebAssembly, so no database server is needed and it runs the same on macOS, Windows, and Linux. Choose Install to download it once with npm ci, or run npm ci yourself in the mod's languages/sql folder. Checks never download anything.",
  runnerModule: "./sql/runner.mjs",
  dataDirectory: "languages/sql",
  suppliedLabel: "Tables",
  scratchNote: "Each run starts from a fresh copy of the practice database, so nothing you change is kept. schema.sql beside the file has every table and row.",
  checkNote: "Every check starts from a fresh copy of the practice database, so you can insert, update, and drop freely. schema.sql beside this file has every table and row.",
  topics,
  exercises,
};

export default sql;
