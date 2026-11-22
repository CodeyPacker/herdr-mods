// Open project: the system’s folder picker.
import { exec, window } from "herdr";

/** The dialogs wait for you, so they get ten minutes. */
const WAIT = { timeout: 600000 };

/**
 * Asks for a project folder. Resolves with its path and folder name, or null on cancel.
 * @returns {Promise<{ cwd: string, name: string } | null>}
 */
export async function pickProject() {
  const platform = window().platform;
  try {
    if (platform === "macos") {
      const f = await exec("osascript", ["-e", 'POSIX path of (choose folder with prompt "Pick or make the project\'s folder")'], WAIT);
      const cwd = f.code === 0 ? f.stdout.trim().replace(/\/$/, "") : "";
      if (!cwd) return null;
      const start = cwd.split("/").pop() ?? "";
      return { cwd, name: start };
    }
    if (platform === "linux") {
      const f = await exec("zenity", ["--file-selection", "--directory", "--title=Pick the project's folder"], WAIT);
      const cwd = f.code === 0 ? f.stdout.trim().replace(/\/$/, "") : "";
      if (!cwd) return null;
      const start = cwd.split("/").pop() ?? "";
      return { cwd, name: start };
    }
  } catch { /* no dialog program */ }
  return null;
}
