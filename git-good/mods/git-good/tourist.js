// The optional link to Tourist (the guided code review mod). Git Good never needs it: when
// Tourist is not installed there is no Tour button, and the settings say where to get it.
import { appHome, exec, readTextFile, run, window as appWindow } from "herdr";

/** Where to get Tourist. */
export const TOURIST_URL = "https://github.com/CodeyPacker/herdr-mods/tree/main/tourist";

/** True when Tourist is installed on this computer. Reading its mod.json is the check. @returns {Promise<boolean>} */
export async function hasTourist() {
  const file = `${appHome()}/mods/tourist/mod.json`.replace(/\\/g, "/");
  return (await readTextFile(file).catch(() => /** @type {string | null} */ (null))) !== null;
}

/**
 * Opens Tourist in a pane beside the focused one, set to tour everything on the current branch:
 * its commits and the uncommitted changes, against the branch it came from.
 * @param {string | null} folder the repo's top folder, or null to let Tourist find it (a repo on another machine)
 */
export function openTourist(folder) {
  run("pane.split", { direction: "right", mod: "tourist", props: { scope: "branch", ...(folder ? { folder } : {}) } });
}

/** Opens Tourist's page in the default browser. */
export function openTouristPage() {
  // rundll32 takes the address as one argument, so it needs no shell quoting.
  const open = appWindow().platform === "windows" ? exec("rundll32.exe", ["url.dll,FileProtocolHandler", TOURIST_URL]) : exec("open", [TOURIST_URL]);
  open.catch(() => {});
}
