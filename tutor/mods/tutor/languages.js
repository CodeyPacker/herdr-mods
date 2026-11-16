// The languages a course can teach. Everything that depends on the language sits in its entry.
// To add one, write lang/<id>.js with the same shape as lang/csharp.js and list it here.
import { csharp } from "./lang/csharp.js";

export const LANGUAGES = { csharp };
export const DEFAULT_LANGUAGE = "csharp";

/** The language entry for a course, or null when the course names one Tutor does not have. */
export const languageOf = course => LANGUAGES[course?.language] ?? null;
