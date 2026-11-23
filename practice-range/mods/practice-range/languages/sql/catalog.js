import { tables } from "./dataset.js";
import { select } from "./content/select.js";
import { where } from "./content/where.js";
import { sorting } from "./content/sorting.js";
import { functions } from "./content/functions.js";
import { aggregates } from "./content/aggregates.js";
import { grouping } from "./content/grouping.js";
import { caseTopic } from "./content/case.js";
import { joins } from "./content/joins.js";
import { subqueries } from "./content/subqueries.js";
import { setops } from "./content/setops.js";
import { modify } from "./content/modify.js";
import { ddl } from "./content/ddl.js";
import { ctes } from "./content/ctes.js";
import { windows } from "./content/windows.js";
import { dates } from "./content/dates.js";
import { json } from "./content/json.js";
import { arrays } from "./content/arrays.js";
import { upsert } from "./content/upsert.js";
import { views } from "./content/views.js";
import { advanced } from "./content/advanced.js";

export const topics = [select, where, sorting, functions, aggregates, grouping, caseTopic, joins, subqueries, setops, modify, ddl,
  ctes, windows, dates, json, arrays, upsert, views, advanced];

/** @type {import("./types.js").CatalogExercise[]} */
export const exercises = topics.flatMap(topic => topic.exercises.map(exercise => ({
  starter: "-- Write your SQL here. Save to check.", ...exercise,
  id: `${topic.id}/${exercise.id}`, topicId: topic.id,
  declarations: [exercise.tables.length ? tables(...exercise.tables) : "", exercise.setup ? `-- Added for this exercise:\n${exercise.setup.trim()}` : ""].filter(Boolean).join("\n\n") || undefined,
})));
