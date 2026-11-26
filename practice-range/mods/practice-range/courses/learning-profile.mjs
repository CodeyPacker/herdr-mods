import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function knownLanguages(input) {
  if (!Array.isArray(input) || input.length > 8 || input.some(value => typeof value !== "string" || !/^[\p{L}\p{N}+#./ -]{1,40}$/u.test(value.trim()))) throw new Error("Enter up to eight language names, each 1–40 characters, separated by commas.");
  const names = [], seen = new Set();
  for (const value of input) {
    const name=value.trim(), key=name.toLowerCase();
    if (!seen.has(key)) { names.push(name); seen.add(key); }
  }
  return names;
}

export async function readLearningProfile(root) {
  try {
    const data=JSON.parse(await readFile(join(root,"learning.json"),"utf8"));
    if (data?.version !== 1) throw new Error("unsupported profile");
    return { configured:true, knownLanguages:knownLanguages(data.knownLanguages) };
  } catch (error) {
    if (error.code === "ENOENT") return { configured:false, knownLanguages:[] };
    return { configured:true, knownLanguages:[], error:"The learning profile could not be read. Course lessons still work. Restore learning.json from a backup before changing these preferences." };
  }
}
