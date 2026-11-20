// Runs Tutor's writing pipeline outside Herdr, to check the prompts and checks against a real repo.
// Run from tutor/: node scripts/try-build.mjs <repo folder> <out folder> [module number, default 2]
// Writes course.json, then that module and its exercises, into the out folder. Needs claude, git and dotnet.
import { spawn, execFileSync, execFile } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { TOOLS } from "../mods/tutor/constants.js";
import { csharp as lang } from "../mods/tutor/lang/csharp.js";
import { writeOutline, writeModule, writeExercises } from "../mods/tutor/build.js";
import { parseKnown } from "../mods/tutor/learner.js";

const [repoArg, out, numArg] = process.argv.slice(2);
if (!repoArg || !out) { console.error("usage: node scripts/try-build.mjs <repo> <out> [module number]"); process.exit(2); }
mkdirSync(out, { recursive: true });
const root = execFileSync("git", ["-C", repoArg, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const count = execFileSync("git", ["-C", root, "ls-files", "--", ...lang.sources], { encoding: "utf8", maxBuffer: 64 << 20 }).split("\n").filter(Boolean).length;
const info = { root, name: basename(root), commit, count };
const t0 = Date.now();
const log = text => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${text}`);

/** One claude chat: each ask resumes the session the first one started. */
function session() {
  let id = null;
  return prompt => new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json", ...(id ? ["--resume", id] : []), ...TOOLS];
    const p = spawn("claude", args, { cwd: root, windowsHide: true });
    let stdout = "", stderr = "";
    p.stdout.on("data", d => { stdout += d; });
    p.stderr.on("data", d => { stderr += d; });
    p.on("error", reject);
    p.on("close", () => {
      try {
        const r = JSON.parse(stdout);
        if (r.session_id) id = r.session_id;
        if (r.is_error) reject(new Error(String(r.result)));
        else resolve(String(r.result ?? ""));
      } catch { reject(new Error((stderr || stdout || "claude returned nothing").slice(-600))); }
    });
    p.stdin.end(prompt);
  });
}

const cache = new Map();
const linesAt = async path => {
  if (!cache.has(path)) {
    let text = null;
    try { text = execFileSync("git", ["-C", root, "show", `${commit}:${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }); } catch { text = null; }
    cache.set(path, text === null ? null : text.replace(/\r/g, "").replace(/\n$/, "").split("\n"));
  }
  return cache.get(path);
};

const runDir = join(out, "run");
mkdirSync(runDir, { recursive: true });
let runs = 0;
const run = (ex, source) => new Promise(resolve => {
  const path = join(runDir, `${ex.id}.${++runs}.cs`);
  writeFileSync(path, lang.practice.compose(ex, source));
  execFile("dotnet", ["run", path], { timeout: 60000, maxBuffer: 8 << 20, windowsHide: true }, (err, stdout, stderr) => {
    resolve(lang.practice.parseRun(ex, { code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout, stderr, timedOut: Boolean(err?.killed) }));
  });
});

const io = ask => ({ ask, say: log, linesAt, run });
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2));

let course;
const coursePath = join(out, "course.json");
if (existsSync(coursePath)) { course = JSON.parse(readFileSync(coursePath, "utf8")); log("course.json already there, reusing it"); }
else {
  // TUTOR_KNOWN="Go, some SQL" plans for a different learner. Unset: the TypeScript default.
  course = await writeOutline(io(session()), info, lang, process.env.TUTOR_KNOWN === undefined ? undefined : parseKnown(process.env.TUTOR_KNOWN));
  save("course.json", course);
  log(`plan: ${course.modules.length} modules in ${course.parts.length} parts`);
  for (const m of course.modules) console.log(`   ${m.id} [${m.part}] ${m.title}: ${m.summary}`);
}
const n = Number(numArg ?? 2), entry = course.modules[n - 1];
const mod = await writeModule(io(session()), course, entry, n, lang);
save(`${entry.id}.module.json`, mod);
log(`module ${entry.id}: ${mod.stops.length} stops, ${mod.quiz.length} questions`);
const exs = await writeExercises(io(session()), course, mod, entry, n, lang);
save(`${entry.id}.exercises.json`, { module: entry.id, exercises: exs });
log(`exercises: ${exs.length} (${exs.map(e => e.id).join(", ")})`);
log(`done, ${runs} dotnet runs`);
