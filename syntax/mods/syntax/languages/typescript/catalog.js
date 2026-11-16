import { variables } from "./content/variables.js";
import { primitives } from "./content/primitives.js";
import { strings } from "./content/strings.js";
import { operators } from "./content/operators.js";
import { narrowing } from "./content/narrowing.js";
import { loops } from "./content/loops.js";
import { arrays } from "./content/arrays.js";
import { objects } from "./content/objects.js";
import { functions } from "./content/functions.js";
import { classes } from "./content/classes.js";
import { interfaces } from "./content/interfaces.js";
import { unions } from "./content/unions.js";
import { callbacks } from "./content/callbacks.js";
import { modules } from "./content/modules.js";
import { generics } from "./content/generics.js";
import { async } from "./content/async.js";
import { utility } from "./content/utility.js";
import { typeOperators } from "./content/typeOperators.js";
import { mappedTypes } from "./content/mappedTypes.js";
import { guards } from "./content/guards.js";

export const topics = [variables, primitives, strings, operators, narrowing, loops, arrays, objects, functions, classes, interfaces, unions,
  callbacks, modules, generics, async, utility, typeOperators, mappedTypes, guards];
/** @type {import("./types.js").CatalogExercise[]} */
export const exercises = topics.flatMap(topic => topic.exercises.map(exercise => ({
  starter: "// Write your answer here.", ...exercise,
  id: `${topic.id}/${exercise.id}`, topicId: topic.id,
})));
