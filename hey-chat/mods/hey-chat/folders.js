// Use Herdr’s native folder picker on macOS, Windows and Linux.
import { pickFolder } from "herdr";
import { folderName, normalFolder } from "./common.js";

/** @returns {Promise<{ cwd: string, name: string } | null>} */
export async function pickProject() {
  const folder = await pickFolder({ prompt: "Open project" });
  if (!folder) return null;
  const cwd = normalFolder(folder);
  return { cwd, name: folderName(cwd) };
}
