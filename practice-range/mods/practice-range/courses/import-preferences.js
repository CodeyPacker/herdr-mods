import { parseConfig } from "../editor-config.js";

/**
 * Copy only named preferences into missing settings, using the app's compare-and-swap writer.
 * @param {{editor?: unknown, agent?: unknown}} preferences
 * @param {{read: () => Promise<string | null>, write: (text: string, expected: string | null) => Promise<unknown>}} io
 */
export async function saveImportedPreferences(preferences, io) {
  const previous=await io.read(), config=parseConfig(previous), applied=[];
  if(!Object.hasOwn(config,"editor") && (preferences.editor==="neovim"||preferences.editor==="vscode")) {
    config.editor=preferences.editor; applied.push("editor");
  }
  if(!Object.hasOwn(config,"tutor") && (preferences.agent==="claude"||preferences.agent==="codex")) {
    config.tutor={enabled:true,provider:preferences.agent}; applied.push("agent");
  }
  if(applied.length) await io.write(JSON.stringify(config,null,2)+"\n",previous);
  return applied;
}
