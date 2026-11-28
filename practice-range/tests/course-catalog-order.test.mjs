import { test } from "node:test";
import assert from "node:assert/strict";
import { sortCourses } from "../mods/practice-range/courses/catalog.js";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";

test("courses sort by completion percentage, with started courses before untouched ties", () => {
  const courses = [
    { id: "untouched", total: 10 },
    { id: "started", total: 10, done: 0, enrolledVersion: "1" },
    { id: "csharp", total: 19, done: 1 },
    { id: "half", total: 4, done: 2 },
    { id: "finished", total: 2, done: 2 },
    { id: "same-percent", total: 10, done: 5 },
  ];
  assert.deepEqual(sortCourses(courses).map(course => course.id), ["finished", "half", "same-percent", "csharp", "started", "untouched"]);
  assert.equal(courses[0].id, "untouched", "Sorting must preserve its input");
});

test("the SQL course is titled SQL", async () => {
  assert.equal((await loadCourse("course:sql-foundations")).title, "SQL");
});
