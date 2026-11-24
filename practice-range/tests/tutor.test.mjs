import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { parseTutorConfig, saveTutorConfig } from "../mods/practice-range/tutor/config.js";
import { askTutor, cancelRequest, tutorContext } from "../mods/practice-range/tutor/service.mjs";
import { checkProvider, providerArguments } from "../mods/practice-range/tutor/providers.mjs";
import { runTutorProcess, windowsCommand } from "../mods/practice-range/tutor/process.mjs";
import { findLanguage } from "../mods/practice-range/languages/index.js";
import { catalogFor } from "../mods/practice-range/catalog.js";
import { exerciseFile } from "../mods/practice-range/runner.mjs";

async function fixture(t, provider = "claude") {
  const root = await mkdtemp(join(tmpdir(), "syntax-tutor-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configPath = join(root, "practice-range.json");
  await writeFile(configPath, JSON.stringify({ editor: "neovim", tutor: { enabled: true, provider } }));
  const exercise = catalogFor(findLanguage("csharp")).findExercise("variables/integer");
  const file = exerciseFile(root, exercise.id);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, "int count = 12; // learner's saved answer\n");
  await writeFile(join(root, "session.json"), JSON.stringify({ exerciseId: exercise.id, answerShown: false, result: { passed: true, title: "Correct" } }));
  const request = { id: "test-request", languageId: "csharp", exerciseId: exercise.id, question: "Why use int?", messages: [] };
  return { root, configPath, request, exercise };
}

test("AI is off by default and configuration updates preserve editor and unrelated settings", async () => {
  assert.deepEqual(parseTutorConfig(null), { enabled: false, provider: null });
  assert.equal(parseTutorConfig('{"editor":"neovim"}').enabled, false);
  let text = '{"editor":"neovim","extra":{"keep":true}}';
  const io = { read: async () => text, write: async (updated, expected) => { assert.equal(expected, text); text = updated; } };
  await saveTutorConfig("codex", io);
  assert.deepEqual(parseTutorConfig(text), { enabled: true, provider: "codex" });
  await saveTutorConfig(null, io);
  assert.equal(parseTutorConfig(text).enabled, false);
  assert.equal(JSON.parse(text).editor, "neovim");
  assert.deepEqual(JSON.parse(text).extra, { keep: true });
  await assert.rejects(saveTutorConfig("claude", { ...io, write: async () => { throw new Error("changed"); } }), /changed/);
});

test("disabled tutor rejects requests before reading context or launching a provider", async t => {
  const { root, configPath } = await fixture(t);
  await writeFile(configPath, '{}');
  let calls = 0;
  await assert.rejects(askTutor(root, configPath, {}, { run: async () => { calls++; } }), /tutor is off/);
  assert.equal(calls, 0);
});

test("questions use the saved answer and recent conversation without revealing hidden solutions", async t => {
  const { root, configPath, request, exercise } = await fixture(t);
  request.messages = [{ role: "user", content: "What is a variable?" }, { role: "assistant", content: "It holds a value." }];
  let context;
  const reply = await askTutor(root, configPath, request, { run: async (provider, args, options) => {
    assert.equal(provider, "claude");
    assert.equal(args[args.indexOf("--tools") + 1], "");
    context = JSON.parse(options.input);
    return { code: 0, stdout: JSON.stringify({ result: "int holds a whole number." }), stderr: "", problem: "" };
  } });
  assert.match(reply.reply, /whole number/);
  assert.match(context.savedAnswer, /learner's saved answer/);
  assert.equal(context.revealedAnswer, null);
  assert.equal(context.exercise.checks, undefined);
  assert.equal(context.exercise.rules, undefined);
  assert.deepEqual(context.conversation, request.messages);
  assert.equal(context.feedback.title, "Correct");
  await writeFile(join(root, "session.json"), JSON.stringify({ exerciseId: exercise.id, answerShown: true }));
  assert.equal((await tutorContext(root, request)).revealedAnswer, exercise.solution);
});

test("provider launch options disable tools and isolate requests from project configuration", () => {
  const codex = providerArguments("codex", "/tmp/request");
  assert.ok(codex.includes("--ignore-user-config"));
  assert.ok(codex.includes("features.shell_tool=false"));
  assert.ok(codex.includes("features.apply_patch_freeform=false"));
  assert.equal(codex[codex.indexOf("--sandbox") + 1], "read-only");
  const claude = providerArguments("claude", "/tmp/request");
  assert.ok(claude.includes("--safe-mode"));
  assert.ok(claude.includes("--strict-mcp-config"));
  assert.ok(claude.includes("--no-session-persistence"));
  assert.equal(claude[claude.indexOf("--tools") + 1], "");
});

for (const action of ["disable", "cancel"]) test(`${action} aborts a running tutor request`, async t => {
  const { root, configPath, request } = await fixture(t);
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = askTutor(root, configPath, request, { pollMs: 5, run: async (_provider, _args, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Tutor request cancelled.")), { once: true });
    started();
  }) });
  // Attach the rejection handler before changing settings to avoid an unhandled rejection.
  const rejected = assert.rejects(pending, /cancelled/);
  await ready;
  if (action === "disable") await writeFile(configPath, '{"tutor":{"enabled":false}}');
  else await cancelRequest(root, request.id);
  await rejected;
});

test("connecting checks CLI support and sign-in without sending a model request", async () => {
  const calls = [];
  await checkProvider("codex", async (_program, args) => {
    calls.push(args);
    return { code: 0, stdout: "--ignore-user-config --ephemeral", stderr: "", problem: "" };
  });
  assert.deepEqual(calls, [["exec", "--help"], ["login", "status"]]);
  await assert.rejects(checkProvider("claude", async () => ({ code: 1, stdout: "", problem: "" })), /Update/);
});

test("cancellation stops the owned process instead of waiting for its timeout", async () => {
  const controller = new AbortController();
  const started = Date.now();
  const pending = runTutorProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { signal: controller.signal, timeout: 5000 });
  setTimeout(() => controller.abort(), 50);
  const result = await pending;
  assert.match(result.problem, /cancelled/);
  assert.ok(Date.now() - started < 3000);
});

test("Windows finds codex and claude outside Herdr's PATH, and npm installs through Node", () => {
  const options = { env: { Path: '"/on path";/other', APPDATA: "/appdata" }, home: "/home" };
  const local = join("/home", ".local", "bin", "claude.exe");
  assert.deepEqual(windowsCommand("claude", { ...options, exists: file => file === local }), { command: local, args: [] });
  const onPath = join("/on path", "codex.exe");
  assert.deepEqual(windowsCommand("codex", { ...options, exists: file => file === onPath }), { command: onPath, args: [] });
  const entry = join("/appdata", "npm", "node_modules", "@anthropic-ai/claude-code/cli.js");
  assert.deepEqual(windowsCommand("claude", { ...options, exists: file => file === entry }), { command: process.execPath, args: [entry] });
  assert.equal(windowsCommand("claude", { ...options, exists: () => false }), null);
});
