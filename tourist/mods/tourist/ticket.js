// Tours of a ticket's pull request, opened by the tickets mod. The review goes back through that
// mod's own command, ticket.mjs, which saves it on the ticket and passes it to the ticket's agent.
import { appHome, exec, focused, panes, props, run, shared, setShared } from "herdr";
import { linesOf } from "./comments.js";

/** @typedef {{ number: number, root: string, title: string, reviewId?: string, submission?: string }} TicketRef the ticket a tour was opened for */

const script = () => `${appHome().replace(/\\/g, "/")}/mods/tickets/ticket.mjs`;

// Shared-state contract with Tickets' review.js. Tourist never imports the Tickets mod.
export const ticketReviewKey = (ticket, pr) => `tourist.ticket.${JSON.stringify([ticket.root.replace(/\\/g, "/").replace(/\/+$/, ""), ticket.number, pr])}`;

/** Publish only for an explicitly linked review. Standalone Tourist never touches this state. */
export function publishTicketReview(view, closed = false) {
  const ticket = view.ticket;
  if (!ticket?.reviewId || !view.ticketReviewActive) return;
  const key = ticketReviewKey(ticket, view.ticketPR), old = shared(key);
  if (old?.id !== ticket.reviewId) return;
  const linked = view.ticketTour();
  const list = view.checks?.list;
  const ci = view.checks?.error || !list ? "unknown" : list.some(c => c.bucket === "fail" || c.bucket === "cancel") ? "fail"
    : list.some(c => c.bucket === "pending") ? "pending" : list.some(c => c.bucket === "pass") ? "pass" : "none";
  const files = linked ? view.pr.sinceFiles ?? view.pr.files : [];
  const phase = view.ticketDone || view.merge?.approve?.phase === "approved" ? "done" : view.ticketWaiting ? "waiting"
    : view.phase === "error" ? "error" : view.phase === "planning" ? "planning" : linked && view.plan ? "reviewing" : "setup";
  const state = { ...old, active: !closed, phase, submission: view.ticketSubmission,
    head: linked ? view.pr.headOid : null, viewed: files.filter(file => view.viewed[file] === view.pr.headOid).length,
    total: files.length, comments: view.comments?.length ?? 0,
    threads: view.threadsLoaded && !view.threadsError ? view.threads.filter(th => !th.resolved).length : null,
    ci, checkedAt: view.checks?.checkedAt ?? null };
  if (JSON.stringify(old) !== JSON.stringify(state)) setShared(key, state);
}

/**
 * Runs ticket.mjs on the ticket's repo and returns its JSON. Throws its own message.
 * Approving merges the PR and removes a worktree, which can take a while.
 * @param {TicketRef} ticket @param {string[]} args
 */
export async function ticketCommand(ticket, args) {
  let r;
  try { r = await exec("node", [script(), ...args, "--in", ticket.root, "--json"], { timeout: 180000 }); }
  catch { throw new Error("Could not run node, which the tickets mod needs."); }
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || "ticket.mjs failed.").trim().slice(-600));
  return JSON.parse(r.stdout);
}

/**
 * The saved comments as one message for the ticket's agent: where each sits, its code, then the comment.
 * @param {{ number: number }} pr
 * @param {{ file: string, line: number, side: string, startLine?: number, code?: string, text: string }[]} comments
 */
export function changesText(pr, comments) {
  return [
    `Review comments on PR #${pr.number}:`,
    ...comments.flatMap((c) => ["",
      `${c.file}:${linesOf(c)}${c.side === "old" ? " (removed lines, numbered in the old file)" : ""}`,
      ...String(c.code ?? "").split("\n").map((l) => `    ${l}`),
      c.text]),
  ].join("\n");
}

/**
 * The pane this Tourist is in, or null. Herdr only tells a pane header which pane it is on, not a
 * mod that is the pane. So it is the Tourist pane that has the keyboard, which is this one while
 * the person presses a key in it, else the only Tourist pane there is.
 */
export function ownPane() {
  const mine = panes().filter((p) => p.mod === "tourist");
  return props()?.pane ?? mine.find((p) => p.pane === focused()?.pane)?.pane ?? (mine.length === 1 ? mine[0].pane : null);
}

/**
 * Closes the tab this Tourist is in, or only its pane when the tab holds more. False when the pane is gone.
 * @param {string | null} pane from ownPane(), read while the person was still in this pane
 */
export function closeOwnTab(pane) {
  const all = panes(), me = all.find((p) => p.pane === pane);
  if (!me) return false;
  if (all.filter((p) => p.tab === me.tab).length > 1) run("pane.close", { pane: me.pane });
  else run("tab.close", { id: me.tab, confirmed: true });
  return true;
}
