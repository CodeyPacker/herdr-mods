// Starting an agent on a ticket, in a Herdr tab. The board does it when you press s. The slot
// does it by itself for tickets set to auto.
import { exec, spaces, shared } from "herdr";
import { script, folderOf } from "./data.js";

/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("./data.js").Ticket} Ticket */
/** @typedef {import("./data.js").Project} Project */
/** @typedef {{ key: string, name: string, run: string[] }} Starter an agent that can be started */

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
