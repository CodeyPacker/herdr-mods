import { variables } from "./content/variables.js";
import { conversions } from "./content/conversions.js";
import { strings } from "./content/strings.js";
import { operators } from "./content/operators.js";
import { conditionals } from "./content/conditionals.js";
import { loops } from "./content/loops.js";
import { arrays } from "./content/arrays.js";
import { collections } from "./content/collections.js";
import { methods } from "./content/methods.js";
import { classes } from "./content/classes.js";
import { constructors } from "./content/constructors.js";
import { exceptions } from "./content/exceptions.js";
import { generics } from "./content/generics.js";
import { delegates } from "./content/delegates.js";
import { linq } from "./content/linq.js";
import { async } from "./content/async.js";
import { iterators } from "./content/iterators.js";
import { spans } from "./content/spans.js";
import { typeMembers } from "./content/typeMembers.js";
import { patterns } from "./content/patterns.js";

export const topics = [variables, conversions, strings, operators, conditionals, loops, arrays, collections, methods, classes, constructors, exceptions,
  generics, delegates, linq, async, iterators, spans, typeMembers, patterns];
/** @type {import("./types.js").CatalogExercise[]} */
export const exercises = topics.flatMap(topic => topic.exercises.map(exercise => ({
  starter: "        // Write your answer here.", mode: "body", ...exercise,
  id: `${topic.id}/${exercise.id}`, topicId: topic.id,
})));
