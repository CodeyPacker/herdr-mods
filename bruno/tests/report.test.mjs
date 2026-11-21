import { test } from "node:test";
import assert from "node:assert/strict";
import { readRun, formatSize, formatTime, stripAnsi } from "../mods/bruno/report.js";
import { readReport, deepFreeze } from "./helpers.mjs";

// Every real report also lists the fixture's malformed Broken.yml as skipped, as the CLI does.
const run = (name, over = {}) => readRun(deepFreeze({ reportText: readReport(name), code: 0, stdout: "", stderr: "", timedOut: false, ...over }));
const header = (pairs, name) => pairs.find(([k]) => k.toLowerCase() === name)?.[1];

test("a passing Request gives one ok Response with its sent request and tests", () => {
  const r = run("pass-request.json");
  assert.equal(r.ok, true);
  assert.equal(r.message, null);
  assert.equal(r.responses.length, 1);
  const res = r.responses[0];
  assert.equal(res.name, "Get Health");
  assert.equal(res.path, "Get Health.yml");
  assert.equal(res.ok, true);
  assert.equal(res.error, null);
  assert.equal(res.method, "GET");
  assert.equal(res.url, "http://127.0.0.1:47911/health");
  assert.equal(res.requestBody, "");
  assert.equal(res.status, 200);
  assert.equal(res.statusText, "OK");
  assert.equal(typeof res.time, "number");
  assert.equal(res.size, 28);
  assert.deepEqual(res.tests, [
    { name: "res.status: eq 200", kind: "assert", ok: true, error: null },
    { name: "says ok", kind: "test", ok: true, error: null },
  ]);
});

test("the summary counts passed, failed and skipped results", () => {
  assert.deepEqual({ ...run("pass-request.json").summary, duration: 0 }, { requests: 2, passed: 1, failed: 0, skipped: 1, duration: 0 });
  assert.deepEqual({ ...run("folder.json").summary, duration: 0 }, { requests: 5, passed: 3, failed: 1, skipped: 1, duration: 0 });
  assert.ok(run("folder.json").summary.duration > 0);
});

test("a failed assertion makes the Response and the Run not ok, though the CLI marks it pass", () => {
  const r = run("fail-assertion.json", { code: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.message, null);
  const res = r.responses[0];
  assert.equal(res.status, 404);
  assert.equal(res.ok, false);
  assert.equal(res.error, null);
  assert.deepEqual(res.tests, [{ name: "res.status: eq 200", kind: "assert", ok: false, error: "expected 404 to equal 200" }]);
  assert.equal(res.language, "json");
  assert.deepEqual(JSON.parse(res.body), { error: "not found", path: "/products/999" });
});

test("a network error gives a null status, null time and size, and the error text", () => {
  const r = run("network-error.json", { code: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.message, null);
  const res = r.responses[0];
  assert.equal(res.name, "Closed Port");
  assert.equal(res.ok, false);
  assert.equal(res.status, null);
  assert.equal(res.statusText, "");
  assert.equal(res.time, null);
  assert.equal(res.size, null);
  assert.deepEqual(res.headers, []);
  assert.equal(res.body, "");
  assert.equal(res.error, "connect ECONNREFUSED 127.0.0.1:47912");
  assert.equal(res.url, "http://127.0.0.1:47912/orders");
});

test("a folder Run lists each Response with its own result", () => {
  const r = run("folder.json", { code: 1 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.responses.map((x) => [x.name, x.ok, x.status]), [
    ["Best Sellers", true, 200],
    ["List Products", true, 200],
    ["Product Page", true, 200],
    ["Missing Product", false, 404],
  ]);
});

test("headers become [name, value] pairs, leaving out headers the CLI did not send", () => {
  const res = run("pass-request.json").responses[0];
  assert.ok(res.headers.every((h) => Array.isArray(h) && h.length === 2 && typeof h[1] === "string"));
  assert.equal(header(res.headers, "content-type"), "application/json; charset=utf-8");
  assert.equal(header(res.headers, "x-shop"), "fixture");
  assert.equal(header(res.requestHeaders, "host"), "127.0.0.1:47911");
  assert.equal(header(res.requestHeaders, "content-type"), undefined);
});

test("a POST shows its sent body pretty-printed and its JSON response", () => {
  const res = run("post-request.json").responses[0];
  assert.equal(res.method, "POST");
  assert.equal(res.requestBody, '{\n  "productId": 1,\n  "quantity": 2\n}');
  assert.equal(header(res.requestHeaders, "content-type"), "application/json");
  assert.equal(res.status, 201);
  assert.equal(res.body, JSON.stringify({ id: 7, received: { productId: 1, quantity: 2 } }, null, 2));
  assert.equal(res.language, "json");
});

test("an HTML body stays as text with the html language", () => {
  const page = run("folder.json").responses.find((x) => x.name === "Product Page");
  assert.equal(page.language, "html");
  assert.match(page.body, /^<!doctype html>/);
});

test("language follows content-type, else whether the body is JSON", () => {
  const one = (data, headers) => readRun({ reportText: JSON.stringify([{ results: [{ name: "x", path: "x.yml", status: "pass", request: {}, response: { status: 200, data, headers } }] }]) }).responses[0];
  assert.equal(one("<a/>", { "Content-Type": "application/xml" }).language, "xml");
  assert.equal(one("<a/>", { "content-type": "text/xml" }).language, "xml");
  assert.equal(one('{"a":1}', {}).language, "json");
  assert.equal(one('{"a":1}', {}).body, '{\n  "a": 1\n}');
  assert.equal(one({ a: [1] }, null).body, '{\n  "a": [\n    1\n  ]\n}');
  assert.equal(one("plain words", { "content-type": "text/plain" }).language, "text");
  assert.equal(one("plain words", {}).language, "text");
  assert.equal(one(null, {}).body, "");
  assert.equal(one(null, {}).language, "text");
});

test("a timed out Run says so", () => {
  const r = readRun({ timedOut: true, code: null, stdout: "partial", reportText: null });
  assert.equal(r.ok, false);
  assert.match(r.message, /timed out/);
  assert.deepEqual(r.responses, []);
  assert.deepEqual(r.summary, { requests: 0, passed: 0, failed: 0, skipped: 0, duration: 0 });
});

test("no report and a nonzero code gives the CLI's stderr without colour codes", () => {
  const r = readRun({ reportText: null, code: 4, stdout: "out", stderr: "\x1b[31mYou can run only at the root of a collection\x1b[39m\n" });
  assert.equal(r.ok, false);
  assert.equal(r.message, "You can run only at the root of a collection");
});

test("no report, a nonzero code and empty stderr gives stdout, else the exit code", () => {
  assert.equal(readRun({ code: 1, stdout: "  \x1b[1mEnvironment file not found\x1b[22m  ", stderr: "" }).message, "Environment file not found");
  assert.match(readRun({ code: 127 }).message, /127/);
});

test("no report and a zero code says no report was written", () => {
  const r = readRun({ reportText: "", code: 0, stdout: "done" });
  assert.equal(r.ok, false);
  assert.match(r.message, /no report/);
  assert.match(r.message, /done/);
});

test("a report with zero results says the CLI ran no Request and includes stdout", () => {
  const r = readRun({ reportText: JSON.stringify([{ iterationIndex: 0, results: [], summary: {} }]), code: 0, stdout: "\x1b[33mSkipping request with prompt variables\x1b[0m" });
  assert.equal(r.ok, false);
  assert.match(r.message, /ran no Request/);
  assert.match(r.message, /Skipping request with prompt variables/);
  assert.ok(!r.message.includes("\x1b"));
});

test("a report with only skipped results names each skipped file", () => {
  const text = JSON.stringify([{ results: [{ name: "Broken.yml", path: "Broken.yml", status: "skipped", skipped: true, error: "bad line\nmore", response: { status: "skipped" } }] }]);
  const r = readRun({ reportText: text, code: 1 });
  assert.equal(r.ok, false);
  assert.match(r.message, /ran no Request/);
  assert.match(r.message, /Broken\.yml: bad line/);
  assert.equal(r.summary.skipped, 1);
});

test("report text that is not JSON gives the parse error and the CLI output", () => {
  const r = readRun({ reportText: "{ not json", code: 1, stdout: "", stderr: "boom" });
  assert.equal(r.ok, false);
  assert.match(r.message, /not valid JSON/);
  assert.match(r.message, /boom/);
});

test("a JSON report of the wrong shape is a message, not a throw", () => {
  assert.match(readRun({ reportText: '"text"' }).message, /unexpected shape/);
  assert.equal(readRun({ reportText: JSON.stringify({ results: [] }) }).message.startsWith("The Bruno CLI ran no Request"), true);
});

test("missing input is handled", () => {
  for (const input of [undefined, null, {}]) {
    const r = readRun(input);
    assert.equal(r.ok, false);
    assert.equal(typeof r.message, "string");
  }
});

test("readRun does not mutate its frozen input", () => {
  const input = deepFreeze({ reportText: readReport("folder.json"), code: 1, stdout: "", stderr: "", timedOut: false });
  assert.doesNotThrow(() => readRun(input));
});

test("formatSize uses B, KB and MB", () => {
  assert.equal(formatSize(0), "0 B");
  assert.equal(formatSize(512), "512 B");
  assert.equal(formatSize(1229), "1.2 KB");
  assert.equal(formatSize(3.4 * 1024 * 1024), "3.4 MB");
  assert.equal(formatSize(null), "");
});

test("formatTime uses ms below a second and s with two decimals above", () => {
  assert.equal(formatTime(87), "87 ms");
  assert.equal(formatTime(0), "0 ms");
  assert.equal(formatTime(1240), "1.24 s");
  assert.equal(formatTime(null), "");
});

test("stripAnsi removes colour and cursor codes and leaves the text", () => {
  assert.equal(stripAnsi("\x1b[32m✓\x1b[39m pass \x1b[1;31mfail\x1b[0m\x1b[2K"), "✓ pass fail");
  assert.equal(stripAnsi("\x1b]8;;http://x.example.test\x07link\x1b]8;;\x07"), "link");
  assert.equal(stripAnsi(null), "");
});
