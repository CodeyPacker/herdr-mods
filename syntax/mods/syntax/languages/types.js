/**
 * Metadata imported by the practice interface. Compiler code stays in runnerModule.
 * dataDirectory is relative to the practice directory. C# uses "." to keep older paths.
 * suppliedLabel names an exercise's declarations ("Supplied types" by default; SQL shows "Tables").
 * checkNote replaces the README sentence about what checking adds around the answer.
 * scratchNote adds a line to the scratch screen, such as where scratch code runs.
 * @typedef {{ id: string, name: string, answerFile: string, fileExtension: string,
 *   codeFence: string, runtime: string, setupInstructions: string, runnerModule: string,
 *   dataDirectory: string, suppliedLabel?: string, checkNote?: string, scratchNote?: string,
 *   topics: import("../types.js").Topic[], exercises: import("../types.js").CatalogExercise[] }} LanguagePack
 */
export {};
