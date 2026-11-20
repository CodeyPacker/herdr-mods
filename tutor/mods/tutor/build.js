// Writing a course with Claude: the plan first, then each module and its practice the first time
// they are opened. Every reply is checked, and its problems go back for a fix up to FIX_ROUNDS
// times. Plain JavaScript with no Herdr imports. The caller hands in `io`:
//   ask(prompt)      resolves Claude's reply. Each ask continues the same chat.
//   say(text)        shows what is happening now.
//   linesAt(path)    resolves a file's lines at the pinned commit, or null.
//   run(ex, source)  runs a practice file and resolves the language's parseRun result.
import { FIX_ROUNDS } from "./constants.js";
import { parseReply, outlineProblems, moduleProblems, exerciseProblems } from "./validate.js";
import { outlinePrompt, modulePrompt, exercisesPrompt, fixPrompt } from "./prompts.js";
import { learnerOf } from "./learner.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const str = v => (typeof v === "string" ? v : "");

/**
 * Asks, checks the reply, and asks again with its problems. `check(obj)` resolves { hard, soft }.
 * Returns the reply once it has no problems, or only soft ones after the last fix. Throws otherwise.
 */
async function writeChecked(io, first, check, what) {
  let prompt = first;
  for (let round = 0; ; round++) {
    const reply = await io.ask(prompt);
    let obj = null, found;
    try { obj = parseReply(reply); found = await check(obj); }
    catch (e) { found = { hard: [`the reply is not valid JSON (${e?.message ?? e})`], soft: [] }; }
    const all = [...found.hard, ...found.soft];
    if (!all.length || (round >= FIX_ROUNDS && !found.hard.length)) return obj;
    if (round >= FIX_ROUNDS) throw new Error(`The ${what} still has problems after ${plural(FIX_ROUNDS, "fix")}: ${found.hard.slice(0, 3).join("; ")}`);
    io.say(`Fixing ${plural(all.length, "problem")} in the ${what}`);
    prompt = fixPrompt(all);
  }
}

/**
 * The course plan. `info` is { root, name, commit, count } from course.js. `known` is what the
 * learner already knows (learner.js), kept in the course.
 */
export async function writeOutline(io, info, lang, known) {
  io.say(`Reading ${info.name} and planning the modules`);
  const me = learnerOf({ known }, lang);
  const o = await writeChecked(io, outlinePrompt(info, lang, me), o => outlineProblems(o, io.linesAt), "plan");
  return {
    version: 1, name: info.name, root: info.root, commit: info.commit, language: lang.id, known: me.known,
    about: str(o.about), createdAt: new Date().toISOString(),
    parts: o.parts.map(p => ({ id: p.id, title: p.title })),
    modules: o.modules.map(m => ({ id: m.id, part: m.part, title: m.title, summary: m.summary, teaches: str(m.teaches),
      files: (Array.isArray(m.files) ? m.files : []).filter(f => typeof f === "string") })),
  };
}

/** One module: intro, stops and quiz. `entry` is its line in course.json, `number` counts from 1. */
export async function writeModule(io, course, entry, number, lang) {
  io.say(`Reading the code for "${entry.title}" and writing the lessons`);
  const m = await writeChecked(io, modulePrompt(course, entry, number, lang, learnerOf(course, lang)), m => moduleProblems(m, io.linesAt), "module");
  return { id: entry.id, title: entry.title, intro: str(m.intro), stops: m.stops, quiz: m.quiz };
}

/** Why a run did not end the way it should, in one line. */
function why(ex, out) {
  if (out.timedOut) return "it timed out";
  if (!out.compiled) return [...out.errors.map(e => `line ${e.line}: ${e.code} ${e.text}`), ...out.broken.map(b => `check ${b.check}: ${b.code} ${b.text}`)].join("; ");
  if (out.crash) return `it crashed: ${out.crash.split("\n")[0]}`;
  if (ex.kind === "program") return `it printed ${JSON.stringify(out.actual)}, expected ${JSON.stringify(out.expected)}`;
  return out.checks.filter(c => !c.ok).map(c => `${c.name} failed${c.why ? ` (${c.why})` : ""}`).join("; ");
}

/**
 * A module's practice exercises. Each solution must pass and each starter must fail when run.
 * After the last fix, exercises that still fail are dropped. Resolves [] when the module has none.
 */
export async function writeExercises(io, course, mod, entry, number, lang) {
  const prefix = entry.id.slice(0, 2), p = lang.practice;
  io.say(`Writing practice exercises for "${entry.title}"`);
  let prompt = exercisesPrompt(course, mod, entry, number, lang, learnerOf(course, lang));
  for (let round = 0; ; round++) {
    const reply = await io.ask(prompt);
    const problems = [], good = [];
    let list = null;
    try {
      const obj = parseReply(reply);
      if (Array.isArray(obj.exercises)) list = obj.exercises;
      else problems.push(`the reply has no "exercises" list`);
    } catch (e) { problems.push(`the reply is not valid JSON (${e?.message ?? e})`); }
    const ids = new Set();
    for (const [i, ex] of (list ?? []).entries()) {
      const own = await exerciseProblems(ex, prefix, p.check, io.linesAt);
      if (ex?.id && ids.has(ex.id)) own.push("id is used twice");
      ids.add(ex?.id);
      if (!own.length) {
        io.say(`Running exercise ${i + 1} of ${list.length}: the solution`);
        const sol = await io.run(ex, ex.solution);
        if (!sol.passed) own.push(`the solution does not pass: ${why(ex, sol)}`);
        io.say(`Running exercise ${i + 1} of ${list.length}: the starter`);
        if ((await io.run(ex, ex.starter)).passed) own.push("the starter already passes, so there is nothing to write");
      }
      if (own.length) problems.push(...own.map(x => `exercise ${ex?.id ?? i + 1}: ${x}`));
      else good.push(ex);
    }
    if (!problems.length) return good;
    if (round >= FIX_ROUNDS) {
      if (good.length) return good;
      throw new Error(`No exercise worked after ${plural(FIX_ROUNDS, "fix")}: ${problems.slice(0, 3).join("; ")}`);
    }
    io.say(`Fixing ${plural(problems.length, "problem")} in the exercises`);
    prompt = fixPrompt(problems);
  }
}
