import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** Every file under a fixture folder as `{ [relPath]: text }`, as the view would hand to the parser. */
export function readTree(dir) {
  const root = join(FIXTURES, dir);
  const files = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else files[relative(root, p).split(sep).join("/")] = readFileSync(p, "utf8");
    }
  };
  walk(root);
  return files;
}

export const readReport = (name) => readFileSync(join(FIXTURES, "reports", name), "utf8");

/** Freezes a value and everything inside it, so a test fails if a module mutates its input. */
export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
