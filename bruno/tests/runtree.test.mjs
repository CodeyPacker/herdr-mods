import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runRows, foldersOf, unfoldFor } from "../mods/bruno/runtree.js";
import { parseCollection } from "../mods/bruno/parser.js";
import { plannedRequests } from "../mods/bruno/plan.js";
import { parseProgress, progressOf } from "../mods/bruno/progress.js";
import { readRun } from "../mods/bruno/report.js";
import { FIXTURES, readTree, readReport, deepFreeze } from "./helpers.mjs";

const collections = {
  yaml: deepFreeze(parseCollection({ root: "/home/dev/shop", files: readTree("yaml") })),
  bru: deepFreeze(parseCollection({ root: "/home/dev/shop", files: readTree("bru") })),
};
const COLLECTION = deepFreeze({ kind: "collection" });
const PRODUCTS = deepFreeze({ kind: "folder", path: "products" });
const output = (name) => readFileSync(join(FIXTURES, "progress", `${name}.txt`), "utf8");

/** A row as a short tuple: folders with their count, Requests with their name. */
const shape = (rows) => rows.map((r) => r.kind === "folder"
  ? ["folder", r.name, r.depth, `${r.passed}/${r.total}`, r.failed, r.running]
  : ["request", r.entry.name, r.depth]);

/** Final entries for a Collection Run, from the CLI's own result lines, with report-style paths. */
function finalEntries(format) {
  const ext = format === "yaml" ? ".yml" : "";
  const finished = parseProgress(output(`${format}-collection`)).finished;
  return deepFreeze(progressOf({ planned: plannedRequests(collections[format], COLLECTION), finished }).finished
    .map((f) => ({ ...f, path: `${f.path}${ext}` })));
}

test("a Collection Run groups its Requests under nested folders, in both formats", () => {
  for (const format of ["yaml", "bru"]) {
    const rows = runRows({ collection: collections[format], target: COLLECTION, entries: finalEntries(format) });
    assert.deepEqual(shape(rows), [
      ["folder", "Products", 0, "3/4", true, false],
      ["folder", "top sellers", 1, "1/1", false, false],
      ["request", "Best Sellers", 2],
      ["request", "List Products", 1],
      ["request", "Product Page", 1],
      ["request", "Missing Product", 1],
      ["folder", "Orders", 0, "2/3", true, false],
      ["request", "Create Order", 1],
      ["request", "slow-order", 1],
      ["request", "Closed Port", 1],
      ["request", "Get Health", 0],
    ], format);
    assert.deepEqual(rows.filter((r) => r.kind === "request").map((r) => r.index), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.ok(rows.every((r) => r.kind !== "folder" || r.folded === false));
  }
});

test("a folder Run gives the target no row: its subfolders are rows and its own Requests sit at depth 0", () => {
  const entries = deepFreeze(readRun({ reportText: readReport("folder.json"), code: 1 }).responses);
  const rows = runRows({ collection: collections.yaml, target: PRODUCTS, entries });
  assert.deepEqual(shape(rows), [
    ["folder", "top sellers", 0, "1/1", false, false],
    ["request", "Best Sellers", 1],
    ["request", "List Products", 0],
    ["request", "Product Page", 0],
    ["request", "Missing Product", 0],
  ]);
});

test("a Run with every Request directly in the target has no folder rows", () => {
  const orders = deepFreeze({ kind: "folder", path: "orders" });
  const entries = deepFreeze([
    { path: "orders/Create Order.yml", name: "Create Order", ok: true, status: 201 },
    { path: "orders/Closed Port.yml", name: "Closed Port", ok: false, status: null },
  ]);
  const rows = runRows({ collection: collections.yaml, target: orders, entries });
  assert.deepEqual(shape(rows), [["request", "Create Order", 0], ["request", "Closed Port", 0]]);
  const top = runRows({ collection: collections.yaml, target: COLLECTION, entries: deepFreeze([{ path: "Get Health.yml", name: "Get Health", ok: true }]) });
  assert.deepEqual(shape(top), [["request", "Get Health", 0]]);
});

test("a folder counts passed over listed Requests and flags a failure", () => {
  const entries = deepFreeze([
    { path: "orders/Create Order", name: "Create Order", ok: true },
    { path: "orders/slow-order", name: "slow-order", ok: true },
  ]);
  const ok = runRows({ collection: collections.bru, target: COLLECTION, entries })[0];
  assert.deepEqual([ok.passed, ok.total, ok.failed], [2, 2, false]);
  const bad = runRows({ collection: collections.bru, target: COLLECTION, entries: deepFreeze([...entries, { path: "orders/Closed Port", name: "Closed Port", ok: false }]) })[0];
  assert.deepEqual([bad.passed, bad.total, bad.failed], [2, 3, true]);
});

test("a folded folder hides every row beneath it, nested folders too, and keeps its count", () => {
  const rows = runRows({ collection: collections.yaml, target: COLLECTION, entries: finalEntries("yaml"), folded: deepFreeze(new Set(["products"])) });
  assert.deepEqual(shape(rows).map((r) => r.slice(0, 2)), [
    ["folder", "Products"], ["folder", "Orders"], ["request", "Create Order"], ["request", "slow-order"], ["request", "Closed Port"], ["request", "Get Health"],
  ]);
  assert.equal(rows[0].folded, true);
  assert.equal(`${rows[0].passed}/${rows[0].total}`, "3/4");
  const inner = runRows({ collection: collections.yaml, target: COLLECTION, entries: finalEntries("yaml"), folded: new Set(["products/top sellers"]) });
  assert.deepEqual(shape(inner).slice(0, 3).map((r) => r.slice(0, 2)), [["folder", "Products"], ["folder", "top sellers"], ["request", "List Products"]]);
  assert.equal(inner[1].folded, true);
});

test("folders start unfolded, and the folders of the selected and first failed Request open again", () => {
  const entries = finalEntries("yaml");
  const all = runRows({ collection: collections.yaml, target: COLLECTION, entries });
  const failed = entries.findIndex((e) => !e.ok);
  assert.ok(all.some((r) => r.kind === "request" && r.index === failed));
  assert.deepEqual(foldersOf({ target: COLLECTION, path: entries[0].path }), ["products", "products/top sellers"]);
  assert.deepEqual(foldersOf({ target: PRODUCTS, path: entries[0].path }), ["products/top sellers"]);
  const folded = deepFreeze(new Set(["products", "products/top sellers", "orders"]));
  const open = unfoldFor({ target: COLLECTION, folded, paths: [entries[0].path, entries[failed].path] });
  assert.deepEqual([...open], ["orders"]);
  assert.equal(folded.size, 3);
  const rows = runRows({ collection: collections.yaml, target: COLLECTION, entries, folded: open });
  assert.ok(rows.some((r) => r.kind === "request" && r.index === 0));
  assert.ok(rows.some((r) => r.kind === "request" && r.index === failed));
});

test("a live Run counts against the planned totals and marks the folders of the running Request", () => {
  const planned = plannedRequests(collections.bru, COLLECTION);
  const text = output("bru-collection");
  const cut = text.indexOf("products/Missing Product");
  const p = progressOf({ planned, finished: parseProgress(text.slice(0, cut)).finished });
  assert.equal(p.running.path, "products/Missing Product.bru");
  const entries = deepFreeze([...p.finished, { ...p.running, running: true }]);
  const rows = runRows({ collection: collections.bru, target: COLLECTION, entries, planned: deepFreeze(planned) });
  assert.deepEqual(shape(rows), [
    ["folder", "Products", 0, "3/4", false, true],
    ["folder", "top sellers", 1, "1/1", false, false],
    ["request", "Best Sellers", 2],
    ["request", "List Products", 1],
    ["request", "Product Page", 1],
    ["request", "Missing Product", 1],
  ]);
  assert.equal(rows.at(-1).entry.running, true);
  // A folder whose planned Requests have not started yet has no row.
  assert.ok(!rows.some((r) => r.kind === "folder" && r.path === "orders"));
  // Once the Run ends, the totals are the listed Requests: the same rows, no jump.
  const done = runRows({ collection: collections.bru, target: COLLECTION, entries: finalEntries("bru").slice(0, 4) });
  assert.deepEqual(shape(done).map((r) => r.slice(0, 3)), shape(rows).map((r) => r.slice(0, 3)));
});

test("a folder whose Requests are not consecutive gets a new row each time it starts again", () => {
  const entries = deepFreeze([
    { path: "orders/Create Order.yml", name: "Create Order", ok: true },
    { path: "Get Health.yml", name: "Get Health", ok: true },
    { path: "orders/Closed Port.yml", name: "Closed Port", ok: false },
    { path: "products/top sellers/Best Sellers.yml", name: "Best Sellers", ok: true },
    { path: "products/List Products.yml", name: "List Products", ok: true },
    { path: "products/top sellers/Best Sellers.yml", name: "Best Sellers", ok: true },
  ]);
  const rows = runRows({ collection: collections.yaml, target: COLLECTION, entries });
  assert.deepEqual(shape(rows), [
    ["folder", "Orders", 0, "1/1", false, false],
    ["request", "Create Order", 1],
    ["request", "Get Health", 0],
    ["folder", "Orders", 0, "0/1", true, false],
    ["request", "Closed Port", 1],
    ["folder", "Products", 0, "3/3", false, false],
    ["folder", "top sellers", 1, "1/1", false, false],
    ["request", "Best Sellers", 2],
    ["request", "List Products", 1],
    ["folder", "top sellers", 1, "1/1", false, false],
    ["request", "Best Sellers", 2],
  ]);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
});

test("a Request missing from the tree is placed by its directories, named by the tree where it can be", () => {
  const entries = deepFreeze([
    { path: "products/New One.yml", name: "New One", ok: true },
    { path: "admin/users/List Users.yml", name: "List Users", ok: false },
  ]);
  const rows = runRows({ collection: collections.yaml, target: COLLECTION, entries });
  assert.deepEqual(shape(rows), [
    ["folder", "Products", 0, "1/1", false, false],
    ["request", "New One", 1],
    ["folder", "admin", 0, "0/1", true, false],
    ["folder", "users", 1, "0/1", true, false],
    ["request", "List Users", 2],
  ]);
  assert.deepEqual(shape(runRows({ collection: null, target: COLLECTION, entries })).map((r) => r.slice(0, 2)), [
    ["folder", "products"], ["request", "New One"], ["folder", "admin"], ["folder", "users"], ["request", "List Users"],
  ]);
});

test("report paths, progress paths and tree paths match whatever their extension", () => {
  const target = deepFreeze({ kind: "folder", path: "products/" });
  const names = ["products/top sellers/Best Sellers.yml", "products/top sellers/Best Sellers.bru", "products/top sellers/Best Sellers", "products\\top sellers\\Best Sellers"];
  for (const path of names) {
    const rows = runRows({ collection: collections.yaml, target, entries: deepFreeze([{ path, name: "Best Sellers", ok: true }]), planned: plannedRequests(collections.yaml, PRODUCTS) });
    assert.deepEqual(shape(rows), [["folder", "top sellers", 0, "1/1", false, false], ["request", "Best Sellers", 1]], path);
  }
  // A dot in a folder name is not an extension.
  const rows = runRows({ collection: null, target: { kind: "folder", path: "api/v1.2" }, entries: [{ path: "api/v1.2/beta/Ping.yml", name: "Ping", ok: true }] });
  assert.deepEqual(shape(rows).map((r) => r.slice(0, 3)), [["folder", "beta", 0], ["request", "Ping", 1]]);
});

test("frozen inputs are not changed, and no input gives an empty list", () => {
  const entries = finalEntries("yaml");
  const folded = deepFreeze(new Set(["orders"]));
  assert.doesNotThrow(() => runRows({ collection: collections.yaml, target: COLLECTION, entries, planned: deepFreeze(plannedRequests(collections.yaml, COLLECTION)), folded }));
  assert.deepEqual(runRows({}), []);
  assert.deepEqual(runRows({ entries: null, planned: null, folded: null }), []);
});
