import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSyncConfig } from "../mods/practice-range/editor-config.js";
import { pull, push, GITIGNORE } from "../mods/practice-range/sync.mjs";

const git = (folder, ...args) => execFileSync("git", ["-C", folder, ...args], { encoding: "utf8" });

test("device sync is off unless the config turns it on", () => {
  for (const text of [null, "", "{}", '{"editor":"neovim"}', '{"sync":false}', '{"sync":null}']) assert.equal(parseSyncConfig(text), false);
  assert.equal(parseSyncConfig('{"sync":true}'), true);
  assert.throws(() => parseSyncConfig('{"sync":"yes"}'), /sync must be true or false/);
});

/** A bare repo standing in for GitHub, cloned as two computers' practice folders. */
async function twoDevices() {
  const root = await mkdtemp(join(tmpdir(), "practice-sync-"));
  const remote = join(root, "remote.git");
  execFileSync("git", ["init", "--bare", "-b", "main", remote]);
  const clone = name => {
    const folder = join(root, name);
    execFileSync("git", ["clone", "-q", remote, folder]);
    git(folder, "config", "user.name", "Test");
    git(folder, "config", "user.email", "test@example.com");
    return folder;
  };
  return { root, first: clone("first"), second: clone("second") };
}

test("progress and answers travel between devices, machine files stay behind", async () => {
  const { first, second } = await twoDevices();
  const files = {
    "courses/course%3Ats-foundations/current.json": '{"courseId":"course:ts-foundations","contentVersion":"0.1.0-preview.1"}',
    "session.json": "{\"progress\":{}}",
    "setup.json": "{}",
    "session.lock": "",
    "answers/variables/integer/Program.cs": "int x = 1;",
    "answers/_reference/variables/integer/Reference.cs": "int x = 1;",
    "answers/_scratch/bin/Debug/x.dll": "binary",
    "history/variables/integer/1.cs": "int x;",
    "checker/abc/out.dll": "binary",
    "checks/123/run.cs": "",
    "languages/typescript/session.json": "{\"progress\":{}}",
    "languages/typescript/answers/types/alias/answer.ts": "type A = 1;",
    "languages/typescript/checker/x.js": "",
    "session.json.bak-before-sync": "",
  };
  for (const [path, text] of Object.entries(files)) {
    await mkdir(join(first, path, ".."), { recursive: true });
    await writeFile(join(first, path), text);
  }
  assert.equal(await push(first), "Pushed progress.");
  assert.deepEqual(git(first, "ls-files").trim().split("\n").sort(), [
    ".gitignore",
    "answers/variables/integer/Program.cs",
    "courses/course%3Ats-foundations/current.json",
    "history/variables/integer/1.cs",
    "languages/typescript/answers/types/alias/answer.ts",
    "languages/typescript/session.json",
    "session.json",
  ]);

  await pull(second);
  assert.equal(await readFile(join(second, "languages/typescript/session.json"), "utf8"), "{\"progress\":{}}");

  // Practice on the second computer, then come back to the first.
  await writeFile(join(second, "session.json"), "{\"progress\":{\"integer\":{}}}");
  assert.equal(await push(second), "Pushed progress.");
  assert.equal(await push(second), "No new progress.");
  await pull(first);
  assert.equal(await readFile(join(first, "session.json"), "utf8"), "{\"progress\":{\"integer\":{}}}");
});

test("a practice folder that is not its own repo reports how to fix it", async () => {
  const { first } = await twoDevices();
  const nested = join(first, "data");
  await mkdir(nested);
  await assert.rejects(pull(nested), /not a git repo/);
  await assert.rejects(push(await mkdtemp(join(tmpdir(), "practice-plain-"))), /not a git repo/);
});

test("course progress, answers and backups sync while local course artifacts stay behind", async () => {
  const { first, second } = await twoDevices();
  const course = "courses/course%3Ats-foundations/0.1.0-preview.1";
  const files = {
    [`${course}/enrollment.json`]: '{"position":{"moduleId":"values","step":2}}',
    [`${course}/answers/remaining/Exercise.ts`]: "let remaining = opening - change;",
    [`${course}/history/remaining/1.ts`]: "let remaining = 0;",
    [`${course}/checks/check.ts`]: "trusted checker artifact",
    [`${course}/course.lock`]: "",
    [`${course}/attachments.json`]: '{"root":"/private/repo"}',
    [`${course}/answers/remaining/node_modules/internal.js`]: "dependency",
  };
  // Existing users have the old generated allow-list. Upgrade that exact version only.
  await writeFile(join(first, ".gitignore"), GITIGNORE.slice(0, GITIGNORE.indexOf("!/courses/")));
  for (const [path, text] of Object.entries(files)) {
    await mkdir(join(first, path, ".."), { recursive: true });
    await writeFile(join(first, path), text);
  }
  await push(first);
  assert.deepEqual(git(first, "ls-files").trim().split("\n").sort(), [".gitignore",
    `${course}/answers/remaining/Exercise.ts`, `${course}/enrollment.json`, `${course}/history/remaining/1.ts`]);
  await pull(second);
  assert.equal(await readFile(join(second, course, "answers/remaining/Exercise.ts"), "utf8"), files[`${course}/answers/remaining/Exercise.ts`]);
  assert.equal(await readFile(join(first, ".gitignore"), "utf8"), GITIGNORE);
});

test("sync preserves a customized ignore file", async () => {
  const { first } = await twoDevices();
  const custom = GITIGNORE + "# My extra rule\ncustom/\n";
  await writeFile(join(first, ".gitignore"), custom);
  await push(first);
  assert.equal(await readFile(join(first, ".gitignore"), "utf8"), custom);
});

test("the first computer can start from git init and an empty remote", async () => {
  const { root, second } = await twoDevices();
  const first = join(root, "fresh");
  await mkdir(first);
  git(first, "init", "-q", "-b", "main");
  git(first, "config", "user.name", "Test");
  git(first, "config", "user.email", "test@example.com");
  git(first, "remote", "add", "origin", join(root, "remote.git"));
  await writeFile(join(first, "session.json"), "{}");
  assert.equal(await pull(first), "Nothing to pull yet.");
  assert.equal(await push(first), "Pushed progress.");
  assert.equal(await pull(second), "Pulled progress.");
  assert.equal(await readFile(join(second, "session.json"), "utf8"), "{}");
});
