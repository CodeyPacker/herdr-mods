// Starting an agent in a Herdr tab: on a ticket (the board does it when you press s, the slot
// does it by itself for tickets set to auto), or as the planner that writes a batch of tickets.
import { exec, run, spaces, shared, agents, panes, terminals } from "herdr";
import { script, folderOf } from "./data.js";

/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("./data.js").Ticket} Ticket */
/** @typedef {import("./data.js").Project} Project */
/** @typedef {{ key: string, name: string, run: string[] }} Starter an agent that can be started */
/** @typedef {{ address: string, status: string, name: string, tab: string | null }} TicketAgent the agent on a ticket. `tab` is null when it runs without a tab. */

/** A path in one spelling, to compare two of them. @param {string} path */
const samePath = (path) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** The agents that can be started, from a knownAgents() list. @param {{ key: string, name: string, run: string[], installed: boolean }[]} list @returns {Starter[]} */
export const installed = (list) => list.filter((a) => a.installed && a.run?.length).map((a) => ({ key: a.key, name: a.name, run: a.run }));

/** The agents Herdr's own new-tab menu last saved, to show before knownAgents() has answered. @returns {Starter[]} */
export const savedStarters = () => installed(/** @type {any} */ (shared("new-menu.agents"))?.[""] ?? []);

/** The agents that may be offered: the installed ones the person has not hidden. @param {Starter[]} list @returns {Starter[]} */
export function usableAgents(list) {
  const hidden = /** @type {any} */ (shared("tickets.hiddenAgents"));
  return Array.isArray(hidden) ? list.filter((a) => !hidden.includes(a.key)) : list;
}

/**
 * The agent a ticket starts with: the one chosen with g, else `fallback`, else the first offered.
 * @param {Starter[]} list @param {string} [fallback] an agent's key @returns {Starter | null}
 */
export function pickStarter(list, fallback = "") {
  const offered = usableAgents(list);
  const key = shared("tickets.agent") ?? fallback;
  return offered.find((a) => a.key === key) ?? offered[0] ?? null;
}

/** A space that is on the project's repo: the shown one first. @param {Project} p */
export function spaceFor(p) {
  if (!p.root) return null;
  const root = samePath(p.root);
  const on = (/** @type {SpaceInfo} */ s) => !s.machine && (samePath(folderOf(s)) + "/").startsWith(root + "/");
  const all = spaces();
  return all.find((s) => s.active && on(s)) ?? all.find(on) ?? null;
}

/** The tickets a ticket waits on, from its own project. A ticket that is gone is left out. @param {Project} p @param {Ticket} ticket @returns {Ticket[]} */
export const neededBy = (p, ticket) => p.tickets.filter((t) => (ticket.needs ?? []).includes(t.number));

/** The first message for an agent that starts on a ticket: the ticket, what it builds on, then how to report back. @param {Project} p @param {Ticket} ticket */
export function taskFor(p, ticket) {
  const cmd = `node "${script()}"`;
  const n = ticket.number;
  const built = neededBy(p, ticket).filter((t) => t.summary);
  return [
    `Work on ticket #${n}: ${ticket.title}`,
    ...(ticket.description ? ["", ticket.description] : []),
    ...(ticket.criteria?.length ? ["", "Done when:", ...ticket.criteria.map((c) => `- ${c}`)] : []),
    ...(built.length ? ["", "This ticket builds on finished tickets. What their agents reported:", ...built.map((t) => `- #${t.number} ${t.title}: ${t.summary}`)] : []),
    ...(ticket.answer ? ["", `An earlier agent asked: ${ticket.question}`, `The answer: ${ticket.answer}`] : []),
    ...(ticket.feedback ? ["", `Earlier work was reviewed (${ticket.summary}). Changes requested: ${ticket.feedback}`] : []),
    "",
    "Report on the ticket with these commands, run from this repo:",
    `- ${cmd} show ${n}   (read the ticket again)`,
    `- ${cmd} block ${n} "<question>"   (you need an answer from me before you can go on, then stop)`,
    `- ${cmd} submit ${n} "<summary>"   (the work is finished and ready for my review)`,
  ].join("\n");
}

/**
 * Opens a tab with an agent on the ticket, then records that agent's terminal on the ticket and
 * moves it to In progress. Rejects with a message for the person.
 * @param {Project} p @param {Ticket} ticket @param {Starter} starter
 * @returns {Promise<string>} the new terminal's address
 */
export async function startAgent(p, ticket, starter) {
  const space = spaceFor(p);
  const spec = { name: `#${ticket.number} ${ticket.title}`.slice(0, 40), argv: starter.run, task: taskFor(p, ticket),
    ...(p.root ? { folder: p.root } : {}), ...(space ? { space: space.id } : {}) };
  // run("tab.new") returns nothing. The CLI prints the terminal it made, which the ticket needs.
  const made = await exec("herdr-app", ["do", "tab.new", JSON.stringify(spec)]);
  if (made.code !== 0) throw new Error(made.stdout.trim() || made.stderr.trim() || "herdr-app could not open the tab");
  const terminal = JSON.parse(made.stdout).terminal;
  const saved = await exec("node", [script(), "start", String(ticket.number), "--terminal", terminal, ...(p.root ? ["--in", p.root] : [])]);
  if (saved.code !== 0) throw new Error(saved.stderr.trim());
  return terminal;
}

/** The first message for a planner agent: the goal, how to write tickets that stand alone, and when to release them. @param {string} goal */
export function planTask(goal) {
  const cmd = `node "${script()}"`;
  return [
    "Plan this work as tickets on the Herdr tickets board for this repo. Do not change any code yourself.",
    "",
    "The goal:",
    goal,
    "",
    "Read the code the goal touches first. If something only I can decide is unclear, ask me before you write tickets.",
    "",
    "Create each ticket with:",
    `  ${cmd} create "<title>" --desc "<description>" --criteria "<done when>" [--criteria "..."] [--after <number>]`,
    "Create them in the order they should be done, so a ticket can name earlier ones with --after.",
    "",
    "Each ticket is done by a separate agent that starts with no memory of this plan. It sees only its own ticket and the summaries of the tickets it waits on. So every ticket must stand alone:",
    "- The description says what to build, in which files or folders, and why. Name real files, functions and patterns you found. Include the decisions the agent must not remake differently (names, formats, where things live).",
    "- Every ticket has at least one --criteria the agent can check itself, such as a command that passes or a behavior it can see.",
    "- A ticket is one piece of work that can be reviewed alone. No ticket for planning, and none that only says to test everything.",
    "",
    "Use --after for every ticket that must be finished first: when this ticket builds on what that one makes, or when both change the same files (the agents share one checkout). A ticket starts only after I approve the tickets it waits on, so do not add --after where it is not needed.",
    "",
    `When the tickets are written, read each again with \`${cmd} show <number>\` as an agent that knows nothing but that ticket and the repo. Fix what is missing with \`${cmd} edit <number> [--title "..."] [--desc "..."] [--criteria "..."]... [--after <number>]...\` (--criteria and --after replace the whole list).`,
    "",
    "Then stop and show me the list: each ticket's number, title and what it waits on. Do not release them yet. I may ask for changes.",
    `When I tell you to go ahead, release them with \`${cmd} auto <every ticket number>\`. Herdr then starts an agent on each ticket as soon as the tickets it waits on are approved, up to 3 at a time.`,
  ].join("\n");
}

/**
 * Opens a tab with a planner agent for a goal, in the repo at `folder`. Rejects with a message for the person.
 * @param {string} folder @param {string} goal @param {Starter} starter
 */
export async function startPlanner(folder, goal, starter) {
  const space = spaceFor(/** @type {Project} */ ({ key: "", name: "", root: folder, tickets: [] }));
  const spec = { name: `Plan: ${goal}`.slice(0, 40), argv: starter.run, task: planTask(goal), folder, ...(space ? { space: space.id } : {}) };
  const made = await exec("herdr-app", ["do", "tab.new", JSON.stringify(spec)]);
  if (made.code !== 0) throw new Error(made.stdout.trim() || made.stderr.trim() || "herdr-app could not open the tab");
}

/**
 * The agent working on a ticket, if its terminal is still running. A ticket only names a terminal
 * ("t7"), and Herdr gives a finished terminal's name to a new one. So the terminal must also have
 * been started with this ticket's first message, or it is someone else's.
 * @param {Ticket} ticket @returns {TicketAgent | null}
 */
export function agentOn(ticket) {
  if (!ticket.terminal) return null;
  const terminal = terminals().find((t) => t.address === ticket.terminal && t.state !== "finished");
  if (!terminal || !JSON.stringify(terminal.argv ?? "").includes(`Work on ticket #${ticket.number}:`)) return null;
  const listed = agents().find((a) => a.address === ticket.terminal);
  const pane = panes().find((p) => p.terminal === ticket.terminal);
  return { address: ticket.terminal, status: listed?.status ?? terminal.status ?? "", name: listed?.program.name ?? terminal.program?.name ?? "agent", tab: pane?.tab ?? null };
}

/** Takes an agent's tab away. The agent keeps running and can be looked at with showAgent. @param {string} terminal */
export function hideAgent(terminal) {
  run("terminal.park", { terminal });
}

/** Shows a ticket's agent: its tab when it has one, else a peek at it over the shown tab. @param {TicketAgent} agent */
export function showAgent(agent) {
  if (agent.tab) run("agent.focus", { terminal: agent.address });
  else run("terminal.peek", { terminal: agent.address });
}

/** Ends a ticket's agent. A tab that holds nothing else closes with it. @param {Ticket} ticket */
export function endAgent(ticket) {
  const agent = agentOn(ticket);
  if (!agent) return;
  if (agent.tab && panes().filter((p) => p.tab === agent.tab).length === 1) run("tab.close", { id: agent.tab, confirmed: true });
  else run("terminal.kill", { terminal: agent.address });
}
