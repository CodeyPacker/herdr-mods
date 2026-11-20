import test from "node:test";
import assert from "node:assert/strict";
import { agentCli, readReply } from "../mods/tutor/agent-cli.js";

test("claude calls are read-only and resume by session id", () => {
  const first = agentCli("claude").args(null, { reply: "/r" });
  assert.deepEqual(first.slice(0, 3), ["-p", "--output-format", "json"]);
  assert.ok(first.includes("--allowedTools"));
  assert.ok(!first.includes("--resume"));
  assert.deepEqual(agentCli("claude").args("abc", { reply: "/r" }).slice(3, 5), ["--resume", "abc"]);
  assert.deepEqual(readReply("claude", { stdout: '{"result":"hi","session_id":"s1"}' }), { text: "hi", session: "s1" });
  assert.throws(() => readReply("claude", { stdout: '{"is_error":true,"result":"limit"}' }), /limit/);
  assert.throws(() => readReply("claude", { stdout: "", err: "not signed in" }), /not signed in/);
});

test("codex runs in a read-only sandbox and resumes by thread id", () => {
  const first = agentCli("codex").args(null, { reply: "/tmp/r.txt" });
  assert.equal(first[0], "exec");
  assert.ok(first.includes('sandbox_mode="read-only"'));
  assert.ok(first.includes('approval_policy="never"'));
  assert.deepEqual(first.slice(first.indexOf("--output-last-message"), first.indexOf("--output-last-message") + 2), ["--output-last-message", "/tmp/r.txt"]);
  assert.equal(first.at(-1), "-");
  assert.ok(!first.includes("resume"));
  const again = agentCli("codex").args("t-1", { reply: "/tmp/r.txt" });
  // exec's flags come before the resume subcommand; the prompt comes from stdin.
  assert.deepEqual(again.slice(-3), ["resume", "t-1", "-"]);
  const events = ['{"type":"thread.started","thread_id":"t-9"}', '{"type":"turn.started"}', "not json", '{"type":"turn.completed"}'].join("\n");
  assert.deepEqual(readReply("codex", { stdout: events, reply: " the answer \n" }), { text: "the answer", session: "t-9" });
  assert.throws(() => readReply("codex", { stdout: '{"type":"error","message":"usage limit reached"}', reply: "" }), /usage limit/);
  assert.throws(() => readReply("codex", { stdout: "", reply: null, err: "" }), /codex login status/);
  assert.equal(agentCli("nope"), agentCli("claude"));
});
