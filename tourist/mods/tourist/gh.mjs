#!/usr/bin/env node
// Runs gh as the signed-in account that owns the repo, whichever account gh has active.
//
//   node gh.mjs <gh arguments>
//
// A computer can have two GitHub accounts signed in to gh, such as a personal and a work one.
// gh uses the active one for everything, so a tour of a personal repo while the work account is
// active would post and merge as the wrong person, and would not see the pull request as yours.
// When the repo's owner is itself a signed-in account, this passes that account's token to gh
// for the one call. Any other owner (an organization) uses the active account, as gh would.
// A mod cannot set a program's environment, which is why this is a script of its own.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

/** The owner the call is about: from -R, from a "repos/<owner>/..." API path, else from origin here. */
function owner() {
  const at = args.indexOf("-R");
  if (at >= 0 && args[at + 1]) return args[at + 1].split("/")[0];
  for (const arg of args) {
    const m = /^\/?repos\/([^/]+)\//.exec(arg);
    if (m) return m[1];
  }
  const r = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", windowsHide: true });
  return /github\.com[:/]([^/\s]+)\//.exec(r.stdout ?? "")?.[1] ?? "";
}

const env = { ...process.env };
const name = owner();
// A token already given by the person wins. The name goes to gh as one argument, never a shell.
if (!env.GH_TOKEN && /^[A-Za-z0-9-]{1,39}$/.test(name)) {
  const token = spawnSync("gh", ["auth", "token", "--user", name], { encoding: "utf8", windowsHide: true });
  if (token.status === 0 && token.stdout.trim()) env.GH_TOKEN = token.stdout.trim();
}
const r = spawnSync("gh", args, { env, stdio: "inherit", windowsHide: true });
if (r.error) { console.error(r.error.message); process.exit(127); }
process.exit(r.status ?? 1);
