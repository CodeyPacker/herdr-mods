// Tourist publishes one review per repo, ticket and PR in shared state. No cross-mod imports.
import { shared, setShared, panes, exec, run, focused } from "herdr";
import { spaceFor } from "./start.js";

export const reviewKey = (root, ticket) => `tourist.ticket.${JSON.stringify([root.replace(/\\/g, "/").replace(/\/+$/, ""), ticket.number, ticket.pr])}`;
export const submission = ticket => ticket.submitted ?? ticket.updated ?? "";

/** A recorded review is reusable only while its Tourist pane still exists. */
export function reviewState(root, ticket) {
  const state = shared(reviewKey(root, ticket));
  if (!state || state.pr !== ticket.pr) return null;
  return { ...state, live: Boolean(state.active && panes().some(p => p.mod === "tourist" && p.tab === state.tab)) };
}

/** Open or focus one review. Background notifications preserve the current tab. */
export async function openReview(project, ticket, background = false) {
  const key = reviewKey(project.root, ticket), current = reviewState(project.root, ticket);
  const request = { id: current?.id, submission: submission(ticket) };
  if (current?.live) {
    const before = shared(`${key}.request`);
    if (before?.id !== request.id || before?.submission !== request.submission) setShared(`${key}.request`, request);
    if (!background) {
      run("tab.select", { id: current.tab });
      const pane = panes().find(p => p.mod === "tourist" && p.tab === current.tab);
      if (pane) run("pane.focus", { pane: pane.pane });
    }
    return current.tab;
  }
  // Board and slot can race to open the same review. Claim it before starting the CLI.
  if (current?.opening && Date.now() - current.opening < 30000) return null;
  const id = `${Date.now()}-${Math.random()}`;
  setShared(key, { id, pr: ticket.pr, active: true, opening: Date.now(), submission: submission(ticket) });
  setShared(`${key}.request`, { id, submission: submission(ticket) });
  const space = spaceFor(project), shown = focused();
  const spec = { name: `Review #${ticket.number} ${ticket.title}`.slice(0, 40), mod: "tourist",
    props: { folder: project.root, pr: ticket.pr, ticket: { number: ticket.number, root: project.root, title: ticket.title,
      reviewId: id, submission: submission(ticket) } }, ...(space ? { space: space.id } : {}) };
  try {
    const made = await exec("herdr-app", ["do", "tab.new", JSON.stringify(spec)]);
    if (made.code !== 0) throw new Error(made.stderr || made.stdout || "Could not open Tourist");
    const tab = JSON.parse(made.stdout).tab;
    if (!tab) throw new Error("Herdr did not return the review tab");
    const state = shared(key);
    if (state?.id === id) setShared(key, { ...state, tab, opening: null });
    return tab;
  } catch (error) {
    if (shared(key)?.id === id) setShared(key, { ...shared(key), active: false, opening: null });
    throw error;
  } finally {
    if (background && shown?.tab) run("tab.select", { id: shown.tab });
  }
}

/** Compact, honest labels: old CI results never appear current after a resubmission. */
export function reviewLabels(root, ticket) {
  if (!ticket.pr || !root) return [];
  const state = reviewState(root, ticket);
  if (!state) return ["Review not started", "CI unknown"];
  if (ticket.status === "review" && state.submission !== submission(ticket)) return ["Review needs refresh", "CI unknown"];
  const phase = { setup: "Review not started", planning: "Preparing review", reviewing: "Review in progress",
    waiting: "Changes requested", error: "Review stopped", done: "Review complete" }[state.phase] ?? "Review not started";
  const progress = state.total ? ` · ${state.viewed ?? 0}/${state.total} files viewed` : "";
  const labels = [`${phase}${progress}${state.live ? "" : " · closed"}`];
  if (state.comments !== undefined && state.threads !== null && state.threads !== undefined)
    labels.push(`${state.comments + state.threads} open comments`);
  else labels.push(`${state.comments ?? 0} draft comments · threads unknown`);
  const ci = { pass: "CI passed", fail: "CI failing", pending: "CI running", none: "No CI checks", unknown: "CI unknown" }[state.ci] ?? "CI unknown";
  labels.push(`${ci}${state.live && state.checkedAt && Date.now() - state.checkedAt < 90000 ? "" : " (last checked)"}`);
  return labels;
}
