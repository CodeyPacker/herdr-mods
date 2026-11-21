import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("submission markers survive metadata edits and change on resubmission", () => {
  const folder = mkdtempSync(join(tmpdir(), "herdr-submission-"));
  const script = fileURLToPath(new URL("../mods/tickets/ticket.mjs", import.meta.url));
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [script, ...args, "--in", folder, "--json"],
    { encoding: "utf8", env: { ...process.env, HERDR_TICKETS_DIR: join(folder, "tickets") } }));
  try {
    run("create", "Recover uploads");
    const first = run("submit", "1", "Retries implemented");
    assert.ok(first.submitted);
    run("tour", "1"); run("edit", "1", "--title", "Recover transient failures");
    assert.equal(run("show", "1").submitted, first.submitted);
    const second = run("submit", "1", "Permanent failures now handled");
    assert.notEqual(second.submitted, first.submitted);
    assert.equal(second.status, "review");
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
