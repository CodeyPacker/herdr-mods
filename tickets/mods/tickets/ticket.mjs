#!/usr/bin/env node
// ticket: the command agents and people use to create and update tickets for the tickets mod.
//
//   node ticket.mjs create "<title>" [--desc "<text>"] [--criteria "<text>"]...
//   node ticket.mjs list
//   node ticket.mjs show <number>
//   node ticket.mjs start <number> [--terminal <address>]   work begins, by the agent in that Herdr terminal
//   node ticket.mjs move <number> <todo|doing|blocked|review|done>
//   node ticket.mjs block <number> "<question>"      needs an answer before work can go on
//   node ticket.mjs submit <number> "<summary>"      work is finished and ready for review
//   node ticket.mjs answer <number> "<answer>"       answers a blocked ticket's question, work goes on
//   node ticket.mjs changes <number> "<feedback>"    review found things to change, work goes on
//   node ticket.mjs approve <number>                 review passed, the ticket is done
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
import { execFileSync } from "node:child_process";

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
 * @param {Project} p @param {{ title: string, description: string, criteria: string[] }} fields @returns {Ticket}
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
  return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const dir = join(root, d.name);
    let info = { name: d.name, root: "" };
    try { info = { ...info, ...JSON.parse(readFileSync(join(dir, "project.json"), "utf8")) }; } catch {}
    return { key: d.name, name: info.name, root: info.root, tickets: readTickets(dir) };
  });
}

/** Splits the arguments into plain words and --flags. --criteria can repeat. @param {string[]} argv */
function parse(argv) {
  /** @type {string[]} */
  const words = [];
  /** @type {{ json: boolean, in: string, for: string, desc: string, terminal: string, criteria: string[] }} */
  const flags = { json: false, in: "", for: "", desc: "", terminal: "", criteria: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") flags.json = true;
    else if (arg === "--in" || arg === "--for" || arg === "--desc" || arg === "--terminal" || arg === "--criteria") {
      const value = argv[++i];
      if (value === undefined) throw new Problem(`${arg} needs a value.`);
      if (arg === "--criteria") flags.criteria.push(value);
      else flags[/** @type {"in" | "for" | "desc" | "terminal"} */ (arg.slice(2))] = value;
    } else if (arg.startsWith("--")) throw new Problem(`Unknown option ${arg}.`);
    else words.push(arg);
  }
  return { words, flags };
}

/** One ticket as a line: "#3  doing    Fix the login bug". @param {Ticket} t */
const line = (t) => `#${String(t.number).padEnd(4)} ${t.status.padEnd(8)} ${t.title}`;

/** One ticket in full, for a person or an agent to read. @param {Ticket} t */
function describe(t) {
  const out = [`#${t.number} ${t.title}`, `Status: ${t.status}`];
  if (t.description) out.push("", t.description);
  if (t.criteria.length) out.push("", "Done when:", ...t.criteria.map((c) => `- ${c}`));
  if (t.question) out.push("", `Question: ${t.question}`);
  if (t.answer) out.push(`Answer: ${t.answer}`);
  if (t.feedback) out.push("", `Changes requested: ${t.feedback}`);
  if (t.summary) out.push("", `Summary: ${t.summary}`);
  if (t.terminal) out.push("", `Agent: ${t.terminal}`);
  return out.join("\n");
}

const USAGE = `Usage: node ticket.mjs <command>
  create "<title>" [--desc "<text>"] [--criteria "<text>"]...
  list
  show <number>
  start <number> [--terminal <address>]
  move <number> <${STATUSES.map((s) => s.id).join("|")}>
  block <number> "<question>"
  submit <number> "<summary>"
  answer <number> "<answer>"
  changes <number> "<feedback>"
  approve <number>
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
    const ticket = createTicket(project, { title: first.trim(), description: flags.desc.trim(), criteria: flags.criteria.map((c) => c.trim()).filter(Boolean) });
    return print(ticket, `Created #${ticket.number} in ${project.name}: ${ticket.title}`);
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
    if (command === "approve") ticket.status = "done";
    else {
      if (!text) throw new Problem(`${command} needs its text: ${command} <number> "<text>"`);
      ticket.status = "doing";
      if (command === "answer") ticket.answer = text; else ticket.feedback = text;
    }
    saveTicket(project, ticket);
    return print(ticket, `#${ticket.number} is now ${ticket.status}.`);
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
