import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";
import { readCoursePack, writeCoursePack } from "../mods/practice-range/courses/storage.mjs";
import { courseCommand, enrollmentDirectory } from "../mods/practice-range/courses/service.mjs";

test("course updates retain old content and reject changes under an existing version", async t => {
  const root = await mkdtemp(join(tmpdir(), "herdr-course-version-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = await loadCourse("course:ts-foundations"), file = join(root, "pack.json");
  await writeCoursePack(file, original);
  await writeCoursePack(file, original);
  const changed = structuredClone(original);
  changed.title = "Updated foundations";
  await assert.rejects(writeCoursePack(file, changed), /Bump runtimeContentVersion/);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), original);
  changed.contentVersion = "0.1.0-preview.2";
  await writeCoursePack(file, changed);
  assert.deepEqual(await readCoursePack(file, original.id), changed);
  assert.deepEqual(await readCoursePack(file, original.id, original.contentVersion), original);
  await assert.rejects(readCoursePack(file, original.id, "9.0.0"), /progress has been preserved/);
  await assert.rejects(readCoursePack(file, original.id, "../../elsewhere"), /Invalid course content version/);
  assert.deepEqual(await readCoursePack(file, original.id), changed);
});

test("enrollment records its chosen version and an unavailable version cannot overwrite progress", async t => {
  const root = await mkdtemp(join(tmpdir(), "herdr-course-pin-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const courseId = "course:ts-foundations", pack = await loadCourse(courseId);
  await courseCommand(root, "enroll", { courseId });
  await courseCommand(root, "open", { courseId, moduleId: `${courseId}/module/values`, step: 2 });
  const file = join(enrollmentDirectory(root, pack), "enrollment.json"), before = await readFile(file, "utf8");
  const [summary] = (await courseCommand(root, "list")).courses;
  assert.equal(summary.enrolledVersion, pack.contentVersion);
  assert.ok(summary.versions.includes(pack.contentVersion));
  await assert.rejects(courseCommand(root, "enroll", { courseId, contentVersion: "9.0.0" }), /progress has been preserved/);
  assert.equal(await readFile(file, "utf8"), before);
  assert.equal((await courseCommand(root, "status", {courseId})).enrollment.position.step, 2);
});
