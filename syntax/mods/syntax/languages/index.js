import csharp from "./csharp/index.js";
import typescript from "./typescript/index.js";

// Bundled packs, in the order setup lists them. C# stays the default for older data.
export const languages = [csharp, typescript];
export const defaultLanguage = csharp;

/** @param {string} id */
export function findLanguage(id) {
  const language = languages.find(language => language.id === id);
  if (!language) throw new Error(`Language pack is not installed: ${id}`);
  return language;
}
