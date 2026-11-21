import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseProgress, progressOf } from "../mods/bruno/progress.js";
import { plannedRequests } from "../mods/bruno/plan.js";
import { parseCollection } from "../mods/bruno/parser.js";
import { FIXTURES, readTree, deepFreeze } from "./helpers.mjs";

const output = (name) => readFileSync(join(FIXTURES, "progress", `${name}.txt`), "utf8");
const paths = (list) => list.map((f) => f.path);
const collections = {
  yaml: deepFreeze(parseCollection({ root: "/home/dev/shop", files: readTree("yaml") })),
  bru: deepFreeze(parseCollection({ root: "/home/dev/shop", files: readTree("bru") })),
};

const FOLDER = ["products/top sellers/Best Sellers", "products/List Products", "products/Product Page", "products/Missing Product"];
const COLLECTION = [...FOLDER, "orders/Create Order", "orders/slow-order", "orders/Closed Port", "Get Health"];

test("the CLI's output of a folder Run gives each finished Request in order, in both formats", () => {
  for (const name of ["yaml-folder", "bru-folder"]) {
    const p = parseProgress(output(name));
    assert.deepEqual(paths(p.finished), FOLDER, name);
    assert.deepEqual(p.finished[0], { path: "products/top sellers/Best Sellers", status: 200, statusText: "OK", time: p.finished[0].time });
    assert.equal(typeof p.finished[0].time, "number");
    assert.equal(p.finished[3].status, 404);
    assert.equal(p.finished[3].statusText, "Not Found");
  }
});

test("a Collection Run's output, parse errors and the summary table included, gives only result lines", () => {
  for (const name of ["yaml-collection", "bru-collection"]) {
    const p = parseProgress(output(name));
    assert.deepEqual(paths(p.finished), COLLECTION, name);
    assert.ok(p.lines > 30);
  }
});

test("a network error is finished with a null status and the error as its text", () => {
  const closed = parseProgress(output("yaml-collection")).finished.find((f) => f.path === "orders/Closed Port");
  assert.deepEqual(closed, { path: "orders/Closed Port", status: null, statusText: "connect ECONNREFUSED 127.0.0.1:47912", time: null });
});

test("ANSI colour codes are stripped", () => {
  const text = output("yaml-folder-color");
  assert.ok(text.includes("\x1b["), "the fixture is coloured");
  assert.deepEqual(paths(parseProgress(text).finished), FOLDER);
});

test("a partly written last line is ignored until it ends", () => {
  const part = "products/List Products (200 OK) - 2 ms\nproducts/Missing Product (404 Not";
  assert.deepEqual(paths(parseProgress(part).finished), ["products/List Products"]);
  assert.equal(parseProgress(part).lines, 1);
  assert.equal(parseProgress(`${part} Found) - 3 ms\n`).finished.length, 2);
  assert.deepEqual(parseProgress(""), { finished: [], lines: 0 });
  assert.deepEqual(parseProgress(null), { finished: [], lines: 0 });
});

test("Windows line ends and backslash paths are read, and a skipped Request is finished", () => {
  const p = parseProgress("products\\top sellers\\Best Sellers (200 OK) - 5 ms\r\norders/Ask Name Skipped: (Prompt variables detected in request. \r\nPrompts: name)\r\n");
  assert.deepEqual(p.finished, [
    { path: "products/top sellers/Best Sellers", status: 200, statusText: "OK", time: 5 },
    { path: "orders/Ask Name", status: null, statusText: "Skipped", time: null },
  ]);
});

test("assertion, test, error and stack lines are not results", () => {
  const p = parseProgress([
    "Assertions", "   ✓ res.status: eq 200", "      expected 404 to equal 200",
    "    at Composer.onError (/usr/local/lib/x.js:69:34)", "Error: Implicit keys (line 4)",
    "Warning: Skipping invalid file /home/dev/shop/Broken.yml", "Ran all requests - 687 ms", "",
  ].join("\n"));
  assert.deepEqual(p.finished, []);
});

test("a path with parentheses keeps them", () => {
  assert.equal(parseProgress("old (v1)/List (all) (200 OK) - 1 ms\n").finished[0].path, "old (v1)/List (all)");
});

const planned = deepFreeze([
  { kind: "request", name: "Best Sellers", path: "products/top sellers/Best Sellers.yml", method: "GET" },
  { kind: "request", name: "List Products", path: "products/List Products.yml", method: "GET" },
  { kind: "request", name: "Product Page", path: "products/Product Page.yml", method: "GET" },
]);
const fin = (path, status = 200, statusText = "OK") => ({ path, status, statusText, time: 3 });

test("progressOf counts, names the finished Requests and names the next one", () => {
  const p = progressOf({ planned, finished: [fin("products/top sellers/Best Sellers")] });
  assert.deepEqual(p, {
    done: 1, total: 3,
    finished: [{ name: "Best Sellers", path: "products/top sellers/Best Sellers", method: "GET", status: 200, statusText: "OK", time: 3, ok: true }],
    running: { name: "List Products", path: "products/List Products.yml" },
  });
});

test("progressOf before any Request names the first one, and after the last names none", () => {
  assert.deepEqual(progressOf({ planned, finished: [] }), { done: 0, total: 3, finished: [], running: { name: "Best Sellers", path: "products/top sellers/Best Sellers.yml" } });
  const all = progressOf({ planned, finished: planned.map((n) => fin(n.path.replace(/\.yml$/, ""))) });
  assert.equal(all.done, 3);
  assert.equal(all.running, null);
});

test("ok is true for 2xx and 3xx only", () => {
  const p = progressOf({ planned, finished: [fin("products/top sellers/Best Sellers", 302, "Found"), fin("products/List Products", 404, "Not Found"), fin("products/Product Page", null, "connect ECONNREFUSED")] });
  assert.deepEqual(p.finished.map((f) => f.ok), [true, false, false]);
});

test("an order that differs from the plan gives no running Request, but still counts", () => {
  const p = progressOf({ planned, finished: [fin("products/List Products")] });
  assert.equal(p.running, null);
  assert.equal(p.done, 1);
  assert.equal(p.finished[0].name, "List Products");
});

test("a Request missing from the plan is named after its path and done never exceeds total", () => {
  const p = progressOf({ planned: planned.slice(0, 1), finished: [fin("products/top sellers/Best Sellers"), fin("other/Extra")] });
  assert.equal(p.done, 1);
  assert.equal(p.total, 1);
  assert.equal(p.running, null);
  assert.deepEqual(p.finished[1], { name: "Extra", path: "other/Extra", method: null, status: 200, statusText: "OK", time: 3, ok: true });
});

test("path matching ignores the extension and is exact otherwise", () => {
  assert.notEqual(progressOf({ planned, finished: [fin("products/top sellers/best sellers")] }).running?.name, "List Products");
  assert.equal(progressOf({ planned, finished: [fin("products/top sellers/Best Sellers.yml")] }).running?.name, "List Products");
});

test("the planned order matches the real CLI order for a folder and a Collection, in both formats", () => {
  const strip = (list) => list.map((n) => n.path.replace(/\.(yml|bru)$/, ""));
  for (const fmt of ["yaml", "bru"]) {
    const c = collections[fmt];
    assert.deepEqual(strip(plannedRequests(c, { kind: "folder", path: "products" })), paths(parseProgress(output(`${fmt}-folder`)).finished), fmt);
    assert.deepEqual(strip(plannedRequests(c, { kind: "collection" })), paths(parseProgress(output(`${fmt}-collection`)).finished), fmt);
  }
});

test("following the real output with the plan names the running Request at every step", () => {
  const c = collections.yaml;
  const plan = plannedRequests(c, { kind: "collection" });
  const lines = output("yaml-collection").split("\n");
  let seen = 0;
  for (let i = 1; i <= lines.length; i++) {
    const p = progressOf({ planned: plan, finished: parseProgress(lines.slice(0, i).join("\n") + "\n").finished });
    if (p.done === seen) continue;
    seen = p.done;
    assert.equal(p.running?.path ?? null, plan[p.done]?.path ?? null);
  }
  assert.equal(seen, 8);
});
