import { findLanguage } from "./index.js";

// Only registered packs can load executable code. Editor views never import this module.
export async function loadLanguageRunner(id) {
  const language = findLanguage(id);
  return import(new URL(language.runnerModule, import.meta.url).href);
}
