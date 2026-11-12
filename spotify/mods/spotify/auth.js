// Signing in and keeping the access token fresh. Talks to Spotify's token address and the store.
import { TOKEN_URL, REDIRECT_URI, REFRESH_EARLY_MS } from "./constants.js";
import { loadAuth, saveAuth, isSignedIn } from "./store.js";

/** @typedef {import("./store.js").Auth} Auth */
/** @typedef {import("./pkce.js").LoginAttempt} LoginAttempt */

/** Posts a form to the token address. Throws Spotify's own message on failure. @param {Record<string, string>} form */
async function tokenRequest(form) {
  const body = Object.entries(form).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  /** @type {any} */
  let json = null;
  try { json = await r.json(); } catch { /* not JSON: reported by status below */ }
  if (!r.ok || !json?.access_token) throw new Error(json?.error_description ?? json?.error ?? `Spotify answered ${r.status}`);
  return json;
}

/** @param {string} clientId @param {any} tokens @param {string} [oldRefreshToken] @returns {Auth} */
function toAuth(clientId, tokens, oldRefreshToken) {
  return {
    client_id: clientId,
    access_token: tokens.access_token,
    // Spotify only sometimes sends a new refresh token. Keep the old one when it does not.
    refresh_token: tokens.refresh_token ?? oldRefreshToken,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
}

/** Trades the login code for tokens and saves them. @param {LoginAttempt} attempt @param {string} code @returns {Promise<Auth>} */
export async function finishLogin(attempt, code) {
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: attempt.clientId,
    code_verifier: attempt.verifier,
  });
  const auth = toAuth(attempt.clientId, tokens);
  await saveAuth(auth);
  return auth;
}

/**
 * The saved sign-in with an access token that is good for at least a minute, refreshed
 * first when needed. Null when signed out. Throws when Spotify refuses the refresh.
 * @returns {Promise<Auth | null>}
 */
export async function freshAuth() {
  const auth = await loadAuth();
  if (!isSignedIn(auth)) return null;
  if (auth.access_token && auth.expires_at - Date.now() > REFRESH_EARLY_MS) return auth;
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: auth.refresh_token, client_id: auth.client_id });
  const next = toAuth(auth.client_id, tokens, auth.refresh_token);
  await saveAuth(next);
  return next;
}

/** Forgets the tokens but remembers the client ID for the next sign-in. @param {string} clientId */
export function signOut(clientId) {
  return saveAuth({ client_id: clientId });
}
