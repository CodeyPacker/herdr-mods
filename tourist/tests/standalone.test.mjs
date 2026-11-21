// Run with: node --experimental-vm-modules --test tourist/tests/*.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import * as prompts from "../mods/tourist/plan.js";
import * as constants from "../mods/tourist/constants.js";

const sources = new Map(await Promise.all(["main", "ticket", "saved"].map(async name =>
  [`./${name}.js`, await readFile(new URL(`../mods/tourist/${name}.js`, import.meta.url), "utf8")])));
const pr = { number: 12, title: "Retries", author: "dev", head: "retry", base: "main", body: "Retries", headOid: "abcdef1234567890", mergeBase: "1234567", files: ["upload.js"], commits: ["Retry"] };

/** Run Tourist's controller with fake app services and no installed Tickets CLI. */
async function standalone(scope, linked = false) {
  const context = vm.createContext({ console }), modules = new Map(), imports = new Map();
  const sent = [], calls = [], commands = [], state = new Map();
  let currentPR = { ...pr }, reviewed = null;
  const details = { number: 3, title: "Retries", description: "Recover uploads", criteria: ["Retry twice"], summary: "Retries added", submitted: "first", status: "review" };
  const services = {
    View: class {},
    AgentSession: class {
      constructor(agent) { this.agent = agent; this.id = null; }
      async stop() {}
      async ask(prompt) {
        sent.push(prompt);
        return JSON.stringify({ title: "Review", summary: "Retries", stops: [{ file: "upload.js", start: 1, end: 3, title: "Retry", body: "Retries twice" }] });
      }
    },
    git: async () => pr.headOid,
    loadPR: async () => ({ ...currentPR }), loadComments: async () => [], loadViewed: async () => ({}),
    saveComments: async () => {}, saveReviewed: async (_key, oid) => { reviewed = { oid, at: "earlier" }; },
    lastReviewed: async () => reviewed, haveCommit: async () => true,
    changesSince: async () => ({ files: ["upload.js"], commits: ["Fix retries"] }),
    commentKey: () => "pr-12", appHome: () => "/app-without-tickets",
    linesOf: comment => String(comment.line),
    readTextFile: async () => null, writeTextFile: async () => {},
    shared: key => state.get(key), setShared: (key, value) => state.set(key, value),
    notify: () => {}, run: (...args) => commands.push(args),
    exec: async (cmd, args) => {
      calls.push([cmd, args]);
      if (!linked) throw new Error("Tickets mod is not installed");
      return { code: 0, stdout: JSON.stringify(args[1] === "changes" ? { forwarded: true } : details) };
    },
  };
  // Supply named app services for imports, leaving the controller and ticket/cache code real.
  for (const source of sources.values()) {
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
      const names = imports.get(match[2]) ?? new Set();
      for (const name of match[1].split(",").map(name => name.trim())) names.add(name);
      imports.set(match[2], names);
    }
  }
  const synthetic = entries => new vm.SyntheticModule(Object.keys(entries), function () {
    for (const [name, value] of Object.entries(entries)) this.setExport(name, value);
  }, { context });
  async function link(specifier) {
    if (modules.has(specifier)) return modules.get(specifier);
    let module;
    if (specifier === "./plan.js") module = synthetic(prompts);
    else if (specifier === "./constants.js") module = synthetic(constants);
    else if (sources.has(specifier)) module = new vm.SourceTextModule(sources.get(specifier), { context });
    else if (specifier === "fs/promises") module = synthetic({ mkdir: async () => {}, unlink: async () => {} });
    else module = synthetic(Object.fromEntries([...imports.get(specifier)].map(name =>
      [name, services[name] ?? (() => { throw new Error(`Unexpected service: ${name}`); })])));
    modules.set(specifier, module);
    if (module instanceof vm.SourceTextModule) await module.link(link);
    return module;
  }
  const module = await link("./main.js");
  await module.evaluate();
  const view = new module.namespace.default(), jobs = [];
  const cx = { notify() {}, spawn(fn) { jobs.push(fn(cx)); } };
  Object.assign(view, {
    phase: "setup", scope, idx: 0, agent: "codex", depth: "normal", pass: "whole", comments: [], pr: null,
    git: { root: "/repo", branch: "retry", base: "main", mergeBase: pr.mergeBase, head: pr.headOid, changed: pr.files },
    prNumber: pr.number, ticketPR: pr.number, ticket: null, reviewTicket: null,
    ticketReviewActive: linked, ticketSubmission: "first", ticketPreviousFeedback: "",
    ticketRequestSeen: "first", ticketPendingSubmission: null,
    featureInput: { value: () => "upload retries" },
  });
  if (linked) {
    view.ticket = { root: "/repo", number: 3, reviewId: "linked" };
    const key = modules.get("./ticket.js").namespace.ticketReviewKey(view.ticket, view.ticketPR);
    state.set(key, { id: "linked", active: true, tab: "existing-review", pr: pr.number });
  }
  // Rendering and background UI refreshes are outside these controller tests.
  for (const name of ["leaveBox", "loadThreads", "loadChecks", "show", "loadRepoFiles", "loadFiles", "storePlan"])
    view[name] = () => {};
  view.leaveBox = () => { view.focusCalls = (view.focusCalls ?? 0) + 1; };
  return { view, cx, sent, calls, commands, state, details,
    resubmit() { details.submitted = "second"; currentPR = { ...pr, headOid: "fedcba6543210987" }; },
    async drain() { while (jobs.length) await Promise.all(jobs.splice(0)); } };
}

test("requesting changes keeps the review open and resubmission rechecks feedback at the new head", async () => {
  const h = await standalone("pr", true);
  h.view.start(h.cx); await h.drain();
  h.view.comments = [{ file: "upload.js", line: 2, side: "new", code: "retry()", text: "Handle permanent errors" }];
  h.view.requestChanges(h.cx); h.view.requestChanges(h.cx); await h.drain();
  assert.equal(h.view.ticketWaiting, true);
  assert.equal(h.commands.length, 0);
  assert.match(h.view.ticketPreviousFeedback, /Handle permanent errors/);
  const focusCalls = h.view.focusCalls;
  h.resubmit();
  h.view.refreshTicket("second", h.cx); await h.drain();
  assert.equal(h.view.phase, "tour", h.view.error);
  assert.equal(h.view.ticketWaiting, false);
  assert.equal(h.view.pr.headOid, "fedcba6543210987");
  assert.equal(h.view.pr.sinceOid, pr.headOid);
  assert.match(h.sent.at(-1), /Handle permanent errors/);
  assert.match(h.sent.at(-1), /Do not assume a resubmission resolves that feedback/);
  assert.equal(h.commands.length, 0);
  assert.equal(h.view.focusCalls, focusCalls);
});

test("new submissions defer refresh while draft comments or input would be lost", async () => {
  const h = await standalone("pr", true);
  h.view.start(h.cx); await h.drain(); h.resubmit();
  h.view.comments = [{ text: "Unsent comment" }];
  h.view.refreshTicket("second", h.cx); await h.drain();
  assert.equal(h.view.pr.headOid, pr.headOid);
  assert.equal(h.view.ticketSubmission, "first");
  h.view.comments = []; h.view.typing = "ask";
  h.view.refreshTicket("second", h.cx); await h.drain();
  assert.equal(h.view.ticketSubmission, "first");
  h.view.typing = null;
  h.view.refreshTicket("second", h.cx); await h.drain();
  assert.equal(h.view.pr.headOid, "fedcba6543210987");
  const count = h.sent.length;
  h.view.refreshTicket("second", h.cx); await h.drain();
  assert.equal(h.sent.length, count);
});

test("a stale opener request cannot undo a submission already detected by the ticket poll", async () => {
  const h = await standalone("pr", true);
  h.view.start(h.cx); await h.drain();
  const key = [...h.state.keys()][0];
  h.state.set(`${key}.request`, { id: "linked", submission: "first" });
  h.resubmit(); h.view.pollTicket(h.cx); await h.drain();
  assert.equal(h.view.ticketSubmission, "second");
  const count = h.sent.length;
  h.view.syncTicketReview(h.cx); await h.drain();
  assert.equal(h.sent.length, count);
  assert.equal(h.view.ticketSubmission, "second");
});

for (const scope of ["pr", "branch", "commit", "repo", "feature"]) {
  test(`standalone ${scope} tour and fresh-session follow-up need no Tickets mod`, async () => {
    const h = await standalone(scope);
    h.view.start(h.cx);
    await h.drain();
    assert.equal(h.view.phase, "tour", h.view.error);
    assert.equal(h.view.ticketTour(), null);
    assert.equal(h.calls.length, 0);
    const expected = scope === "pr"
      ? prompts.prPlanPrompt(prompts.prSubject(pr), "normal")
      : prompts.planPrompt(prompts.subject(scope, h.view.git, "upload retries"), "normal");
    assert.equal(h.sent[0], expected);
    assert.doesNotMatch(h.view.savedKey ?? "", /-ticket-/);
    h.view.followUp("Question", "What could fail?", h.cx);
    await h.drain();
    assert.equal(h.sent.length, 2);
    assert.doesNotMatch(h.sent[1], /Ticket requirements/);
    assert.equal(h.calls.length, 0);
  });
}
