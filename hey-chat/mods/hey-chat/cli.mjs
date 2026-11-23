// Small helpers the mod's Node programs share: their arguments, JSON lines, and errors.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** --name value pairs from argv. @param {string[]} argv */
export function flags(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[++i] ?? "";
  return out;
}

/** A JSON line, or null when it isn't one. @param {string} line */
export function parse(line) {
  try { return JSON.parse(line); } catch { return null; }
}

/** Splits a stream into lines and hands each complete, non-empty one to `each`. @param {(line: string) => void} each */
export function lines(each) {
  let buf = "";
  return (/** @type {Buffer | string} */ chunk) => {
    buf += chunk.toString();
    let n;
    while ((n = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, n).trim();
      buf = buf.slice(n + 1);
      if (line) each(line);
    }
  };
}

/** An error's message. @param {unknown} e */
export function errorText(e) {
  return e instanceof Error ? e.message : String(e);
}

/** Text on one line, cut to `n` characters with "…". @param {unknown} s @param {number} n */
export function clip(s, n) {
  const one = String(s ?? "").replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

/**
 * True when the module at `url` is the program Node was started with, not one imported by
 * another. Herdr's mods folder can link to the mod, so both paths are resolved first.
 * @param {string} url the module's import.meta.url
 */
export function isMain(url) {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url)); } catch { return false; }
}
