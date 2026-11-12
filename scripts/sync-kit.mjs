// Copies the shared kit (kit/ at the repo root) into every mod that uses it.
//
//   node scripts/sync-kit.mjs           copy kit/ into each mod's kit/ folder
//   node scripts/sync-kit.mjs --check   change nothing; exit 1 if any copy differs from kit/
//
// A mod can only import from its own folder, so each mod carries a copy. Edit kit/ at the
// root, run this, and never edit a copy. To give another mod the kit, add its folder to MODS.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** The mods that carry a copy, as paths from the repo root. */
const MODS = ["spotify/mods/spotify", "jump/mods/jump"];

/** Files the Herdr app writes into mod folders for editor completions. They are not part of the kit. */
const APP_FILES = new Set(["gpui-kit.d.ts", "jsconfig.json"]);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "kit");
const check = process.argv.includes("--check");

/** Every file under `dir`, as paths relative to it. @param {string} dir @returns {string[]} */
function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path).map((inner) => join(name, inner));
    return APP_FILES.has(name) ? [] : [name];
  });
}

const kitFiles = filesUnder(source);
let problems = 0;

for (const mod of MODS) {
  const target = join(root, mod, "kit");
  const label = relative(root, target);
  // Files in the copy that the kit no longer has.
  const stale = filesUnder(target).filter((file) => !kitFiles.includes(file));
  // Files that are missing from the copy or differ from the kit's.
  const changed = kitFiles.filter((file) => {
    const copy = join(target, file);
    return !existsSync(copy) || !readFileSync(copy).equals(readFileSync(join(source, file)));
  });

  if (check) {
    for (const file of changed) console.log(`${label}: ${file} differs from kit/`);
    for (const file of stale) console.log(`${label}: ${file} is not in kit/`);
    problems += changed.length + stale.length;
    continue;
  }
  for (const file of changed) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    writeFileSync(join(target, file), readFileSync(join(source, file)));
  }
  for (const file of stale) rmSync(join(target, file));
  console.log(`${label}: ${changed.length} copied, ${stale.length} removed, ${kitFiles.length - changed.length} already current`);
}

if (check) {
  console.log(problems ? `${problems} file(s) out of sync. Run: node scripts/sync-kit.mjs` : "every copy matches kit/");
  process.exit(problems ? 1 : 0);
}
