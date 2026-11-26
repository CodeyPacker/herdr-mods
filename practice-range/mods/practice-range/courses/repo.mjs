// Attachments are machine-local. All repository operations read a pinned commit.
import { execFile } from "node:child_process";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join, basename, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";

function git(root, args, timeout = 20000) {
  return new Promise((resolve, reject) => execFile("git", ["-C", root, ...args], { timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) reject(new Error((stderr || error.message).trim())); else resolve(stdout);
  }));
}
const attachmentFile = directory => join(directory, "attachments.json");
const sourceExtensions = { typescript: [".ts", ".tsx", ".mts", ".cts"], csharp: [".cs"], sql: [".sql"] };
function sourcePaths(paths, languageId) {
  const extensions = sourceExtensions[languageId] ?? [];
  return paths.filter(path => extensions.some(extension => path.endsWith(extension)) && !path.endsWith(".d.ts") &&
    !path.split("/").some(part => ["node_modules", "bin", "obj", "dist", "build", "vendor"].includes(part)));
}
async function attachment(directory) {
  try {
    const record = JSON.parse(await readFile(attachmentFile(directory), "utf8"));
    if (record.version !== 1 || typeof record.root !== "string" || !record.root || typeof record.name !== "string" ||
        !sourceExtensions[record.languageId] || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(record.commit)) throw new Error("The local repo attachment is damaged. Attach the folder again.");
    return record;
  } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function attachRepo(directory, languageId, input) {
  if (typeof input !== "string" || !input.trim()) throw new Error("Enter a local git repo folder.");
  let root;
  try { root = (await git(input.trim(), ["rev-parse", "--show-toplevel"])).trim(); }
  catch { throw new Error("That folder is not an available local git repo."); }
  let commit;
  try { commit = (await git(root, ["rev-parse", "HEAD"])).trim(); }
  catch { throw new Error("That repo has no readable commit yet. The bundled course is still available."); }
  const files = sourcePaths((await git(root, ["ls-tree", "-r", "-z", "--name-only", commit])).split("\0").filter(Boolean), languageId);
  if (!files.length) throw new Error(`The pinned commit has no ${languageId} source files to learn from.`);
  const record = { version: 1, root, name: basename(root), commit, languageId };
  const file = attachmentFile(directory), temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(record, null, 2) + "\n"); await rename(temporary, file); }
  finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}

export async function detachRepo(directory) {
  await unlink(attachmentFile(directory)).catch(error => { if (error.code !== "ENOENT") throw error; });
}

/** Browse a referenced file at its pinned commit. Never read the working tree. */
export async function readRepoSource(directory, ref, cachedCode, line) {
  if (!ref || typeof ref.path !== "string" || !ref.path || ref.path.includes("\0") ||
      !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(ref.commit) ||
      !Number.isInteger(ref.start) || !Number.isInteger(ref.end) || ref.start < 1 || ref.end < ref.start) throw new Error("Invalid source reference.");
  if (line !== undefined && (!Number.isSafeInteger(line) || line < 1)) throw new Error("Choose a valid source line.");
  const base = { path: ref.path, commit: ref.commit, referenceStart: ref.start, referenceEnd: ref.end };
  try {
    const record = await attachment(directory);
    if (!record) throw new Error("unavailable");
    const key = `${ref.commit}:${ref.path}`;
    const size = Number(await git(record.root, ["cat-file", "-s", key], 2000));
    if (!Number.isSafeInteger(size) || size > 256000) throw new Error("too large");
    const content = (await git(record.root, ["show", key], 2000)).replaceAll("\r\n", "\n");
    if (content.includes("\0")) throw new Error("binary");
    const lines = content.split("\n");
    if (ref.end > lines.length) throw new Error("range unavailable");
    const start = Math.min(line ?? Math.max(1, ref.start - 20), lines.length);
    const end = Math.min(start + 119, lines.length);
    return { ...base, start, end, total: lines.length, code: lines.slice(start - 1, end).join("\n"),
      previous: start > 1 ? Math.max(1, start - 120) : null, next: end < lines.length ? end + 1 : null };
  } catch {
    return { ...base, start: ref.start, end: ref.end, total: null, code: cachedCode ?? "", previous: null, next: null,
      detail: cachedCode === null ? "The pinned file is unavailable or too large to browse. No saved excerpt is available. Attach a clone containing this commit to read it." :
        "The pinned file is unavailable or too large to browse. Showing the saved excerpt. Attach a clone containing this commit to browse the file." };
  }
}

/** Read the exact referenced lines. A cache is scoped to one import or display snapshot. */
export async function readPinnedExcerpt(root, ref, cache = new Map()) {
  try {
    if (!root || !isAbsolute(root) || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(ref.commit)) throw new Error("unavailable");
    const key=`${ref.commit}:${ref.path}`;
    if(!cache.has(key)) cache.set(key,git(root,["show",key],2000));
    const lines=(await cache.get(key)).replaceAll("\r\n","\n").split("\n");
    const selected=lines.slice(ref.start-1,ref.end);
    if(ref.end>lines.length || (ref.anchor&&!selected.some(line=>line.includes(ref.anchor)))) throw new Error("range or anchor unavailable");
    return {code:selected.join("\n")||"// Empty source excerpt.",readOnly:true,repoRef:ref};
  } catch { return {code:"// The pinned source excerpt is unavailable on this computer.",readOnly:true,repoRef:ref,sourceError:"The repo, pinned commit, range or anchor is unavailable. The imported explanation is preserved."}; }
}

export async function restoreRepoExcerpts(directory, lessons) {
  if(!lessons.some(lesson=>Object.values(lesson.examples).some(example=>example.sourceError&&example.repoRef))) return lessons;
  let record;
  try { record=await attachment(directory); } catch { return lessons; }
  if(!record) return lessons;
  const cache=new Map(), restored=[];
  for(const lesson of lessons) {
    const examples={...lesson.examples};
    for(const [id,example] of Object.entries(examples)) if(example.sourceError&&example.repoRef) examples[id]=await readPinnedExcerpt(record.root,example.repoRef,cache);
    restored.push({...lesson,examples});
  }
  return restored;
}

export async function repoStatus(directory) {
  try {
    const record = await attachment(directory);
    if (!record) return null;
    try {
      await git(record.root, ["cat-file", "-e", `${record.commit}^{commit}`], 2000);
      return { name: record.name, commit: record.commit, available: true };
    } catch { return { name: record.name, commit: record.commit, available: false, detail: "The repo or pinned commit is unavailable. Bundled lessons still work." }; }
  } catch (error) { return { available: false, detail: error.message }; }
}

/** A bounded sample, not a claim to have analyzed the entire repository. No absolute path is sent. */
export async function repositoryContext(directory) {
  try {
    const record = await attachment(directory);
    if (!record) return null;
    const paths = sourcePaths((await git(record.root, ["ls-tree", "-r", "-z", "--name-only", record.commit], 2000)).split("\0").filter(Boolean), record.languageId);
    const files = [];
    let budget = 48000;
    const deadline = Date.now() + 5000;
    for (const path of paths.slice(0, 16)) {
      if (Date.now() > deadline) break;
      if (Number(await git(record.root, ["cat-file", "-s", `${record.commit}:${path}`], 2000)) > 128000) continue;
      const text = await git(record.root, ["show", `${record.commit}:${path}`], 2000);
      if (text.length > 128000 || text.includes("\0")) continue;
      const lines = text.replaceAll("\r\n", "\n").split("\n");
      const selected = lines.slice(0, 160).join("\n");
      if (selected.length > budget) continue;
      files.push({ path, start: 1, end: Math.min(lines.length, 160), code: selected });
      budget -= selected.length;
    }
    return { name: record.name, commit: record.commit, available: true, files,
      scope: `Sampled ${files.length} of ${paths.length} source files. Each excerpt is at most 160 lines. Other files and later lines were not examined.` };
  } catch { return { available: false, detail: "The local repo context is unavailable. Use bundled examples." }; }
}
