// Catches Spotify's redirect after login. A mod cannot listen on a port, so a small script
// started with exec does it: listener.ps1 on Windows, listener.sh on macOS. The script also
// opens the browser, once it is listening, so the redirect cannot arrive too early.
import { exec, appHome, readTextFile } from "herdr";
import { MOD, REDIRECT_PORT, LOGIN_SECONDS } from "./constants.js";
import { isWindows } from "./platform.js";

const scriptPath = (/** @type {string} */ name) => `${appHome()}/mods/${MOD}/${name}`.replace(/\\/g, "/");

/** @param {string} url */
async function runWindows(url) {
  const script = await readTextFile(scriptPath("listener.ps1"));
  if (!script) throw new Error("listener.ps1 is missing");
  // The script runs inline (-Command), so the machine's script file policy does not apply.
  // `url` sits in a single-quoted PowerShell string: the caller builds it from a checked
  // client ID and URL-safe values, so it holds no quote.
  const command = `& { ${script} } -Port ${REDIRECT_PORT} -TimeoutSec ${LOGIN_SECONDS} -Url '${url}'`;
  return exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { timeout: (LOGIN_SECONDS + 20) * 1000 });
}

/** @param {string} url */
function runMac(url) {
  return exec("sh", [scriptPath("listener.sh"), String(REDIRECT_PORT), url], { timeout: LOGIN_SECONDS * 1000 });
}

/**
 * Opens `url` in the browser and waits for the redirect.
 * `path`: the redirect arrived, as "/callback?code=...&state=...".
 * `busy`: another program holds the port, and the browser was not opened.
 * `missed`: the browser was opened but no redirect was caught.
 * @param {string} url
 * @returns {Promise<{ path: string } | { busy: true } | { missed: true }>}
 */
export async function openAndWaitForRedirect(url) {
  try {
    const r = await (isWindows() ? runWindows(url) : runMac(url));
    if (r.code === 0 && r.stdout.trim()) return { path: r.stdout.trim() };
    if (r.code === 2) return { busy: true };
    return { missed: true };
  } catch {
    // exec rejects when the wait runs out or the script cannot start.
    return { missed: true };
  }
}
