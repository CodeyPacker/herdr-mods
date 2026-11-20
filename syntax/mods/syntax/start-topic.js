// Opening Practice Range at a topic, for another mod (Tutor) that opens its tab with
//   run("tab.new", { name: "Practice Range", mod: "syntax", props: { practiceTab: true, startTopic: { languageId, topicId } } })
// Anything missing or wrong opens Practice Range as usual, so callers need no version check.
import { languages } from "./languages/index.js";
import { catalogFor } from "./catalog.js";

/**
 * The topic to open, or null. Only a finished setup with that language enabled jumps; a
 * language still to set up goes through setup as usual.
 * @param {unknown} request @param {{ completed: boolean, enabled: string[] }} status
 * @returns {{ languageId: string, topicId: string } | null}
 */
export function startTopic(request, status) {
  if (!request || typeof request !== "object" || !status.completed) return null;
  const { languageId, topicId } = /** @type {Record<string, unknown>} */ (request);
  if (typeof languageId !== "string" || typeof topicId !== "string" || !status.enabled.includes(languageId)) return null;
  const language = languages.find(language => language.id === languageId);
  if (!language || !catalogFor(language).topics.some(topic => topic.id === topicId)) return null;
  return { languageId, topicId };
}

/** Every bundled language and its topics, for a mod choosing where to send the learner. */
export function topicList() {
  return languages.map(language => ({ id: language.id, name: language.name,
    topics: catalogFor(language).topics.map(topic => ({ id: topic.id, title: topic.title, description: topic.description ?? "" })) }));
}
