import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const fixture = globalThis.__ticketReviewTest = { values: new Map(), panes: [], calls: [], commands: [] };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "herdr") return { url: "herdr:review-test", shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "herdr:review-test") return { format: "module", shortCircuit: true, source: `
      const f = globalThis.__ticketReviewTest;
      export const shared = key => f.values.get(key);
      export const setShared = (key, value) => f.values.set(key, value);
      export const panes = () => f.panes;
      export const focused = () => ({tab: 'work'});
      export const exec = (...args) => { f.calls.push(args); return f.exec(...args); };
      export const run = (...args) => f.commands.push(args);
      export const props = () => ({});
      export const appHome = () => '/app';
      export const readTextFile = async () => null;
      export const writeTextFile = async () => {};
    ` };
    if (url.endsWith("/tickets/mods/tickets/start.js")) return { format: "module", shortCircuit: true, source: "export const spaceFor = () => null;" };
    return next(url, context);
  },
});
const { openReview, reviewKey, reviewState, reviewLabels } = await import("../mods/tickets/review.js");
const { ticketReviewKey, publishTicketReview } = await import("../../tourist/mods/tourist/ticket.js");
const project = { root: "/repo" }, ticket = { number: 3, title: "Retries", pr: 12, status: "review", submitted: "first" };
function reset() {
  fixture.values.clear(); fixture.panes = []; fixture.calls = []; fixture.commands = [];
  fixture.exec = async () => {
    const tab = `review-${fixture.calls.length}`;
    fixture.panes.push({ mod: "tourist", tab, pane: `pane-${tab}` });
    return { code: 0, stdout: JSON.stringify({ tab }) };
  };
}

test("Tourist and Tickets agree on the shared key, including repo and PR identity", () => {
  assert.equal(reviewKey("C:\\repo\\", ticket), ticketReviewKey({ root: "C:/repo/", number: 3 }, 12));
  assert.notEqual(reviewKey("/repo", ticket), reviewKey("/other", ticket));
  assert.notEqual(reviewKey("/repo", ticket), reviewKey("/repo", { ...ticket, pr: 13 }));
});

test("manual and automatic opens reuse the same review and preserve background focus", async () => {
  reset();
  const tab = await openReview(project, ticket, true);
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.commands.at(-1), ["tab.select", { id: "work" }]);
  assert.equal(await openReview(project, ticket), tab);
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.commands.at(-1), ["pane.focus", { pane: `pane-${tab}` }]);
  fixture.commands = [];
  assert.equal(await openReview(project, { ...ticket, submitted: "second" }, true), tab);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.commands.length, 0);
  assert.equal(fixture.values.get(`${reviewKey(project.root, ticket)}.request`).submission, "second");
});

test("closed review panes are recreated instead of focusing stale tab IDs", async () => {
  reset();
  const first = await openReview(project, ticket);
  fixture.panes = [];
  const second = await openReview(project, ticket);
  assert.notEqual(first, second);
  assert.equal(fixture.calls.length, 2);
  assert.equal(reviewState(project.root, ticket).live, true);
});

test("simultaneous board and slot opens create only one tab", async () => {
  reset();
  let finish;
  fixture.exec = () => new Promise(resolve => { finish = resolve; });
  const first = openReview(project, ticket);
  assert.equal(await openReview(project, ticket, true), null);
  assert.equal(fixture.calls.length, 1);
  finish({ code: 0, stdout: '{"tab":"review"}' });
  assert.equal(await first, "review");
});

test("failed opens release their claim for a later retry", async () => {
  reset();
  fixture.exec = async () => ({ code: 1, stderr: "Tourist unavailable" });
  await assert.rejects(openReview(project, ticket), /Tourist unavailable/);
  await assert.rejects(openReview(project, ticket), /Tourist unavailable/);
  assert.equal(fixture.calls.length, 2);
});

test("cards show progress, open comments, CI failures and stale submissions accurately", async () => {
  reset(); await openReview(project, ticket);
  const key = reviewKey(project.root, ticket);
  fixture.values.set(key, { ...fixture.values.get(key), phase: "reviewing", viewed: 1, total: 4,
    comments: 2, threads: 1, ci: "fail", checkedAt: Date.now() });
  assert.deepEqual(reviewLabels(project.root, ticket), ["Review in progress · 1/4 files viewed", "3 open comments", "CI failing"]);
  assert.deepEqual(reviewLabels(project.root, { ...ticket, submitted: "second" }), ["Review needs refresh", "CI unknown"]);
  fixture.panes = [];
  assert.match(reviewLabels(project.root, ticket)[0], /closed/);
  assert.match(reviewLabels(project.root, ticket)[2], /last checked/);
});

test("Tourist publishes current progress and distinguishes unknown thread and CI results", async () => {
  reset(); await openReview(project, ticket);
  const key = reviewKey(project.root, ticket), id = fixture.values.get(key).id;
  const view = { ticket: { root: project.root, number: ticket.number, reviewId: id }, ticketPR: ticket.pr,
    ticketReviewActive: true, ticketSubmission: ticket.submitted, ticketTour: () => ticket, phase: "tour", plan: {},
    pr: { headOid: "new", files: ["a.js", "b.js"] }, viewed: { "a.js": "new", "b.js": "old" }, comments: [{}],
    threadsLoaded: true, threads: [{ resolved: false }, { resolved: true }], checks: { list: [{ bucket: "pending" }], checkedAt: Date.now() } };
  publishTicketReview(view);
  const state = fixture.values.get(key);
  assert.equal(state.phase, "reviewing"); assert.equal(state.viewed, 1);
  assert.equal(state.comments + state.threads, 2); assert.equal(state.ci, "pending");
  view.checks.error = "Network unavailable"; view.threadsError = "Network unavailable";
  publishTicketReview(view);
  assert.equal(fixture.values.get(key).ci, "unknown"); assert.equal(fixture.values.get(key).threads, null);
  publishTicketReview(view, true);
  assert.equal(fixture.values.get(key).active, false);
});

test("standalone and superseded Tourist copies cannot write ticket review state", () => {
  reset();
  publishTicketReview({ ticket: null });
  assert.equal(fixture.values.size, 0);
  const key = reviewKey(project.root, ticket);
  const current = { id: "new-instance", active: true };
  fixture.values.set(key, current);
  publishTicketReview({ ticket: { root: project.root, number: 3, reviewId: "old-instance" }, ticketPR: 12, ticketReviewActive: true });
  assert.equal(fixture.values.get(key), current);
});
