// The login's one-time values (PKCE): a random secret, its hash, and the address the browser opens.
import { sha256 } from "./sha256.js";
import { AUTHORIZE_URL, REDIRECT_URI, SCOPES } from "./constants.js";

/** The runtime has btoa and crypto.getRandomValues, but the mod's type library does not list them. */
const runtime = () => /** @type {{ btoa: (s: string) => string, crypto: { getRandomValues: (a: Uint8Array) => void } }} */ (/** @type {unknown} */ (globalThis));

/** Base64 with the URL-safe alphabet and no padding. @param {Uint8Array} bytes */
function base64url(bytes) {
  return runtime().btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** A random URL-safe string made from `byteCount` random bytes. @param {number} byteCount */
function randomToken(byteCount) {
  const bytes = new Uint8Array(byteCount);
  runtime().crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** The hash Spotify compares against the verifier later. @param {string} verifier */
export function challengeFor(verifier) {
  return base64url(sha256(Uint8Array.from(verifier, (ch) => ch.charCodeAt(0))));
}

/**
 * One login attempt. `verifier` stays in the mod and proves the later token request is ours.
 * `state` comes back on the redirect and proves the redirect answers this attempt.
 * @typedef {{ clientId: string, verifier: string, state: string, url: string }} LoginAttempt
 * @param {string} clientId
 * @returns {LoginAttempt}
 */
export function newLoginAttempt(clientId) {
  const verifier = randomToken(48);
  const state = randomToken(12);
  const query = [
    ["client_id", clientId],
    ["response_type", "code"],
    ["redirect_uri", REDIRECT_URI],
    ["scope", SCOPES.join(" ")],
    ["state", state],
    ["code_challenge_method", "S256"],
    ["code_challenge", challengeFor(verifier)],
  ].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return { clientId, verifier, state, url: `${AUTHORIZE_URL}?${query}` };
}

/**
 * Reads the redirect Spotify sent the browser to. Accepts the listener's "/callback?..." or a
 * whole pasted address. Returns the login code, or why there is none.
 * @param {string} text
 * @param {string} expectedState
 * @returns {{ code: string } | { error: string }}
 */
export function readRedirect(text, expectedState) {
  const at = text.indexOf("?");
  if (at < 0) return { error: "That address has no login code in it." };
  /** @type {Record<string, string>} */
  const params = {};
  for (const pair of text.slice(at + 1).trim().split("#")[0].split("&")) {
    const eq = pair.indexOf("=");
    if (eq > 0) params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  if (params.error) return { error: params.error === "access_denied" ? "Spotify login was cancelled." : `Spotify said: ${params.error}` };
  if (!params.code) return { error: "That address has no login code in it." };
  if (params.state !== expectedState) return { error: "That address is from a different login attempt. Start again." };
  return { code: params.code };
}
