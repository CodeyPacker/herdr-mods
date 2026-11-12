// Fixed values the mod reads from. No state lives here.

/** The mod's folder name under ~/.config/herdr-app/mods. */
export const MOD = "spotify";

/** Every user registers this exact address in their Spotify developer app. */
export const REDIRECT_PORT = 43821;
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;

/** Spotify's brand green, for its logo. */
export const SPOTIFY_GREEN = "#1DB954";

export const DASHBOARD_URL = "https://developer.spotify.com/dashboard";
export const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const TOKEN_URL = "https://accounts.spotify.com/api/token";

/** What the mod asks Spotify for: read and control playback, read playlists and saved tracks. */
export const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
];

export const API_URL = "https://api.spotify.com/v1";
/** Album art is only downloaded from Spotify's image host. */
export const ART_URL_PATTERN = /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/;

/** The slot asks Spotify what is playing this often while music plays. */
export const POLL_MS = 5000;
/** With nothing playing, or after an error, it asks on every Nth turn instead (30 s). */
export const IDLE_POLL_EVERY = 6;

/** Rows per request for playlists and their tracks. */
export const PLAYLIST_PAGE = 50;
/** Rows per search request. Spotify allows at most 10. */
export const SEARCH_PAGE = 10;
/** The [ and ] keys jump this far in the track. */
export const SEEK_STEP_MS = 10_000;
/** The - and = keys change the volume by this many percent. */
export const VOLUME_STEP = 5;

/** The pointer must rest on the slot this long before the card opens, so passing over it doesn't flash the card. */
export const CARD_OPEN_DELAY = 350;
/** The card stays this long after the pointer leaves, which lets the pointer cross from the slot to the card. */
export const CARD_CLOSE_DELAY = 300;
/** After a slider drag, the card waits this long for the pointer to be reported back before closing. */
export const CARD_AFTER_DRAG_DELAY = 1500;

/** The progress bar's range: a position in the track from 0 to this. */
export const SEEK_STEPS = 1000;

/** After a command, wait this long before asking Spotify for the new state. */
export const SETTLE_MS = 700;

/** How long the person has to approve in the browser. */
export const LOGIN_SECONDS = 180;
/** Refresh the access token when it has less than this left. */
export const REFRESH_EARLY_MS = 60_000;

/** A Spotify client ID is 32 hex characters. */
export const CLIENT_ID_PATTERN = /^[0-9a-f]{32}$/i;

/**
 * The setup steps a new user follows. `link`: an address shown after the text that opens in
 * the browser. `copy`: a value shown after the text that a click copies.
 * @type {{ text: string, link?: string, copy?: string }[]}
 */
export const SETUP_STEPS = [
  { text: "Open the Spotify developer dashboard and log in:", link: DASHBOARD_URL },
  { text: "Click Create app. The name and description can be anything." },
  { text: "Set the redirect URI to exactly this:", copy: REDIRECT_URI },
  { text: "Tick Web API, then save." },
  { text: "Copy the Client ID and paste it below." },
];

/** How long "Copied" shows after the redirect URI is copied. */
export const COPIED_MS = 2000;

export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
