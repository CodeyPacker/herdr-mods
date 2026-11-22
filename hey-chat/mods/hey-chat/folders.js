// New projects: the system's dialogs for picking (or making) a folder and naming it.
import { exec, window } from "herdr";

/** The dialogs wait for you, so they get ten minutes. */
const WAIT = { timeout: 600000 };

/**
 * Asks for a project's folder, then its name (the folder's name to start with). The folder dialog
 * has its own New Folder button. Resolves with both, or null when cancelled or when this system
 * has no dialog Hey, chat knows.
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
      const n = await exec("osascript", ["-e", `text returned of (display dialog "Name the project" default answer ${JSON.stringify(start)} with title "New project")`], WAIT);
      if (n.code !== 0) return null;
      return { cwd, name: n.stdout.trim() || start };
    }
    if (platform === "linux") {
      const f = await exec("zenity", ["--file-selection", "--directory", "--title=Pick the project's folder"], WAIT);
      const cwd = f.code === 0 ? f.stdout.trim().replace(/\/$/, "") : "";
      if (!cwd) return null;
      const start = cwd.split("/").pop() ?? "";
      const n = await exec("zenity", ["--entry", "--title=New project", "--text=Name the project", `--entry-text=${start}`], WAIT);
      if (n.code !== 0) return null;
      return { cwd, name: n.stdout.trim() || start };
    }
  } catch { /* no dialog program */ }
  return null;
}
