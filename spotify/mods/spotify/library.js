// The lists the dialog shows: the queue, playlists, a playlist's tracks, search results and
// devices. Each read returns one page of rows, already reduced to what a row draws.
import { apiGet } from "./api.js";
import { PLAYLIST_PAGE, SEARCH_PAGE } from "./constants.js";

/**
 * @typedef {{ kind: "track", uri: string, title: string, artist: string, album: string, durationMs: number }} TrackRow
 * @typedef {{ kind: "playlist", id: string, uri: string, name: string, owner: string, count: number | null }} PlaylistRow
 * @typedef {{ kind: "device", id: string, name: string, type: string, active: boolean }} DeviceRow
 * @typedef {TrackRow | PlaylistRow | DeviceRow} Row
 */
/**
 * One page. `total` is how many rows exist in all, so the list knows whether to ask for more.
 * @template T
 * @typedef {{ rows: T[], total: number } | { error: string }} Page
 */

/** A song or podcast episode as a row, or null for an entry Spotify could not fill in. @param {any} item @returns {TrackRow | null} */
function toTrackRow(item) {
  if (!item?.uri) return null;
  const isEpisode = item.type === "episode";
  return {
    kind: "track",
    uri: item.uri,
    title: item.name ?? "",
    artist: isEpisode ? item.show?.name ?? "" : (item.artists ?? []).map((/** @type {any} */ a) => a.name).join(", "),
    album: isEpisode ? "" : item.album?.name ?? "",
    durationMs: item.duration_ms ?? 0,
  };
}

/** @param {any[] | undefined} items @returns {TrackRow[]} */
function toTrackRows(items) {
  return (items ?? []).map(toTrackRow).filter((/** @type {TrackRow | null} */ row) => row !== null);
}

/**
 * GETs `path` and builds the page from the body.
 * @template T
 * @param {string} path
 * @param {(data: any) => { rows: T[], total: number }} build
 * @param {string} [forbidden] the message for a 403, when Spotify withholds this list
 * @returns {Promise<Page<T>>}
 */
async function readPage(path, build, forbidden) {
  try {
    const r = await apiGet(path);
    if (r.status === 200) return build(r.data);
    if (r.status === 204) return { rows: [], total: 0 };
    if (r.status === 0) return { error: "Sign in to Spotify first." };
    if (r.status === 403 && forbidden) return { error: forbidden };
    if (r.status === 429) return { error: "Spotify is limiting requests. Try again in a moment." };
    return { error: r.data?.error?.message ?? `Spotify answered ${r.status}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** What plays next, in order. Spotify sends the whole list (up to 20) at once. @returns {Promise<Page<TrackRow>>} */
export function readQueue() {
  return readPage("/me/player/queue", (data) => {
    const rows = toTrackRows(data?.queue);
    return { rows, total: rows.length };
  });
}

/** The id the Liked Songs row carries in place of a playlist id. */
export const LIKED_ID = "liked";

/**
 * Liked Songs as a playlist row. Spotify keeps them apart from playlists (/me/tracks, not
 * /me/playlists) and plays them as the account's "collection", which needs the user id.
 * Null when either read fails, so the playlists still show without it.
 * @returns {Promise<PlaylistRow | null>}
 */
async function readLikedRow() {
  try {
    const [me, liked] = await Promise.all([apiGet("/me"), apiGet("/me/tracks?limit=1")]);
    if (me.status !== 200 || !me.data?.id || liked.status !== 200) return null;
    return { kind: "playlist", id: LIKED_ID, uri: `spotify:user:${me.data.id}:collection`, name: "Liked Songs", owner: "You", count: liked.data?.total ?? null };
  } catch {
    return null;
  }
}

/**
 * The person's playlists, their own and the ones they follow, with Liked Songs first.
 * `offset` counts the Liked Songs row, since the list asks for the next page by how many rows it has.
 * @param {number} offset @returns {Promise<Page<PlaylistRow>>}
 */
export async function readPlaylists(offset) {
  if (offset > 0) {
    const page = await readPlaylistPage(offset - 1);
    return "error" in page ? page : { rows: page.rows, total: page.total + 1 };
  }
  const [liked, page] = await Promise.all([readLikedRow(), readPlaylistPage(0)]);
  if (!liked || "error" in page) return page;
  return { rows: [liked, ...page.rows], total: page.total + 1 };
}

/** One page of /me/playlists. @param {number} offset @returns {Promise<Page<PlaylistRow>>} */
function readPlaylistPage(offset) {
  return readPage(`/me/playlists?limit=${PLAYLIST_PAGE}&offset=${offset}`, (data) => ({
    total: data?.total ?? 0,
    rows: (data?.items ?? []).filter(Boolean).map((/** @type {any} */ p) => ({
      kind: "playlist",
      id: p.id,
      uri: p.uri,
      name: p.name ?? "",
      owner: p.owner?.display_name ?? p.owner?.id ?? "",
      // Spotify renamed the track count's field from "tracks" to "items" in 2026.
      count: p.items?.total ?? p.tracks?.total ?? null,
    })),
  }));
}

/**
 * A playlist's tracks. Spotify only lists them for playlists the person owns or works on.
 * @param {string} playlistId @param {number} offset @returns {Promise<Page<TrackRow>>}
 */
export function readPlaylistTracks(playlistId, offset) {
  if (playlistId === LIKED_ID) {
    return readPage(`/me/tracks?limit=${PLAYLIST_PAGE}&offset=${offset}`, (data) => ({
      total: data?.total ?? 0,
      rows: toTrackRows((data?.items ?? []).map((/** @type {any} */ entry) => entry?.track)),
    }));
  }
  return readPage(`/playlists/${encodeURIComponent(playlistId)}/items?limit=${PLAYLIST_PAGE}&offset=${offset}`, (data) => ({
    total: data?.total ?? 0,
    // Each entry wraps its track in "item" ("track" before 2026).
    rows: toTrackRows((data?.items ?? []).map((/** @type {any} */ entry) => entry?.item ?? entry?.track)),
  }), "Spotify does not list this playlist's tracks, because you do not own it. Enter plays it from the start.");
}

/** Songs matching `query`. Spotify allows at most 10 per request. @param {string} query @param {number} offset @returns {Promise<Page<TrackRow>>} */
export function searchTracks(query, offset) {
  return readPage(`/search?q=${encodeURIComponent(query)}&type=track&limit=${SEARCH_PAGE}&offset=${offset}`, (data) => ({
    total: data?.tracks?.total ?? 0,
    rows: toTrackRows(data?.tracks?.items),
  }));
}

/** The devices Spotify is open on. @returns {Promise<Page<DeviceRow>>} */
export function readDevices() {
  return readPage("/me/player/devices", (data) => {
    const rows = (data?.devices ?? []).filter((/** @type {any} */ d) => d?.id && !d.is_restricted).map((/** @type {any} */ d) => ({
      kind: "device", id: d.id, name: d.name ?? "", type: d.type ?? "", active: Boolean(d.is_active),
    }));
    return { rows, total: rows.length };
  });
}
