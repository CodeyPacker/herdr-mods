import { topics, exercises } from "./catalog.js";

// UI-safe metadata. The Node-only runner is loaded separately when practice starts.
/** @satisfies {import("../types.js").LanguagePack} */
const csharp = {
  id: "csharp",
  name: "C#",
  answerFile: "Exercise.cs",
  fileExtension: ".cs",
  codeFence: "csharp",
  runtime: ".NET SDK 8 or newer",
  setupInstructions: "Install .NET SDK 8 or newer. Choose the SDK download, then restart Herdr and choose Check again.",
  runnerModule: "./csharp/runner.mjs",
  dataDirectory: ".",
  topics,
  exercises,
};

export default csharp;
