// Preserve the content an enrollment was written against when a new course version ships.
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { validatePack } from "./loader.mjs";

const pathOf = path => path instanceof URL ? fileURLToPath(path) : path;
const archivePath = (file, id, version) => join(dirname(pathOf(file)), "archive", encodeURIComponent(id), `${version}.json`);
const serialize = pack => JSON.stringify(pack, null, 2) + "\n";
async function readPack(path) { return validatePack(JSON.parse(await readFile(path, "utf8"))); }

export async function readCoursePack(file, id, version) {
  const current = await readPack(file);
  if (current.id !== id) throw new Error("Course registry identity does not match its pack.");
  if (!version || version === current.contentVersion) return current;
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(version)) throw new Error("Invalid course content version.");
  let archived;
  try { archived = await readPack(archivePath(file, id, version)); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    throw new Error(`Course version ${version} is not installed. Restore its pack to resume. Your progress has been preserved.`);
  }
  if (archived.id !== id || archived.contentVersion !== version || archived.languageId !== current.languageId) throw new Error("Archived course identity does not match the enrollment.");
  return archived;
}

export async function writeCoursePack(file, pack) {
  validatePack(pack);
  let previous;
  try { previous = await readPack(file); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (previous) {
    if (previous.id !== pack.id || previous.languageId !== pack.languageId) throw new Error("Cannot replace a different course or language pack.");
    if (previous.contentVersion === pack.contentVersion) {
      if (serialize(previous) !== serialize(pack)) throw new Error("Course content changed. Bump runtimeContentVersion before rebuilding so existing enrollments retain their lessons.");
      return;
    }
    const archive = archivePath(file, previous.id, previous.contentVersion);
    await mkdir(dirname(archive), { recursive: true });
    try { await writeFile(archive, serialize(previous), { flag: "wx" }); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (serialize(await readPack(archive)) !== serialize(previous)) throw new Error("Archived course content disagrees with the installed version. No pack was replaced.");
    }
  }
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, serialize(pack)); await rename(temporary, file); }
  finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}
