// Playback commands. Each resolves to null when Spotify accepted it, or to a message to show.
import { apiSend } from "./api.js";

/** @typedef {"off" | "context" | "track"} RepeatMode off, the whole playlist or album, or the one track */

/** @param {"PUT" | "POST"} method @param {string} path @param {Record<string, unknown>} [body] @returns {Promise<string | null>} */
async function command(method, path, body) {
  try {
    const r = await apiSend(method, path, body);
    if (r.status >= 200 && r.status < 300) return null;
    if (r.status === 0) return "Sign in to Spotify first.";
    if (r.status === 404) return "No active Spotify device. Open Spotify, or pick a device (d).";
    if (r.status === 429) return "Spotify is limiting requests. Try again in a moment.";
    // 403 covers both a free account and a command Spotify will not allow right now.
    if (r.status === 403) return r.data?.error?.reason === "PREMIUM_REQUIRED" ? "Controls need Spotify Premium." : r.data?.error?.message ?? "Spotify refused that.";
    return r.data?.error?.message ?? `Spotify answered ${r.status}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export const play = () => command("PUT", "/me/player/play");
export const pause = () => command("PUT", "/me/player/pause");
export const next = () => command("POST", "/me/player/next");
export const previous = () => command("POST", "/me/player/previous");
export const seekTo = (/** @type {number} */ ms) => command("PUT", `/me/player/seek?position_ms=${Math.max(0, Math.round(ms))}`);
export const setVolume = (/** @type {number} */ percent) => command("PUT", `/me/player/volume?volume_percent=${Math.min(100, Math.max(0, Math.round(percent)))}`);
export const setShuffle = (/** @type {boolean} */ on) => command("PUT", `/me/player/shuffle?state=${on}`);
export const setRepeat = (/** @type {RepeatMode} */ mode) => command("PUT", `/me/player/repeat?state=${mode}`);

/** Plays these tracks, replacing what was playing. @param {string[]} uris */
export const playTracks = (uris) => command("PUT", "/me/player/play", { uris });

/**
 * Plays a playlist or album, from `trackUri` when given, else from its start. What follows
 * the track then comes from that playlist.
 * @param {string} contextUri @param {string} [trackUri]
 */
export const playIn = (contextUri, trackUri) =>
  command("PUT", "/me/player/play", trackUri ? { context_uri: contextUri, offset: { uri: trackUri } } : { context_uri: contextUri });

export const addToQueue = (/** @type {string} */ uri) => command("POST", `/me/player/queue?uri=${encodeURIComponent(uri)}`);

/** Moves playback to another device and keeps playing. @param {string} deviceId */
export const playOn = (deviceId) => command("PUT", "/me/player", { device_ids: [deviceId], play: true });

/**
 * Skips forward `count` tracks. Spotify has no "jump to this queue entry", so this is how a
 * queue entry is reached without losing the queue. Stops at the first refusal.
 * @param {number} count
 */
export async function skipAhead(count) {
  for (let i = 0; i < count; i++) {
    const failed = await next();
    if (failed) return failed;
  }
  return null;
}

/** The mode the repeat button moves to next. @param {RepeatMode} mode @returns {RepeatMode} */
export function nextRepeat(mode) {
  return mode === "off" ? "context" : mode === "context" ? "track" : "off";
}
