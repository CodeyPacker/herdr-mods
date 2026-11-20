// Reading Claude's JSON replies and finding what is wrong with them. Plain JavaScript with no
// Herdr imports, so scripts can use it too. Every check returns { hard, soft }: lists of short
// sentences. Hard problems make the content unusable. Soft ones only bend the style rules.

/** The JSON object in a reply. Takes a ```json block if there is one, else the outermost braces. Throws. */
export function parseReply(text) {
  const s = String(text ?? "");
  const fence = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(s);
  const body = fence ? fence[1] : s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1);
  if (!body.trim()) throw new Error("the reply holds no JSON object");
  const out = JSON.parse(body);
  if (!out || typeof out !== "object" || Array.isArray(out)) throw new Error("the reply is not a JSON object");
  return out;
}

const words = text => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
const text = v => typeof v === "string" && v.trim().length > 0;
const MODULE_ID = /^\d\d-[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A line range in a file at the pinned commit. `linesAt(path)` resolves the file's lines or null.
 * Returns hard problems, plus a soft one when the range is outside `min`..`max` lines.
 */
async function rangeProblems(r, linesAt, min, max) {
  const hard = [], soft = [];
  if (!text(r?.file)) return { hard: ["has no file"], soft };
  const lines = await linesAt(r.file);
  if (!lines) return { hard: [`${r.file} does not exist at the pinned commit`], soft };
  const { start, end } = r;
  if (!(Number.isInteger(start) && Number.isInteger(end) && 1 <= start && start <= end && end <= lines.length)) {
    hard.push(`range ${start}-${end} is outside the file's lines 1-${lines.length}`);
    return { hard, soft };
  }
  const len = end - start + 1;
  if (len < min || len > max) soft.push(`range ${start}-${end} is ${len} lines, wants ${min} to ${max}`);
  if (!text(r.anchor)) hard.push("has no anchor");
  else if (!lines.slice(start - 1, end).some(l => l.includes(r.anchor))) hard.push(`anchor not found in lines ${start}-${end}: ${r.anchor}`);
  return { hard, soft };
}

/** The course plan. `linesAt` checks that each module's suggested files exist. */
export async function outlineProblems(o, linesAt) {
  const hard = [], soft = [];
  const parts = Array.isArray(o.parts) ? o.parts : [];
  const mods = Array.isArray(o.modules) ? o.modules : [];
  if (!parts.length) hard.push("has no parts");
  const partIds = new Set();
  parts.forEach((p, i) => {
    if (!text(p?.id) || !text(p?.title)) hard.push(`part ${i + 1} needs an id and a title`);
    else if (partIds.has(p.id)) hard.push(`part id ${p.id} is used twice`);
    else partIds.add(p.id);
  });
  if (mods.length < 3) hard.push(`has ${mods.length} modules, wants 10 to 20`);
  else if (mods.length < 10 || mods.length > 20) soft.push(`has ${mods.length} modules, wants 10 to 20`);
  const ids = new Set();
  for (const [i, m] of mods.entries()) {
    const at = `module ${m?.id ?? i + 1}`;
    if (!MODULE_ID.test(String(m?.id ?? ""))) { hard.push(`${at}: id must look like "01-short-slug"`); continue; }
    if (ids.has(m.id)) hard.push(`${at}: id is used twice`);
    ids.add(m.id);
    if (m.id.slice(0, 2) !== String(i + 1).padStart(2, "0")) soft.push(`${at}: ids should count up from 01 in order`);
    if (!partIds.has(m.part)) hard.push(`${at}: part ${m.part} is not one of the parts`);
    if (!text(m.title) || !text(m.summary)) hard.push(`${at}: needs a title and a summary`);
    for (const f of Array.isArray(m.files) ? m.files : []) if (!(await linesAt(f))) soft.push(`${at}: ${f} does not exist at the pinned commit`);
  }
  return { hard, soft };
}

/** One module: its stops and quiz. */
export async function moduleProblems(mod, linesAt) {
  const hard = [], soft = [];
  const stops = Array.isArray(mod.stops) ? mod.stops : [], quiz = Array.isArray(mod.quiz) ? mod.quiz : [];
  if (!text(mod.intro)) soft.push("has no intro");
  if (!stops.length) hard.push("has no stops");
  else if (stops.length < 4 || stops.length > 7) soft.push(`has ${stops.length} stops, wants 4 to 7`);
  if (quiz.length < 3) hard.push(`has ${quiz.length} questions, wants 5`);
  else if (quiz.length !== 5) soft.push(`has ${quiz.length} questions, wants 5`);
  for (const [i, s] of stops.entries()) {
    const at = `stop ${i}`;
    if (!text(s?.title)) hard.push(`${at}: has no title`);
    if (!text(s?.body)) hard.push(`${at}: has no body`);
    else { const n = words(s.body); if (n < 60 || n > 160) soft.push(`${at}: body is ${n} words, wants 60 to 160`); }
    const r = await rangeProblems(s, linesAt, 10, 45);
    hard.push(...r.hard.map(p => `${at}: ${p}`)); soft.push(...r.soft.map(p => `${at}: ${p}`));
  }
  const ids = new Set();
  quiz.forEach((q, i) => {
    const at = `question ${q?.id ?? i + 1}`;
    if (!text(q?.id)) hard.push(`${at}: has no id`);
    else if (ids.has(q.id)) hard.push(`${at}: id is used twice`);
    else ids.add(q.id);
    if (!text(q?.prompt)) hard.push(`${at}: has no prompt`);
    const c = Array.isArray(q?.choices) ? q.choices : [];
    if (c.length !== 4) hard.push(`${at}: has ${c.length} choices, wants 4`);
    if (c.some(x => !text(x))) hard.push(`${at}: has an empty choice`);
    if (new Set(c.map(x => String(x).trim())).size !== c.length) hard.push(`${at}: has two choices that are the same`);
    if (!(Number.isInteger(q?.answer) && q.answer >= 0 && q.answer < c.length)) hard.push(`${at}: answer ${q?.answer} is not a choice index`);
    if (!text(q?.why)) hard.push(`${at}: has no why`);
    if (q?.stop !== undefined && q?.stop !== null && !(Number.isInteger(q.stop) && q.stop >= 0 && q.stop < stops.length)) hard.push(`${at}: stop ${q.stop} is not a stop of this module`);
  });
  if (quiz.length > 1 && new Set(quiz.map(q => q?.answer)).size === 1) soft.push("every right answer is the same letter");
  return { hard, soft };
}

/**
 * One exercise's fields and its source range, before it is run. `prefix` is the module's two
 * digits. `check` is the language's own field check. Every problem here is hard.
 */
export async function exerciseProblems(ex, prefix, check, linesAt) {
  const out = [];
  if (!text(ex?.id)) return ["has no id"];
  if (!ex.id.startsWith(`${prefix}-`)) out.push(`id does not start with ${prefix}-`);
  out.push(...check(ex));
  if (!ex.source) out.push("has no source");
  else { const r = await rangeProblems(ex.source, linesAt, 1, 1000); out.push(...r.hard.map(p => `source: ${p}`)); }
  return out;
}

/**
 * Module id → topic id or null, from Claude's reply `{ "matches": { "<module id>": "<topic id>" | null } }`.
 * A topic that is not one of `topics` becomes null, and every module gets an entry.
 */
export function cleanMatches(reply, course, topics) {
  const ids = new Set(topics.map(t => t.id));
  const raw = reply && typeof reply.matches === "object" && reply.matches ? reply.matches : {};
  return Object.fromEntries(course.modules.map(m => [m.id, ids.has(raw[m.id]) ? raw[m.id] : null]));
}
