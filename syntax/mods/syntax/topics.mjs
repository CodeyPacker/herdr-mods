// node topics.mjs: prints Practice Range's languages and topics as JSON, for other mods (Tutor).
// { version: 1, languages: [{ id, name, topics: [{ id, title, description }] }] }
import { topicList } from "./start-topic.js";

console.log(JSON.stringify({ version: 1, languages: topicList() }));
