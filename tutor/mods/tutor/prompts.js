// Every prompt Tutor sends to Claude: writing the course, and the chat in lessons and practice.
// Plain JavaScript with no Herdr imports, so scripts can use it too.
// `me` in every prompt is learnerOf(course, lang) from learner.js: { known, compare, who }.

/** "Compare to X when it helps." or nothing, when the learner knows no other language. */
const compareNote = me => me.compare ? ` Compare to ${me.compare} when it helps.` : "";
const readAt = commit => `Read code at commit ${commit} with \`git show ${commit}:<path>\`, so line numbers match what the learner sees. \`git ls-files\` lists the files. The working tree may differ. Never change any file.`;
const onlyJson = "Reply with only the JSON, no other text.";
const courseList = course => course.modules.map((m, i) => `${i + 1}. ${m.title}: ${m.summary}`).join("\n");

// ---- writing the course -------------------------------------------------------------------

/** Plans the course: parts and modules. `info` is { name, commit, count }. */
export function outlinePrompt(info, lang, me) {
  return [
    `You are planning a ${lang.name} course for one learner. ${me.who}`,
    `The course teaches ${lang.name} from the real code in this repo, "${info.name}", which has ${info.count} ${lang.name} files.`,
    readAt(info.commit),
    ``,
    `First look through the repo: what it is, how it is laid out, and which ${lang.name} features it uses and never uses.`,
    `Then plan the course from this starting syllabus:`,
    ``,
    lang.syllabus,
    ``,
    `Rules:`,
    `- Keep a language topic only when the repo has real code that shows it. Drop or merge the rest. Add a topic the repo leans on that the syllabus lacks.`,
    `- 10 to 20 modules in all. Order them so each builds on the ones before.`,
    `- Module ids are "NN-slug": two digits counting up from 01, then lowercase words joined by dashes.`,
    `- "teaches" names the features the module covers. "files" lists 2 to 6 repo paths that show them best.`,
    `- Titles under 50 characters. Summaries under 70, in plain words.`,
    ``,
    `The JSON:`,
    `{ "about": "one or two sentences on what the repo is", "parts": [{ "id": "basics", "title": "The language" }], "modules": [{ "id": "01-project-shape", "part": "basics", "title": "...", "summary": "...", "teaches": "...", "files": ["path/at/the/commit.cs"] }] }`,
    onlyJson,
  ].join("\n");
}

/** Writes one module: its intro, stops and quiz. */
export function modulePrompt(course, entry, number, lang, me) {
  return [
    `You are writing module ${number} of a ${lang.name} course taught from this repo, "${course.name}". ${me.who}`,
    `The repo: ${course.about ?? ""}`,
    readAt(course.commit),
    ``,
    `The whole course, so you do not teach another module's topic:`,
    courseList(course),
    ``,
    `This module: "${entry.title}". ${entry.summary}`,
    entry.teaches ? `It teaches: ${entry.teaches}` : ``,
    entry.files?.length ? `Files to start from: ${entry.files.join(", ")}. Use others when they show the features better.` : ``,
    ``,
    `The JSON:`,
    `{ "intro": "markdown", "stops": [{ "title": "...", "file": "path", "start": 21, "end": 48, "anchor": "...", "body": "markdown" }], "quiz": [{ "id": "q1", "prompt": "markdown", "code": "optional short snippet", "choices": ["...", "...", "...", "..."], "answer": 1, "why": "...", "stop": 0 }] }`,
    ``,
    `Rules:`,
    `- intro: two or three sentences on what the module covers and why this repo needs it.`,
    `- 4 to 7 stops. Each is one excerpt of 10 to 45 lines from one file. start and end are 1-based line numbers at the commit, both included. Check every range with git show before you answer.`,
    `- anchor: a short piece of text copied exactly from one line inside start..end.`,
    `- body: 60 to 160 words. What the code does, then the ${lang.name} feature it shows${me.compare ? `, then how ${me.compare} would do it` : ""}. Plain words. Point to another module by number when it teaches a feature in depth.`,
    `- Exactly 5 quiz questions, exactly 4 choices each. They test the ${lang.name} feature using this repo's code, not trivia about the repo. Wrong choices are what ${me.compare ? `a ${me.compare} developer` : "a learner"} would plausibly guess. Spread the right answers across all four positions. answer is the right choice's index, 0 to 3. stop is the index of the stop the question comes from. why is one or two sentences on why that choice is right and the tempting one is wrong.`,
    onlyJson,
  ].join("\n");
}

/** Writes a module's practice exercises. */
export function exercisesPrompt(course, mod, entry, number, lang, me) {
  const prefix = entry.id.slice(0, 2);
  return [
    `You are writing practice exercises for module ${number}, "${entry.title}", of a ${lang.name} course taught from this repo, "${course.name}". ${me.who}`,
    readAt(course.commit),
    ``,
    `The module's stops:`,
    mod.stops.map((s, i) => `${i + 1}. ${s.title}: ${s.file} lines ${s.start}-${s.end}`).join("\n"),
    ``,
    lang.practice.rules,
    ``,
    `Rules:`,
    `- 0 to 3 exercises. Start with the simplest form of the feature and end with the form the repo uses.`,
    `- If one plain file cannot show this module's ideas (project setup, databases, web hosting, test runners), reply with {"exercises": []}.`,
    `- Each needs 1 to 15 lines from the learner. Use simple names from the repo's domain.`,
    `- ids start with "${prefix}-", then a short lowercase slug.`,
    `- source points at the real code the exercise mirrors: { "file": "path", "start": 1, "end": 20, "anchor": "text copied exactly from a line in the range" }, at the commit.`,
    `- Every solution is run and must pass. Every starter is run and must not pass.`,
    ``,
    `The JSON: { "exercises": [ ... ] }`,
    onlyJson,
  ].join("\n");
}

/** Sends problems back, in the same chat, for a corrected reply. */
export function fixPrompt(problems) {
  return [
    `Your JSON has these problems:`,
    ...problems.map(p => `- ${p}`),
    ``,
    `Check the code again with git show where a problem is about lines. Then reply with the whole corrected JSON, nothing else.`,
  ].join("\n");
}

// ---- lesson chat --------------------------------------------------------------------------

/** The frame for a new lesson chat: who the learner is and how to answer. */
export function framePrompt(course, mod, number, lang, me) {
  return [
    `You are helping someone learn ${lang.name}. ${me.who}`,
    `This is module ${number}, "${mod.title}", of a ${lang.name} course taught from this repo, "${course.name}".`,
    `Answer in simple words, in under 150 words unless asked for more.${compareNote(me)} Quote only short code.`,
    readAt(course.commit),
  ].join("\n");
}

/** One question about one stop. */
export function stopPrompt(stop, index, question) {
  return [
    `The learner is on stop ${index + 1}, "${stop.title}": ${stop.file} lines ${stop.start}-${stop.end}.`,
    `The lesson text they just read:`,
    stop.body,
    ``,
    `Their question: ${question}`,
  ].join("\n");
}

// ---- practice chat ------------------------------------------------------------------------

const LEVELS = [
  "Level 1: name the concept and which part of the task to look at again. Do not point at line numbers and show no code.",
  "Level 2: point at the line that is wrong, or the first missing piece, and say why.",
  "Level 3: show the fix for that one line or piece only, as a short code snippet.",
];
// Hints past the third keep going one piece at a time.
const MORE = "Show the fix for the next wrong line or missing piece only, as a short code snippet. Pick one your earlier hints did not cover. If they already fixed what you pointed at, move to what is still failing.";

/** The last run, in words. */
function runState(ex, result) {
  if (!result) return "It has not been run yet.";
  if (result.timedOut) return "The last run took too long (maybe an endless loop).";
  if (!result.compiled) return `The last run did not compile:\n${[
    ...result.errors.map(e => `line ${e.line ?? "?"}: ${e.code} ${e.text}`),
    ...result.broken.map(b => `check "${b.check}" could not compile: ${b.code} ${b.text}`)].join("\n")}`;
  if (result.passed) return "The last run passed.";
  if (ex.kind === "program") return `The last run printed:\n${result.actual}\nExpected:\n${result.expected}${result.crash ? `\nIt crashed: ${result.crash}` : ""}`;
  return `Check results:\n${result.checks.map(c => `${c.ok ? "PASS" : "FAIL"} ${c.name}${c.why ? ` (${c.why})` : ""}`).join("\n")}`;
}

/** What the learner is working on: the exercise, their file and the last run. Never the solution. */
function practiceContext(ex, source, result, lang, me) {
  return [
    `You are helping someone learn ${lang.name}. ${me.who}`,
    `They are doing a practice exercise in a file named ${lang.practice.file}. Do not read or change any file.`,
    `Exercise: ${ex.title}`,
    ex.prompt,
    `The concept: ${ex.concept}`,
    ex.checks ? `The hidden checks they must pass:\n${ex.checks}` : `The program must print exactly:\n${ex.expected}`,
    ``,
    `Their file now, with line numbers:`,
    String(source).replace(/\r/g, "").split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n"),
    ``,
    runState(ex, result),
    ``,
  ];
}

/** Hint number `n` for a practice exercise. The first three step up. Every later one gives one more piece. */
export function hintPrompt(ex, source, result, n, lang, me) {
  return [
    ...practiceContext(ex, source, result, lang, me),
    n <= 3 ? `Give hint level ${n} of 3. ${LEVELS[n - 1]}` : `Give hint ${n}. ${MORE}`,
    `Under 60 words. Never give the whole answer.${compareNote(me)} Plain text or short markdown.`,
  ].join("\n");
}

/** The learner's own question about a practice exercise. */
export function practiceQuestionPrompt(ex, source, result, question, lang, me) {
  return [
    ...practiceContext(ex, source, result, lang, me),
    `Their question: ${question}`,
    `Answer it in simple words, under 150 words.${compareNote(me)} Quote only short code.`,
    `Do not write the whole solution. If they ask for it, say the x key shows it.`,
  ].join("\n");
}
