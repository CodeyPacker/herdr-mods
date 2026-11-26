/**
 * Metadata imported by the practice interface. Compiler code stays in runnerModule.
 * dataDirectory is relative to the practice directory. C# uses "." to keep older paths.
 * suppliedLabel names an exercise's declarations ("Supplied types" by default; SQL shows "Tables").
 * checkNote replaces the README sentence about what checking adds around the answer.
 * scratchNote adds a line to the scratch screen, such as where scratch code runs.
 * short is the pack's badge text ("TS"), and color the theme color it is drawn in ("ansi4").
 * install says how the pack gets what it needs: "npm" runs npm ci in the pack's folder from the
 * panel, and "manual" points to a download page for software the person installs themselves.
 * @typedef {{ kind: "npm", what: string } | { kind: "manual", what: string, url: string }} PackInstall
 * @typedef {{ id: string, name: string, short: string, color: string, install: PackInstall,
 *   answerFile: string, fileExtension: string,
 *   codeFence: string, runtime: string, setupInstructions: string, runnerModule: string,
 *   dataDirectory: string, suppliedLabel?: string, checkNote?: string, scratchNote?: string,
 *   topics: import("../types.js").Topic[], exercises: import("../types.js").CatalogExercise[] }} LanguagePack
 */
export {};
