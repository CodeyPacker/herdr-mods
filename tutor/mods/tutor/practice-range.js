// The optional link to Practice Range (the syntax mod): finding its topics, and opening it at one.
// Tutor never needs it. When Practice Range is missing, too old, or Node can't run, there is no link.
import { appHome, exec, readTextFile, run } from "herdr";

const script = () => `${appHome()}/mods/syntax/topics.mjs`.replace(/\\/g, "/");

/**
 * Practice Range's topics for language `id` as [{ id, title, description }], or null when there
 * is no Practice Range, it has no such language, or it can't be asked.
 */
export async function practiceRangeTopics(id) {
  // Reading the script is the check that Practice Range is installed.
  if ((await readTextFile(script()).catch(() => null)) === null) return null;
  const r = await exec("node", [script()], { timeout: 20000 }).catch(() => null);
  if (!r || r.code !== 0) return null;
  try { return topicsFor(JSON.parse(r.stdout), id); } catch { return null; }
}

/** The topics for language `id` in topics.mjs's output, or null. */
export function topicsFor(list, id) {
  const lang = Array.isArray(list?.languages) ? list.languages.find(l => l?.id === id) : null;
  const topics = Array.isArray(lang?.topics) ? lang.topics.filter(t => typeof t?.id === "string" && typeof t?.title === "string") : [];
  return topics.length ? topics : null;
}

/** Opens a Practice Range tab at `topicId`. Versions without the start topic open as usual. */
export function openPracticeRange(languageId, topicId) {
  run("tab.new", { name: "Practice Range", mod: "syntax", props: { practiceTab: true, startTopic: { languageId, topicId } } });
}
