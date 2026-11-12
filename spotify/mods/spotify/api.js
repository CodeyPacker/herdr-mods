// Signed-in requests to the Spotify Web API.
import { API_URL } from "./constants.js";
import { freshAuth } from "./auth.js";

/**
 * `status` 0 means signed out (nothing was sent). 204 is Spotify's "nothing to report".
 * @typedef {{ status: number, data: any }} ApiResult
 */

/**
 * Sends a command, such as PUT "/me/player/pause". Throws only when the network or the token refresh fails.
 * @param {"PUT" | "POST"} method
 * @param {string} path
 * @param {Record<string, unknown>} [body] sent as JSON
 * @returns {Promise<ApiResult>}
 */
export async function apiSend(method, path, body) {
  const auth = await freshAuth();
  if (!auth) return { status: 0, data: null };
  /** @type {Record<string, string>} */
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  if (body) headers["Content-Type"] = "application/json";
  // With no body, the empty string makes the request carry a length of 0, which Spotify requires on commands.
  const r = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : "" });
  /** @type {any} */
  let data = null;
  try { data = await r.json(); } catch { /* commands answer with an empty body */ }
  return { status: r.status, data };
}

/**
 * GETs an API path such as "/me/player". Throws only when the network or the token refresh fails.
 * @param {string} path
 * @returns {Promise<ApiResult>}
 */
export async function apiGet(path) {
  const auth = await freshAuth();
  if (!auth) return { status: 0, data: null };
  const r = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${auth.access_token}` } });
  if (r.status === 204) return { status: 204, data: null };
  /** @type {any} */
  let data = null;
  try { data = await r.json(); } catch { /* an empty or non-JSON body */ }
  return { status: r.status, data };
}
