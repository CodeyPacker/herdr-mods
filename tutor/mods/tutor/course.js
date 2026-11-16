// Where courses live, and reading the repo a course is built on.
// Each course is a folder under data/tutor/courses/<slug>: course.json, modules/<id>.json,
// exercises/<id>.json and progress.json. state.json names the course shown when Tutor opens.
import { appHome, exec, readTextFile } from "herdr";
import * as fs from "fs/promises";

export const dataDir = () => `${appHome()}/data/tutor`.replace(/\\/g, "/");
const coursesDir = () => `${dataDir()}/courses`;
export const courseDir = slug => `${coursesDir()}/${slug}`;
const statePath = () => `${dataDir()}/state.json`;

/** A folder name for a repo and language: the repo's name plus a short hash of its path. */
export function slugFor(root, language) {
  const key = `${String(root).toLowerCase()}|${language}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  const name = String(root).split("/").filter(Boolean).pop()?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "repo";
  return `${name}-${language}-${h.toString(36).slice(0, 6)}`;
}

/** A JSON file, or null when it is missing. Throws with the path when it is broken. */
async function readJson(path) {
  const text = await readTextFile(path).catch(() => null);
  if (text === null) return null;
  try { return JSON.parse(text.replace(/^﻿/, "")); }
  catch (e) { throw new Error(`${path} is broken: ${e?.message ?? e}`); }
}

async function writeJson(path, value) {
  await fs.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await fs.writeFile(path, JSON.stringify(value, null, 2));
}

/** The slug of the course Tutor shows, or null before the first course. */
export async function currentSlug() {
  return (await readJson(statePath()).catch(() => null))?.current ?? null;
}

export const setCurrent = slug => writeJson(statePath(), { current: slug });

export const loadCourse = slug => readJson(`${courseDir(slug)}/course.json`);
export const saveCourse = (slug, course) => writeJson(`${courseDir(slug)}/course.json`, course);
/** A module's file, or null when it is not written yet. */
export const loadModule = (slug, id) => readJson(`${courseDir(slug)}/modules/${id}.json`);
export const saveModule = (slug, id, mod) => writeJson(`${courseDir(slug)}/modules/${id}.json`, mod);
/** A module's exercises, or null when they are not written yet. [] means the module has none. */
export async function loadExercises(slug, id) {
  const file = await readJson(`${courseDir(slug)}/exercises/${id}.json`);
  return file ? (Array.isArray(file.exercises) ? file.exercises : []) : null;
}
export const saveExercises = (slug, id, exercises) => writeJson(`${courseDir(slug)}/exercises/${id}.json`, { module: id, exercises });

/** Every course on disk as { slug, course }, newest first. Broken ones are left out. */
export async function listCourses() {
  const names = await fs.readdir(coursesDir()).catch(() => []);
  const out = [];
  for (const slug of names) {
    const course = await loadCourse(slug).catch(() => null);
    if (course?.root && Array.isArray(course.modules)) out.push({ slug, course });
  }
  return out.sort((a, b) => String(b.course.createdAt ?? "").localeCompare(String(a.course.createdAt ?? "")));
}

const git = (dir, args) => exec("git", ["-C", dir, ...args], { timeout: 60000 })
  .catch(e => ({ code: 1, stdout: "", stderr: String(e?.message ?? e) }));

/**
 * The repo that holds `path`: { root, name, commit, count }. `commit` is HEAD, which the course
 * is pinned to. `count` is how many of the language's files it has. Throws one plain sentence.
 */
export async function repoInfo(path, lang) {
  const dir = String(path ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!dir) throw new Error("Pick a folder first.");
  const top = await git(dir, ["rev-parse", "--show-toplevel"]);
  if (top.code !== 0) throw new Error(`${dir} is not inside a git repo.`);
  const root = top.stdout.trim().replace(/\\/g, "/");
  const head = await git(root, ["rev-parse", "HEAD"]);
  if (head.code !== 0) throw new Error(`${root} has no commits yet.`);
  const files = await git(root, ["ls-files", "--", ...lang.sources]);
  const count = files.code === 0 ? files.stdout.split("\n").filter(Boolean).length : 0;
  if (!count) throw new Error(`${root} has no ${lang.name} files (${lang.sources.join(", ")}).`);
  return { root, name: root.split("/").pop() || root, commit: head.stdout.trim(), count };
}

/** Null when the repo and commit are there, else one sentence naming the problem. */
export async function checkRepo(root, commit) {
  if ((await git(root, ["rev-parse", "--git-dir"])).code !== 0) return `The repo is not at ${root}. Lessons need it to show code.`;
  if ((await git(root, ["cat-file", "-e", `${commit}^{commit}`])).code !== 0) return `The pinned commit ${commit.slice(0, 7)} is not in ${root}. Run git fetch there.`;
  return null;
}
