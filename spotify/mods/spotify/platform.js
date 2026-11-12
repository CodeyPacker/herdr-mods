// The few things that differ between Windows and macOS.
import { exec, window as appWindow } from "herdr";

export function isWindows() {
  return appWindow().platform === "windows";
}

/** Opens an address in the default browser. @param {string} url */
export function openUrl(url) {
  // rundll32 takes the address as one argument, so "&" in it needs no shell quoting.
  return isWindows() ? exec("rundll32.exe", ["url.dll,FileProtocolHandler", url]) : exec("open", [url]);
}
