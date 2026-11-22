// Use Herdr’s native folder picker on macOS, Windows and Linux.
import { pickFolder } from "herdr";

/** @returns {Promise<{ cwd: string, name: string } | null>} */
export async function pickProject() {
  const folder = await pickFolder({ prompt: "Open project" });
  if (!folder) return null;
  const cwd = folder.replace(/\\/g, "/").replace(/\/$/, "") || "/";
  return { cwd, name: cwd.split("/").filter(Boolean).pop() ?? cwd };
}
