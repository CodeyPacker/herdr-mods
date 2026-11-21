import { test } from "node:test";
import assert from "node:assert/strict";
import { activeFilter, filterRun, isFiltering, keepMethod, keepSelection, methodValues, nextValue, NO_FILTER, RESULTS, STATUSES, SORTS, LABELS } from "../mods/bruno/runfilter.js";
import { runRows } from "../mods/bruno/runtree.js";
import { parseCollection } from "../mods/bruno/parser.js";
import { readRun } from "../mods/bruno/report.js";
import { readTree, readReport, deepFreeze } from "./helpers.mjs";

const collection = deepFreeze(parseCollection({ root: "/home/dev/shop", files: readTree("yaml") }));
const COLLECTION = deepFreeze({ kind: "collection" });
const URL = "http://127.0.0.1:47911";

/** A Collection Run in Run order, with invented times. slow-order passes with a 500: status alone never fails. */
const RUN = deepFreeze([
  { path: "products/top sellers/Best Sellers.yml", name: "Best Sellers", method: "GET", ok: true, status: 200, time: 40, url: `${URL}/products/top` },
  { path: "products/List Products.yml", name: "List Products", method: "GET", ok: true, status: 200, time: 25, url: `${URL}/products?shop=1` },
  { path: "products/Product Page.yml", name: "Product Page", method: "GET", ok: true, status: 301, time: 25, url: `${URL}/products/page` },
  { path: "products/Missing Product.yml", name: "Missing Product", method: "GET", ok: false, status: 404, time: 8, url: `${URL}/products/999` },
  { path: "orders/Create Order.yml", name: "Create Order", method: "POST", ok: true, status: 201, time: 90, url: `${URL}/orders` },
  { path: "orders/slow-order.yml", name: "slow-order", method: "POST", ok: true, status: 500, time: 1500, url: `${URL}/orders/slow` },
  { path: "orders/Closed Port.yml", name: "Closed Port", method: "DELETE", ok: false, status: null, time: null, url: "http://127.0.0.1:47912/x" },
  { path: "Get Health.yml", name: "Get Health", method: "GET", ok: true, status: 200, time: 3, url: `${URL}/health` },
]);

const run = (f = {}) => filterRun({ target: COLLECTION, entries: RUN, ...f });
const names = (f) => run(f).entries.map((e) => e.name);
/** The rows runRows draws for a filter, as short tuples. */
const rows = (f, folded) => {
  const out = run(f);
  return runRows({ collection, target: COLLECTION, entries: out.entries, counts: out.counts, folded }).map((r) => r.kind === "folder"
    ? ["folder", r.name, r.depth, `${r.passed}/${r.total}`, r.failed]
    : ["request", r.entry.name, r.depth, out.indexes[r.index]]);
};

test("no filter and Run order give the Run as it is, all shown", () => {
  const out = run();
  assert.deepEqual(out.indexes, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual([out.visible, out.total, out.filtering], [8, 8, false]);
  assert.deepEqual(rows(NO_FILTER), [
    ["folder", "Products", 0, "3/4", true],
    ["folder", "top sellers", 1, "1/1", false],
    ["request", "Best Sellers", 2, 0],
    ["request", "List Products", 1, 1],
    ["request", "Product Page", 1, 2],
    ["request", "Missing Product", 1, 3],
    ["folder", "Orders", 0, "2/3", true],
    ["request", "Create Order", 1, 4],
    ["request", "slow-order", 1, 5],
    ["request", "Closed Port", 1, 6],
    ["request", "Get Health", 0, 7],
  ]);
});

test("the result filter keeps failed or passed Requests by ok, never by status", () => {
  assert.deepEqual(names({ result: "failed" }), ["Missing Product", "Closed Port"]);
  assert.deepEqual(names({ result: "passed" }), ["Best Sellers", "List Products", "Product Page", "Create Order", "slow-order", "Get Health"]);
  assert.equal(run({ result: "failed" }).filtering, true);
});

test("the status filter keeps one status class, or the Requests with no response", () => {
  assert.deepEqual(names({ status: "2xx" }), ["Best Sellers", "List Products", "Create Order", "Get Health"]);
  assert.deepEqual(names({ status: "3xx" }), ["Product Page"]);
  assert.deepEqual(names({ status: "4xx" }), ["Missing Product"]);
  assert.deepEqual(names({ status: "5xx" }), ["slow-order"]);
  assert.deepEqual(names({ status: "error" }), ["Closed Port"]);
  assert.deepEqual(names({ status: "any" }).length, 8);
});

test("the text filter matches name, path and URL ignoring case, and every word must match", () => {
  assert.deepEqual(names({ text: "PRODUCT" }), ["Best Sellers", "List Products", "Product Page", "Missing Product"]);
  assert.deepEqual(names({ text: "top sellers" }), ["Best Sellers"]);           // the path
  assert.deepEqual(names({ text: "999" }), ["Missing Product"]);                // the URL
  assert.deepEqual(names({ text: "health" }), ["Get Health"]);
  assert.deepEqual(names({ text: "  orders   slow " }), ["slow-order"]);        // two words, both must match
  assert.deepEqual(names({ text: "orders 999" }), []);
  assert.equal(run({ text: "   " }).filtering, false);
  assert.equal(run({ text: "x" }).filtering, true);
});

test("the three filters combine", () => {
  assert.deepEqual(names({ result: "failed", status: "4xx" }), ["Missing Product"]);
  assert.deepEqual(names({ result: "failed", status: "error", text: "port" }), ["Closed Port"]);
  assert.deepEqual(names({ result: "passed", status: "2xx", text: "products" }), ["Best Sellers", "List Products"]);
  assert.deepEqual(names({ result: "passed", status: "4xx" }), []);
  const out = run({ result: "failed", status: "4xx", text: "missing" });
  assert.deepEqual([out.visible, out.total], [1, 8]);
});

test("Slowest and Fastest sort by response time inside each folder, ties in Run order, no response last", () => {
  assert.deepEqual(rows({ sort: "slowest" }).map((r) => r[1]), [
    "Products", "top sellers", "Best Sellers", "List Products", "Product Page", "Missing Product",
    "Orders", "slow-order", "Create Order", "Closed Port", "Get Health",
  ]);
  assert.deepEqual(rows({ sort: "fastest" }).map((r) => r[1]), [
    "Products", "top sellers", "Best Sellers", "Missing Product", "List Products", "Product Page",
    "Orders", "Create Order", "slow-order", "Closed Port", "Get Health",
  ]);
});

test("Status sorts by status number with no response last, Name ignores case, ties keep Run order", () => {
  const entries = deepFreeze([
    { path: "a/zeta.yml", name: "zeta", ok: false, status: null, time: null },
    { path: "a/Beta.yml", name: "Beta", ok: true, status: 404, time: 5 },
    { path: "a/alpha.yml", name: "alpha", ok: true, status: 200, time: 5 },
    { path: "a/beta2.yml", name: "beta", ok: true, status: 200, time: 5 },
    { path: "a/Gamma.yml", name: "Gamma", ok: true, status: 301, time: null },
  ]);
  const order = (sort) => filterRun({ target: COLLECTION, entries, sort }).indexes;
  assert.deepEqual(order("status"), [2, 3, 4, 1, 0]);
  assert.deepEqual(order("name"), [2, 1, 3, 4, 0]);
  assert.deepEqual(order("slowest"), [1, 2, 3, 0, 4]);   // a time missing with a status goes last too
  assert.deepEqual(order("fastest"), [1, 2, 3, 0, 4]);
  assert.deepEqual(order("run"), [0, 1, 2, 3, 4]);
  assert.deepEqual(order("nonsense"), [0, 1, 2, 3, 4]);
});

test("sorting keeps the folders where they are and the Requests inside their own folder", () => {
  assert.deepEqual(rows({ sort: "name" }), [
    ["folder", "Products", 0, "3/4", true],
    ["folder", "top sellers", 1, "1/1", false],
    ["request", "Best Sellers", 2, 0],
    ["request", "List Products", 1, 1],
    ["request", "Missing Product", 1, 3],
    ["request", "Product Page", 1, 2],
    ["folder", "Orders", 0, "2/3", true],
    ["request", "Closed Port", 1, 6],
    ["request", "Create Order", 1, 4],
    ["request", "slow-order", 1, 5],
    ["request", "Get Health", 0, 7],
  ]);
  // A Request at the top level never moves above a folder that ran before it.
  assert.equal(rows({ sort: "fastest" }).at(-1)[1], "Get Health");
});

test("a folder with no Request left is hidden, nested folders too, and counts stay those of the whole Run", () => {
  assert.deepEqual(rows({ status: "4xx" }), [
    ["folder", "Products", 0, "3/4", true],
    ["request", "Missing Product", 1, 3],
  ]);
  assert.deepEqual(rows({ text: "health" }), [["request", "Get Health", 0, 7]]);
  assert.deepEqual(rows({ text: "sellers" }), [
    ["folder", "Products", 0, "3/4", true],
    ["folder", "top sellers", 1, "1/1", false],
    ["request", "Best Sellers", 2, 0],
  ]);
  assert.deepEqual(rows({ result: "failed" }).filter((r) => r[0] === "folder"), [
    ["folder", "Products", 0, "3/4", true],
    ["folder", "Orders", 0, "2/3", true],
  ]);
  assert.deepEqual(rows({ result: "passed", text: "nothing like this" }), []);
});

test("folds still apply to the filtered list", () => {
  assert.deepEqual(rows({ result: "failed" }, new Set(["products"])).map((r) => r[1]), ["Products", "Orders", "Closed Port"]);
});

test("a folder Run of the real report filters below its target", () => {
  const entries = deepFreeze(readRun({ reportText: readReport("folder.json"), code: 1 }).responses);
  const target = deepFreeze({ kind: "folder", path: "products" });
  const out = filterRun({ target, entries, text: "top", sort: "slowest" });
  assert.deepEqual(out.entries.map((e) => e.name), ["Best Sellers"]);
  assert.deepEqual([...out.counts], [["products/top sellers", { passed: 1, total: 1, failed: false }]]);
  assert.deepEqual(filterRun({ target, entries, sort: "slowest" }).entries.map((e) => e.name), ["Best Sellers", "Product Page", "Missing Product", "List Products"]);
});

test("the selection stays when shown, else moves to the first shown Request, else to none", () => {
  assert.equal(keepSelection(3, [1, 3, 5]), 3);
  assert.equal(keepSelection(2, [5, 1, 3]), 5);
  assert.equal(keepSelection(2, []), -1);
});

test("controls cycle through their values and only the first is the default", () => {
  assert.equal(nextValue(RESULTS, "all"), "failed");
  assert.equal(nextValue(RESULTS, "passed"), "all");
  assert.equal(nextValue(STATUSES, "error"), "any");
  assert.equal(nextValue(SORTS, "name"), "run");
  assert.deepEqual([RESULTS[0], STATUSES[0], SORTS[0]], [NO_FILTER.result, NO_FILTER.status, NO_FILTER.sort]);
  for (const v of [...RESULTS, ...STATUSES, ...SORTS]) assert.ok(LABELS[v], v);
  assert.equal(isFiltering(NO_FILTER), false);
  assert.equal(isFiltering({ ...NO_FILTER, sort: "slowest" }), false);
});

test("filters apply only to a Run with more than one Response", () => {
  const f = deepFreeze({ text: "x", result: "failed", status: "4xx", method: "GET", sort: "name" });
  assert.deepEqual(activeFilter(f, 2), f);
  assert.equal(activeFilter(f, 1), NO_FILTER);
  assert.equal(activeFilter(f, 0), NO_FILTER);
  assert.deepEqual(activeFilter({ result: "passed" }, 3), { ...NO_FILTER, result: "passed" });
});

test("frozen inputs are not changed, and no input gives an empty list", () => {
  const f = deepFreeze({ target: COLLECTION, entries: RUN, text: "o", result: "passed", status: "2xx", sort: "name" });
  assert.doesNotThrow(() => filterRun(f));
  assert.deepEqual(filterRun({}).entries, []);
  assert.deepEqual(filterRun().visible, 0);
  assert.deepEqual(filterRun({ entries: null }).total, 0);
});

test("the method filter keeps one method, alone and with each other filter", () => {
  assert.deepEqual(names({ method: "POST" }), ["Create Order", "slow-order"]);
  assert.deepEqual(names({ method: "DELETE" }), ["Closed Port"]);
  assert.deepEqual(names({ method: null }).length, 8);
  assert.deepEqual(names({ method: "GET", result: "failed" }), ["Missing Product"]);
  assert.deepEqual(names({ method: "POST", status: "5xx" }), ["slow-order"]);
  assert.deepEqual(names({ method: "GET", text: "products" }), ["Best Sellers", "List Products", "Product Page", "Missing Product"]);
  assert.deepEqual(names({ method: "POST", result: "failed" }), []);
  const out = run({ method: "POST" });
  assert.deepEqual([out.visible, out.total, out.filtering], [2, 8, true]);
});

test("the method values are Any, then common methods in order, then others alphabetically", () => {
  const e = (...ms) => ms.map((method) => ({ method }));
  assert.deepEqual(methodValues(RUN), [null, "GET", "POST", "DELETE"]);
  assert.deepEqual(methodValues(e("OPTIONS", "GRPC", "PATCH", "GET", "GET", "QUERY", "HEAD", "PUT", "DELETE", "POST")),
    [null, "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "GRPC", "QUERY"]);
  assert.deepEqual(methodValues(e("get")), [null, "GET"]);
  assert.deepEqual(methodValues([]), [null]);
  assert.deepEqual(methodValues(undefined), [null]);
  assert.equal(nextValue(methodValues(RUN), "DELETE"), null);
  assert.equal(nextValue(methodValues(RUN), null), "GET");
});

test("a method absent from a new Run goes back to any, one that occurs stays", () => {
  assert.equal(keepMethod("POST", RUN), "POST");
  assert.equal(keepMethod("PUT", RUN), null);
  assert.equal(keepMethod(null, RUN), null);
  assert.equal(keepMethod("GET", []), null);
});

test("the method filter counts as a filter, clears with the others and needs more than one Response", () => {
  assert.equal(isFiltering({ ...NO_FILTER, method: "GET" }), true);
  assert.equal(NO_FILTER.method, null);
  assert.equal(activeFilter({ method: "GET" }, 2).method, "GET");
  assert.equal(activeFilter({ method: "GET" }, 1), NO_FILTER);
  assert.deepEqual(activeFilter({ method: "GET", ...NO_FILTER, method: null }, 3), NO_FILTER);
});

test("the default control values read Any, with the control's own label in the view", () => {
  assert.equal(LABELS[STATUSES[0]], "Any");
  assert.equal(LABELS.anyMethod, "Any");
  assert.equal(LABELS[RESULTS[0]], "All");
  assert.equal(LABELS[SORTS[0]], "Run order");
});

test("the method filter does not change frozen inputs", () => {
  const f = deepFreeze({ target: COLLECTION, entries: RUN, method: "GET", sort: "name" });
  assert.doesNotThrow(() => filterRun(f));
  assert.doesNotThrow(() => methodValues(RUN));
  assert.doesNotThrow(() => keepMethod("GET", RUN));
});
