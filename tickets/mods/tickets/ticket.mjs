#!/usr/bin/env node
// ticket: the command agents and people use to create and update tickets for the tickets mod.
//
//   node ticket.mjs create "<title>" [--desc "<text>"] [--criteria "<text>"]... [--after <number>]... [--base <branch>] [--tour]
//   node ticket.mjs auto <number>... [--off]         Herdr starts an agent on these when they are ready
//   node ticket.mjs tour <number>... [--off]         Herdr opens a Tourist review of their pull request
//   node ticket.mjs project <branch>                 makes the project branch on origin, from its default branch
//   node ticket.mjs worktree <number>                makes (or finds) the ticket's worktree and prints its path
//   node ticket.mjs list
//   node ticket.mjs show <number>
//   node ticket.mjs edit <number> [--title "<text>"] [--desc "<text>"] [--criteria "<text>"]... [--after <number>]...
//   node ticket.mjs start <number> [--terminal <address>]   work begins, by the agent in that Herdr terminal
//   node ticket.mjs move <number> <todo|doing|blocked|review|done>
//   node ticket.mjs block <number> "<question>"      needs an answer before work can go on
//   node ticket.mjs submit <number> "<summary>"      work is finished and ready for review
//   node ticket.mjs answer <number> "<answer>"       answers a blocked ticket's question, work goes on
//   node ticket.mjs changes <number> "<feedback>"    review found things to change, work goes on
//   node ticket.mjs approve <number> [--keep-agent]  review passed, the ticket is done
//
// --after names a ticket that must be done first. A ticket set to auto is started by the mod's
// slot, in a Herdr tab, once every ticket it waits on is done.
//
// --base names a project branch on origin. Such a ticket is worked on in its own worktree, on
// branch ticket/<base>/<number>, cut from origin/<base>. submit pushes that branch and opens a
// pull request into <base>, and approve merges it (if it is not merged yet), then removes the
// worktree and the branch. A ticket without --base is worked on in the repo's own checkout.
//
// answer and changes also send the text to the ticket's agent when it still runs, and approve
// ends that agent (unless --keep-agent), so the board and Tourist need not do it themselves.
//
// Every command takes --json (machine output) and --in <folder> (the repo, default: where you are).
// `board --json [--for <folder>]` prints every project, for the mod.
//
// A project is one repo. Its worktrees share it, since the key comes from the main checkout.
// Tickets are one JSON file each, under ~/.config/herdr-app/data/tickets/<project>/<number>.json.
import { mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} Ticket
 * @property {number} number
 * @property {string} title
 * @property {string} description
 * @property {string[]} criteria what must be true for the ticket to be done
 * @property {string} status one of STATUSES' ids
 * @property {string} question what a blocked ticket is waiting on
 * @property {string} [answer] the answer to the question, kept beside it until the next question or submit
 * @property {string} [feedback] what a review asked to change, kept until the next submit
 * @property {string} summary what was done, given on submit
 * @property {string} terminal the Herdr terminal of the agent working on it ("t7"), or ""
 * @property {number[]} [needs] the tickets that must be done before this one starts
 * @property {boolean} [auto] true: Herdr starts an agent on it when it is ready
 * @property {string} [base] the project branch on origin its pull request goes into
 * @property {boolean} [tour] true: Herdr opens a Tourist review of its pull request when it reaches review
 * @property {number} [pr] its pull request's number, once submit opened one
 * @property {string} [prUrl] that pull request's address
 * @property {string} created ISO time
 * @property {string} updated ISO time
 */
/** @typedef {{ key: string, name: string, root: string, dir: string }} Project */

/** The board's columns, in order. */
const STATUSES = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

/** Where every project's tickets live. HERDR_TICKETS_DIR moves it, for tests. */
function dataDir() {
  if (process.env.HERDR_TICKETS_DIR) return resolve(process.env.HERDR_TICKETS_DIR);
  const app = process.env.HERDR_APP_HOME ?? join(homedir(), ".config", "herdr-app");
  return join(app, "data", "tickets");
}

/** A problem to report to whoever ran the command, without a stack trace. */
class Problem extends Error {}

/**
 * The repo's main checkout, so every worktree of a repo gives the same folder.
 * Outside a git repo it is the folder itself.
 * @param {string} folder
 */
function repoRoot(folder) {
  try {
    const out = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: folder, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) return basename(out) === ".git" ? dirname(out) : out;
  } catch {}
  return resolve(folder);
}

/** The project a folder belongs to. @param {string} folder @returns {Project} */
function projectFor(folder) {
  const root = resolve(repoRoot(folder));
  const same = root.replace(/\\/g, "/");
  // Windows paths do not care about case, so two spellings of one folder are one project.
  const id = process.platform === "win32" ? same.toLowerCase() : same;
  const name = basename(root) || "root";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const key = `${slug}-${createHash("sha1").update(id).digest("hex").slice(0, 8)}`;
  return { key, name, root: same, dir: join(dataDir(), key) };
}

/** Makes the project's folder, with a file that says which repo it is for. @param {Project} p */
function ensureProject(p) {
  mkdirSync(p.dir, { recursive: true });
  const file = join(p.dir, "project.json");
  if (!existsSync(file)) writeFileSync(file, JSON.stringify({ name: p.name, root: p.root }, null, 2));
}

/** Every ticket in a project folder, lowest number first. Files that do not parse are skipped. @param {string} dir @returns {Ticket[]} */
function readTickets(dir) {
  if (!existsSync(dir)) return [];
  /** @type {Ticket[]} */
  const tickets = [];
  for (const file of readdirSync(dir)) {
    if (!/^\d+\.json$/.test(file)) continue;
    try { tickets.push(JSON.parse(readFileSync(join(dir, file), "utf8"))); } catch {}
  }
  return tickets.sort((a, b) => a.number - b.number);
}

/** @param {Project} p @param {string} text the number as typed, with or without "#" @returns {Ticket} */
function readTicket(p, text) {
  const number = Number(String(text ?? "").replace(/^#/, ""));
  if (!Number.isInteger(number) || number < 1) throw new Problem(`"${text ?? ""}" is not a ticket number.`);
  const file = join(p.dir, `${number}.json`);
  if (!existsSync(file)) throw new Problem(`No ticket #${number} in ${p.name}. Run "list" to see the tickets.`);
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Saves a changed ticket. It writes a new file and swaps it in, so a reader never sees half a ticket. @param {Project} p @param {Ticket} ticket */
function saveTicket(p, ticket) {
  ticket.updated = new Date().toISOString();
  const file = join(p.dir, `${ticket.number}.json`);
  const draft = `${file}.${process.pid}.tmp`;
  writeFileSync(draft, JSON.stringify(ticket, null, 2));
  renameSync(draft, file);
}

/**
 * Makes a ticket with the next free number. The file is created only if it does not exist yet,
 * so two agents creating at once get different numbers.
 * @param {Project} p @param {{ title: string, description: string, criteria: string[], needs?: number[] }} fields @returns {Ticket}
 */
function createTicket(p, fields) {
  ensureProject(p);
  const now = new Date().toISOString();
  let number = (readTickets(p.dir).at(-1)?.number ?? 0) + 1;
  for (;;) {
    /** @type {Ticket} */
    const ticket = { number, ...fields, status: "todo", question: "", summary: "", terminal: "", created: now, updated: now };
    try {
      writeFileSync(join(p.dir, `${number}.json`), JSON.stringify(ticket, null, 2), { flag: "wx" });
      return ticket;
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code !== "EEXIST") throw e;
      number += 1;
    }
  }
}

/** Every project that has a folder, with its tickets. */
function readBoard() {
  const root = dataDir();
  mkdirSync(root, { recursive: true });
  // The worktrees folder holds tickets' checkouts, not a project.
  return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== WORKTREES).map((d) => {
    const dir = join(root, d.name);
    let info = { name: d.name, root: "" };
    try { info = { ...info, ...JSON.parse(readFileSync(join(dir, "project.json"), "utf8")) }; } catch {}
    return { key: d.name, name: info.name, root: info.root, tickets: readTickets(dir) };
  });
}

/** The folder in dataDir() that holds every ticket's worktree, by project key. */
const WORKTREES = "worktrees";
/** This script, for the commands an agent is told to run. */
const SCRIPT = fileURLToPath(import.meta.url).replace(/\\/g, "/");

/**
 * Runs a program with its arguments as a list, never through a shell, so ticket text cannot
 * become a command. `err` is its error output, else its output, else why it could not start.
 * @param {string} cmd @param {string[]} args @param {string} [cwd]
 */
function call(cmd, args, cwd) {
  // git and gh act as the account that owns the repo, when that account is signed in (see accountFor).
  const account = cwd && (cmd === "git" || cmd === "gh") ? accountFor(cwd) : null;
  const env = cmd === "gh" && account ? { ...process.env, GH_TOKEN: account.token } : process.env;
  if (cmd === "git" && account) args = ["-c", `credential.https://github.com.username=${account.name}`, ...args];
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", windowsHide: true });
  const out = (r.stdout ?? "").trim();
  return { ok: r.status === 0, out, err: (r.stderr ?? "").trim() || out || (r.error ? r.error.message : `${cmd} exited with ${r.status}`) };
}

/** @type {Map<string, { name: string, token: string } | null>} the answer per folder, since it takes two programs to find */
const accounts = new Map();

/**
 * The signed-in GitHub account that owns the repo in `cwd`, with its token, or null.
 * gh can have two accounts signed in (a personal and a work one) and uses the active one for
 * everything. A pull request on a personal repo must not come from the work account, so when
 * origin's owner is itself a signed-in account, that account is used. Any other owner (an
 * organization) gets null, which leaves the active account in charge.
 * @param {string} cwd
 */
function accountFor(cwd) {
  if (accounts.has(cwd)) return accounts.get(cwd) ?? null;
  let found = null;
  if (!process.env.GH_TOKEN) {
    const url = spawnSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8", windowsHide: true }).stdout ?? "";
    const name = /github\.com[:/]([^/\s]+)\//.exec(url)?.[1] ?? "";
    if (/^[A-Za-z0-9-]{1,39}$/.test(name)) {
      const token = spawnSync("gh", ["auth", "token", "--user", name], { encoding: "utf8", windowsHide: true });
      if (token.status === 0 && (token.stdout ?? "").trim()) found = { name, token: token.stdout.trim() };
    }
  }
  accounts.set(cwd, found);
  return found;
}

/** call, but a failure is a Problem that starts with `what`. @param {string} what @param {string} cmd @param {string[]} args @param {string} [cwd] */
function must(what, cmd, args, cwd) {
  const r = call(cmd, args, cwd);
  if (!r.ok) throw new Problem(`${what}: ${r.err}`);
  return r.out;
}

/** Waits without a busy loop. @param {number} ms */
const sleep = (ms) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };

/**
 * A branch name from the person or an agent, checked before it reaches git: letters, digits,
 * ".", "_" and "-", in parts split by "/". Returns it. @param {string} name
 */
function checkBranch(name) {
  const ok = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(name) && name.length <= 100
    && !name.includes("..") && !/(\.|\.lock)(\/|$)/.test(name);
  if (!ok) throw new Problem(`"${name}" cannot be a project branch. Use letters, digits, ".", "_", "-" and "/", like "branch-mod".`);
  return name;
}

/** The branch a ticket with a base is worked on. @param {Ticket} t */
const ticketBranch = (t) => `ticket/${t.base}/${t.number}`;

/** Where a ticket with a base is checked out. @param {Project} p @param {Ticket} t */
const worktreePath = (p, t) => join(dataDir(), WORKTREES, p.key, String(t.number)).replace(/\\/g, "/");

/**
 * Makes the ticket's worktree, cut from origin/<base> after a fetch, or finds the one it has.
 * A branch left from an earlier worktree is checked out again, so its commits are kept.
 * @param {Project} p @param {Ticket} t @returns {string} its path
 */
function ensureWorktree(p, t) {
  if (!t.base) throw new Problem(`#${t.number} has no project branch (--base). Its agent works in the repo's own checkout.`);
  const path = worktreePath(p, t);
  if (existsSync(join(path, ".git"))) return path;
  const branch = ticketBranch(t);
  must(`Could not fetch ${t.base} from origin`, "git", ["fetch", "--quiet", "origin", t.base], p.root);
  // A worktree folder that was deleted by hand is still listed until pruned, and blocks the path.
  call("git", ["worktree", "prune"], p.root);
  mkdirSync(dirname(path), { recursive: true });
  const kept = call("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], p.root).ok;
  must("Could not make the ticket's worktree", "git",
    kept ? ["worktree", "add", path, branch] : ["worktree", "add", "--no-track", "-b", branch, path, `origin/${t.base}`], p.root);
  return path;
}

/**
 * Pushes a finished ticket's branch, and opens its pull request into the base when it has none.
 * Refuses uncommitted work, since only commits reach the pull request.
 * @param {Project} p @param {Ticket} t @param {string} summary the pull request's body
 */
function pushTicket(p, t, summary) {
  const path = worktreePath(p, t), branch = ticketBranch(t);
  if (!existsSync(join(path, ".git"))) throw new Problem(`#${t.number} has no worktree at ${path}. Start the ticket again from the board.`);
  const on = call("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], path).out;
  if (on !== branch) throw new Problem(`The worktree is on ${on || "a detached HEAD"}, not ${branch}. Switch back to ${branch}, then submit again.`);
  const dirty = must("Could not read the worktree's status", "git", ["status", "--porcelain"], path);
  if (dirty) throw new Problem(`The worktree has changes that are not committed. Commit your work on ${branch} (or remove what does not belong), then submit again.\n${dirty}`);
  must(`Could not push ${branch}`, "git", ["push", "--quiet", "-u", "origin", `refs/heads/${branch}:refs/heads/${branch}`], path);
  if (t.pr) return;
  const made = call("gh", ["pr", "create", "--base", t.base ?? "", "--head", branch, "--title", `#${t.number} ${t.title}`, "--body", summary], path);
  // gh prints the new pull request's address. One that already exists is named in its refusal.
  const url = /https?:\/\/\S+?\/pull\/\d+/.exec(made.ok ? made.out : made.err)?.[0];
  if (!url) throw new Problem(`Pushed ${branch}, but gh did not open a pull request: ${made.err}`);
  t.pr = Number(/\/pull\/(\d+)/.exec(url)?.[1]);
  t.prUrl = url;
}

/**
 * Merges a ticket's pull request unless it is merged already. Tries squash, then a merge commit,
 * then rebase, since a repo may allow only some. Throws GitHub's reasons when none works.
 * @param {Project} p @param {Ticket} t
 */
function mergeTicket(p, t) {
  if (!t.pr || !t.prUrl) throw new Problem(`#${t.number} has no pull request. Its agent opens one with submit.`);
  const view = must(`Could not read PR #${t.pr}`, "gh", ["pr", "view", t.prUrl, "--json", "state"], p.root);
  let state = "";
  try { state = String(JSON.parse(view).state ?? ""); } catch {}
  if (state === "MERGED") return;
  if (state !== "OPEN") throw new Problem(`PR #${t.pr} is ${state.toLowerCase() || "in an unknown state"}, not open, so it cannot be merged. Reopen it on GitHub first.`);
  /** @type {string[]} */
  const refused = [];
  for (const method of ["squash", "merge", "rebase"]) {
    const r = call("gh", ["pr", "merge", t.prUrl, `--${method}`], p.root);
    if (r.ok) return;
    refused.push(`${method}: ${r.err}`);
  }
  throw new Problem(`GitHub did not merge PR #${t.pr}, so #${t.number} stays in review.\n${refused.join("\n")}`);
}

/**
 * Removes a done ticket's worktree and its local branch. The pull request has its commits.
 * Returns what could not be done.
 * @param {Project} p @param {Ticket} t @returns {string[]}
 */
function cleanUp(p, t) {
  const path = worktreePath(p, t), branch = ticketBranch(t);
  if (existsSync(path)) {
    let r = call("git", ["worktree", "remove", "--force", path], p.root);
    // An agent that was just ended can hold the folder for a moment (Windows will not delete a folder in use).
    for (let i = 0; i < 8 && !r.ok; i++) { sleep(500); r = call("git", ["worktree", "remove", "--force", path], p.root); }
    if (!r.ok) return [`Could not remove the worktree at ${path}: ${r.err}`];
  }
  if (!call("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], p.root).ok) return [];
  const gone = call("git", ["branch", "-D", branch], p.root);
  return gone.ok ? [] : [`Could not delete the branch ${branch}: ${gone.err}`];
}

/**
 * The ticket's agent terminal, when it still runs and was started for this ticket. A ticket only
 * names a terminal ("t7"), and Herdr gives a finished terminal's name to a new one, so the
 * terminal must also have been started with this ticket's first message.
 * @param {Ticket} t @returns {string | null}
 */
function liveAgent(t) {
  if (!t.terminal) return null;
  const r = call("hc", ["get", t.terminal, "--json"]);
  if (!r.ok) return null;
  try {
    const info = JSON.parse(r.out);
    if (info.state === "finished" || !JSON.stringify(info.argv ?? "").includes(`Work on ticket #${t.number}:`)) return null;
    return t.terminal;
  } catch { return null; }
}

/**
 * Sends an answer or requested changes to the ticket's agent, as one line, since a new line
 * would submit early. Long text is left on the ticket for the agent to read.
 * @param {Ticket} t @param {string} lead @param {string} text
 * @returns {{ forwarded: boolean, forwardError?: string }}
 */
function forward(t, lead, text) {
  const terminal = liveAgent(t);
  if (!terminal) return { forwarded: false };
  const how = "Carry on with the ticket, and submit it again when it is done.";
  const message = text.includes("\n")
    ? `${lead} on ticket #${t.number}. Read it in full with \`node "${SCRIPT}" show ${t.number}\`. ${how}`
    : `${lead} on ticket #${t.number}: "${text}". ${how}`;
  const sent = call("hc", ["send", terminal, message, "--json"]);
  return sent.ok ? { forwarded: true } : { forwarded: false, forwardError: sent.err };
}

/** Splits the arguments into plain words and --flags. --criteria can repeat. @param {string[]} argv */
function parse(argv) {
  /** @type {string[]} */
  const words = [];
  /** @type {{ json: boolean, in: string, for: string, desc: string | null, title: string | null, terminal: string, base: string, criteria: string[], after: string[], off: boolean, tour: boolean, keepAgent: boolean }} */
  const flags = { json: false, in: "", for: "", desc: null, title: null, terminal: "", base: "", criteria: [], after: [], off: false, tour: false, keepAgent: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") flags.json = true;
    else if (arg === "--off") flags.off = true;
    else if (arg === "--tour") flags.tour = true;
    else if (arg === "--keep-agent") flags.keepAgent = true;
    else if (["--in", "--for", "--desc", "--title", "--terminal", "--base", "--criteria", "--after"].includes(arg)) {
      const value = argv[++i];
      if (value === undefined) throw new Problem(`${arg} needs a value.`);
      if (arg === "--criteria") flags.criteria.push(value);
      else if (arg === "--after") flags.after.push(value);
      else flags[/** @type {"in" | "for" | "desc" | "title" | "terminal" | "base"} */ (arg.slice(2))] = value;
    } else if (arg.startsWith("--")) throw new Problem(`Unknown option ${arg}.`);
    else words.push(arg);
  }
  return { words, flags };
}

/**
 * The tickets named with --after, as numbers. Each must exist and must not be the ticket itself.
 * @param {Project} p @param {string[]} after @param {number} [self] @returns {number[]}
 */
function needsFrom(p, after, self) {
  const needs = [...new Set(after.map((text) => readTicket(p, text).number))];
  if (self !== undefined && needs.includes(self)) throw new Problem(`#${self} cannot wait on itself.`);
  return needs.sort((a, b) => a - b);
}

/** One ticket as a line: "#3  doing    Fix the login bug". @param {Ticket} t */
const line = (t) => `#${String(t.number).padEnd(4)} ${t.status.padEnd(8)} ${t.title}`;

/** One ticket in full, for a person or an agent to read. @param {Ticket} t */
function describe(t) {
  const out = [`#${t.number} ${t.title}`, `Status: ${t.status}`];
  if (t.description) out.push("", t.description);
  if (t.criteria.length) out.push("", "Done when:", ...t.criteria.map((c) => `- ${c}`));
  if (t.needs?.length) out.push("", `Waits on: ${t.needs.map((n) => `#${n}`).join(", ")}`);
  if (t.auto) out.push("", "Auto: Herdr starts an agent on it when it is ready.");
  if (t.base) out.push("", `Project branch: ${t.base}. Worked on in its own worktree, on branch ${ticketBranch(t)}.`);
  if (t.pr) out.push(`Pull request: #${t.pr}${t.prUrl ? ` ${t.prUrl}` : ""}`);
  if (t.tour) out.push(`Tour: Herdr opens a Tourist review of its pull request when it reaches review.`);
  if (t.question) out.push("", `Question: ${t.question}`);
  if (t.answer) out.push(`Answer: ${t.answer}`);
  if (t.feedback) out.push("", `Changes requested: ${t.feedback}`);
  if (t.summary) out.push("", `Summary: ${t.summary}`);
  if (t.terminal) out.push("", `Agent: ${t.terminal}`);
  return out.join("\n");
}

const USAGE = `Usage: node ticket.mjs <command>
  create "<title>" [--desc "<text>"] [--criteria "<text>"]... [--after <number>]... [--base <branch>] [--tour]
  auto <number>... [--off]
  tour <number>... [--off]
  project <branch>
  worktree <number>
  list
  show <number>
  edit <number> [--title "<text>"] [--desc "<text>"] [--criteria "<text>"]... [--after <number>]...
  start <number> [--terminal <address>]
  move <number> <${STATUSES.map((s) => s.id).join("|")}>
  block <number> "<question>"
  submit <number> "<summary>"
  answer <number> "<answer>"
  changes <number> "<feedback>"
  approve <number> [--keep-agent]
Options: --json, --in <folder> (the repo, default: the current folder)`;

/** @param {string[]} argv */
function main(argv) {
  const { words, flags } = parse(argv);
  const [command, first, second] = words;
  /** Prints the result: JSON with --json, else the text. @param {unknown} data @param {string} text */
  const print = (data, text) => console.log(flags.json ? JSON.stringify(data, null, 2) : text);

  if (!command || command === "help") return console.log(USAGE);
  if (command === "board") {
    return print({ statuses: STATUSES, current: flags.for ? projectFor(flags.for).key : null, projects: readBoard() }, "board prints JSON. Add --json.");
  }

  const project = projectFor(flags.in || process.cwd());
  if (command === "create") {
    if (!first?.trim()) throw new Problem('create needs a title: create "<title>"');
    const needs = needsFrom(project, flags.after);
    const base = flags.base ? checkBranch(flags.base) : "";
    const ticket = createTicket(project, { title: first.trim(), description: (flags.desc ?? "").trim(), criteria: flags.criteria.map((c) => c.trim()).filter(Boolean),
      ...(needs.length ? { needs } : {}), ...(base ? { base } : {}), ...(flags.tour ? { tour: true } : {}) });
    return print(ticket, `Created #${ticket.number} in ${project.name}: ${ticket.title}`);
  }
  if (command === "auto" || command === "tour") {
    const numbers = words.slice(1);
    if (!numbers.length) throw new Problem(`${command} needs ticket numbers: ${command} <number>... [--off]`);
    // Every number is read first, so a wrong one changes nothing.
    const tickets = numbers.map((text) => readTicket(project, text));
    for (const ticket of tickets) { ticket[command] = !flags.off; saveTicket(project, ticket); }
    return print(tickets, `${tickets.map((t) => `#${t.number}`).join(", ")}: ${command} is ${flags.off ? "off" : "on"}.`);
  }
  if (command === "project") {
    const branch = checkBranch(first ?? "");
    const root = project.root;
    if (call("git", ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`], root).ok) {
      return print({ branch, created: false }, `${branch} is already on origin. Nothing to do.`);
    }
    const head = must("Could not read origin's default branch", "git", ["ls-remote", "--symref", "origin", "HEAD"], root);
    const from = /^ref: refs\/heads\/(\S+)\s+HEAD$/m.exec(head)?.[1];
    if (!from) throw new Problem(`Could not tell origin's default branch from: ${head || "no output"}`);
    must(`Could not fetch ${from} from origin`, "git", ["fetch", "--quiet", "origin", from], root);
    must(`Could not push ${branch}`, "git", ["push", "--quiet", "origin", `refs/remotes/origin/${from}:refs/heads/${branch}`], root);
    // So origin/<branch> exists here too.
    must(`Could not fetch ${branch} from origin`, "git", ["fetch", "--quiet", "origin", branch], root);
    return print({ branch, created: true, from }, `Created ${branch} on origin from the tip of ${from}.`);
  }
  if (command === "worktree") {
    const ticket = readTicket(project, first);
    const path = ensureWorktree(project, ticket);
    return print({ number: ticket.number, branch: ticketBranch(ticket), path }, path);
  }
  if (command === "list") {
    const tickets = readTickets(project.dir);
    return print(tickets, tickets.length ? tickets.map(line).join("\n") : `No tickets in ${project.name}.`);
  }
  if (command === "show") {
    const ticket = readTicket(project, first);
    return print(ticket, describe(ticket));
  }
  if (command === "start") {
    const ticket = readTicket(project, first);
    ticket.status = "doing";
    ticket.question = "";
    if (flags.terminal) ticket.terminal = flags.terminal;
    saveTicket(project, ticket);
    return print(ticket, `#${ticket.number} is now doing${ticket.terminal ? `, by ${ticket.terminal}` : ""}.`);
  }
  if (command === "edit") {
    const ticket = readTicket(project, first);
    const criteria = flags.criteria.map((c) => c.trim()).filter(Boolean);
    if (flags.title === null && flags.desc === null && !criteria.length && !flags.after.length) throw new Problem("edit needs something to change: --title, --desc, --criteria or --after.");
    // The given tickets replace the ones it waited on, as with criteria.
    if (flags.after.length) ticket.needs = needsFrom(project, flags.after, ticket.number);
    if (flags.title !== null) {
      if (!flags.title.trim()) throw new Problem("A ticket needs a title.");
      ticket.title = flags.title.trim();
    }
    if (flags.desc !== null) ticket.description = flags.desc.trim();
    // The given criteria replace the list, so one can be reworded or dropped.
    if (criteria.length) ticket.criteria = criteria;
    saveTicket(project, ticket);
    return print(ticket, `Changed #${ticket.number}.`);
  }
  if (command === "move" || command === "block" || command === "submit") {
    const ticket = readTicket(project, first);
    const text = (second ?? "").trim();
    if (command === "move") {
      if (!STATUSES.some((s) => s.id === text)) throw new Problem(`"${text}" is not a status. Use one of: ${STATUSES.map((s) => s.id).join(", ")}.`);
      ticket.status = text;
      // The question belongs to the blocked state. Any other status means it was dealt with.
      if (text !== "blocked") { ticket.question = ""; ticket.answer = ""; }
    } else if (command === "block") {
      if (!text) throw new Problem('block needs the question: block <number> "<question>"');
      ticket.status = "blocked";
      ticket.question = text;
      ticket.answer = "";
    } else {
      if (!text) throw new Problem('submit needs a summary of what was done: submit <number> "<summary>"');
      // The review happens on the pull request, so the work must reach it first.
      if (ticket.base) pushTicket(project, ticket, text);
      ticket.status = "review";
      ticket.question = "";
      ticket.answer = "";
      ticket.feedback = "";
      ticket.summary = text;
    }
    saveTicket(project, ticket);
    return print(ticket, `#${ticket.number} is now ${ticket.status}.`);
  }
  if (command === "answer" || command === "changes" || command === "approve") {
    const ticket = readTicket(project, first);
    const text = (second ?? "").trim();
    // Each of these answers one state, so a stale board or a wrong number cannot skip a step.
    const needs = command === "answer" ? "blocked" : "review";
    if (ticket.status !== needs) throw new Problem(`#${ticket.number} is ${ticket.status}. ${command} needs a ticket that is ${needs}.`);
    if (command === "approve") {
      // The pull request is the work, so it is merged before the ticket counts as done.
      if (ticket.base) mergeTicket(project, ticket);
      ticket.status = "done";
      saveTicket(project, ticket);
      /** @type {string[]} */
      const warnings = [];
      // The agent goes first: its shell sits in the worktree, which cannot be removed while in use.
      const agent = flags.keepAgent ? null : liveAgent(ticket);
      const killed = agent ? call("hc", ["kill", agent, "--json"]) : null;
      if (killed && !killed.ok) warnings.push(`Could not end its agent ${agent}: ${killed.err}`);
      if (ticket.base) warnings.push(...cleanUp(project, ticket));
      const lines = [`#${ticket.number} is now done.`, ...(ticket.base && ticket.pr ? [`PR #${ticket.pr} is merged into ${ticket.base}.`] : []),
        ...(killed?.ok ? [`Ended its agent ${agent}.`] : []), ...warnings];
      return print({ ...ticket, agentEnded: Boolean(killed?.ok), warnings }, lines.join("\n"));
    }
    if (!text) throw new Problem(`${command} needs its text: ${command} <number> "<text>"`);
    ticket.status = "doing";
    if (command === "answer") ticket.answer = text; else ticket.feedback = text;
    saveTicket(project, ticket);
    const sent = forward(ticket, command === "answer" ? "Answer to your question" : "Changes requested", text);
    const note = sent.forwarded ? "Sent to its agent." : sent.forwardError ? `Saved, but it did not reach its agent: ${sent.forwardError}` : "No agent is running on it, so it was only saved.";
    return print({ ...ticket, ...sent }, `#${ticket.number} is now doing. ${note}`);
  }
  throw new Problem(`Unknown command "${command}".\n${USAGE}`);
}

try {
  main(process.argv.slice(2));
} catch (e) {
  if (!(e instanceof Problem)) throw e;
  console.error(e.message);
  process.exit(1);
}
