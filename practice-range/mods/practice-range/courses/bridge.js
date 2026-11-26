import { appHome, exec } from "herdr";
import { practiceDirectory } from "../bridge.js";

/** @param {string} action @param {Record<string, unknown>} [request] @returns {Promise<any>} */
export async function courseCommand(action, request = {}) {
  const result = await exec("node", [`${appHome()}/mods/practice-range/courses/service.mjs`, practiceDirectory(), action, JSON.stringify(request)], { timeout: 240000 });
  let data;
  try { data = JSON.parse(result.stdout); }
  catch { throw new Error(result.stderr || "The course runner did not return a result."); }
  if (result.code !== 0 || data.error) throw new Error(data.error || result.stderr || "The course action failed.");
  return data;
}
