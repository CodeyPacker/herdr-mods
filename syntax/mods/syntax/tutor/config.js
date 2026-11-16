import { parseConfig } from "../editor-config.js";

/** @typedef {"codex" | "claude"} TutorProvider */
/** @typedef {{ enabled: boolean, provider: TutorProvider | null }} TutorConfig */

/** @param {string | null} text @returns {TutorConfig} */
export function parseTutorConfig(text) {
  const tutor = parseConfig(text).tutor;
  if (!tutor || typeof tutor !== "object" || !("enabled" in tutor) || tutor.enabled !== true) return { enabled: false, provider: null };
  if (!("provider" in tutor) || (tutor.provider !== "codex" && tutor.provider !== "claude")) throw new Error("syntax.json: choose codex or claude for the tutor provider.");
  return { enabled: true, provider: tutor.provider };
}

/** @param {TutorProvider | null} provider @param {{ read: () => Promise<string | null>, write: (text: string, expected: string | null) => Promise<unknown> }} io */
export async function saveTutorConfig(provider, io) {
  if (provider !== null && provider !== "codex" && provider !== "claude") throw new Error("Choose Codex or Claude.");
  const previous = await io.read();
  const config = parseConfig(previous);
  config.tutor = { enabled: provider !== null, provider };
  await io.write(JSON.stringify(config, null, 2) + "\n", previous);
}
