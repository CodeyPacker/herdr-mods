// What the learner already knows. Lessons, quizzes and chat compare the course's language to it.
// Each course keeps its own list in course.json as `known`; the first entry that is not the
// course's own language is the one lessons compare to. Plain JavaScript with no Herdr imports.

// Courses written before the setting existed were written for this learner.
export const DEFAULT_KNOWN = ["TypeScript", "JavaScript"];

/** "TypeScript, some SQL" → ["TypeScript", "some SQL"]. Commas, semicolons or new lines split. */
export function parseKnown(text) {
  return String(text ?? "").split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 8);
}

/** ["a", "b", "c"] → "a, b and c". */
export function listText(items) {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const bare = s => String(s).toLowerCase().replace(/^(some|a little|basic|basics of)\s+/, "").replace(/[^a-z0-9#+]/g, "");

/**
 * The learner a course is for: `known` (what they know), `compare` (what lessons compare to,
 * or null), and `who`, the sentence every prompt starts from.
 */
export function learnerOf(course, lang) {
  const known = Array.isArray(course?.known) ? course.known : DEFAULT_KNOWN;
  const self = bare(lang?.name ?? "");
  const compare = known.find(k => bare(k) && bare(k) !== self) ?? null;
  const who = !known.length
    ? `The learner is new to programming and new to ${lang.name}. Explain every idea from the start.`
    : compare
      ? `The learner knows ${listText(known)} and is new to ${lang.name}.`
      : `The learner already knows ${lang.name} and wants to see how this repo uses it.`;
  return { known, compare, who };
}

/** The canned question behind the t key, or null when there is nothing to compare to. */
export const likeKnownQuestion = compare => compare ? `Show the closest ${compare} version of this code and name what differs.` : null;
