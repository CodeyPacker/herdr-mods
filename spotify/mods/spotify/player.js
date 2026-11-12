// What Spotify is playing now, reduced to what the mod shows.
import { apiGet } from "./api.js";

/**
 * A picture Spotify hosts. `id`, the last part of its address, names the saved file.
 * @typedef {{ url: string, id: string }} Picture
 *
 * @typedef {{ kind: "loading" }} Loading
 * @typedef {{ kind: "signed-out" }} SignedOut
 * @typedef {{ kind: "idle" }} Idle no Spotify app is open, or nothing is loaded in it
 * @typedef {{ kind: "error", message: string }} Failed
 * @typedef {{ kind: "track", uri: string, playing: boolean, title: string, artist: string, album: string,
 *   smallArt: Picture | null, largeArt: Picture | null, progressMs: number, durationMs: number, device: string,
 *   volume: number | null, shuffle: boolean, repeat: import("./controls.js").RepeatMode }} Track
 * @typedef {Loading | SignedOut | Idle | Failed | Track} Playback
 */

/** @param {string | undefined} url @returns {Picture | null} */
function picture(url) {
  return url ? { url, id: url.slice(url.lastIndexOf("/") + 1) } : null;
}

/** @param {any} data the body of GET /me/player @returns {Playback} */
export function toPlayback(data) {
  const item = data?.item;
  if (!item) return { kind: "idle" };
  // A song has artists and an album. A podcast episode has a show.
  const isEpisode = item.type === "episode";
  // Spotify lists pictures widest first: 640, 300 and 64 px for albums.
  /** @type {any[]} */
  const images = (isEpisode ? item.images : item.album?.images) ?? [];
  return {
    kind: "track",
    uri: item.uri ?? "",
    playing: Boolean(data.is_playing),
    title: item.name ?? "",
    artist: isEpisode ? item.show?.name ?? "" : (item.artists ?? []).map((/** @type {any} */ a) => a.name).join(", "),
    album: isEpisode ? "" : item.album?.name ?? "",
    smallArt: picture(images[images.length - 1]?.url),
    largeArt: picture((images[1] ?? images[0])?.url),
    progressMs: data.progress_ms ?? 0,
    durationMs: item.duration_ms ?? 0,
    device: data.device?.name ?? "",
    // Some devices, such as phones, do not let Spotify set their volume.
    volume: data.device?.supports_volume !== false && typeof data.device?.volume_percent === "number" ? data.device.volume_percent : null,
    shuffle: Boolean(data.shuffle_state),
    repeat: data.repeat_state === "context" || data.repeat_state === "track" ? data.repeat_state : "off",
  };
}

/** @returns {Promise<Playback>} */
export async function readPlayback() {
  try {
    const r = await apiGet("/me/player?additional_types=episode");
    if (r.status === 0) return { kind: "signed-out" };
    if (r.status === 204) return { kind: "idle" };
    if (r.status === 200) return toPlayback(r.data);
    if (r.status === 429) return { kind: "error", message: "Spotify is limiting requests. Trying again soon." };
    return { kind: "error", message: r.data?.error?.message ?? `Spotify answered ${r.status}` };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
