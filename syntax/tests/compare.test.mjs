import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { command, sameAnswer } from "../mods/syntax/runner.mjs";
import { completeSetup } from "../mods/syntax/setup.mjs";
import { neovimDiffCommands, neovimDiffExpression, neovimCloseDiffsExpression } from "../mods/syntax/editor-pane.js";

const installed = { run: async () => ({ code: 0, stdout: "test", stderr: "", problem: "" }) };
const run = promisify(execFile);

test("answers that differ only in formatting count as the same", () => {
  assert.ok(sameAnswer("let x = 1; // mine\n", "let x=1;", "typescript"));
  assert.ok(sameAnswer("/* note */ a + b", "a+b", "csharp"));
  assert.ok(sameAnswer("select *\nfrom t -- all\n", "SELECT * FROM t;", "sql"), "SQL keywords ignore case");
  assert.ok(!sameAnswer("WHERE c = 'USA'", "where c = 'usa'", "sql"), "SQL string values keep their case");
  assert.ok(!sameAnswer("x - 1", "x - 2", "sql"));
  assert.ok(!sameAnswer("for (const x of xs) f(x);", "xs.forEach(f);", "typescript"));
});

test("compare writes the reference read-only, after a pass only", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-compare-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await completeSetup(root, "neovim", "sql", installed);
  let state = await command(root, "select", "where/and");
  await assert.rejects(command(root, "compare"), /Pass the exercise first/);
  await writeFile(state.file, "select name\nfrom products\nwhere stock > 50 and price < 100; -- mine\n");
  state = await command(root, "check");
  assert.equal(state.result.passed, true);
  state = await command(root, "compare");
  assert.equal(state.compare.answerFile, state.file);
  assert.equal(state.compare.referenceFile, join(root, "languages", "sql", "answers", "_reference", "where", "and", "Reference.sql"));
  assert.equal(await readFile(state.compare.referenceFile, "utf8"), "SELECT name FROM products WHERE price < 100 AND stock > 50;\n");
  assert.equal(state.compare.same, false, "Conditions in another order are worth seeing");
  if (process.platform !== "win32") assert.equal((await stat(state.compare.referenceFile)).mode & 0o222, 0, "The reference is read-only");
  await writeFile(state.file, "select name from products where price < 100 and stock > 50\n");
  await command(root, "check");
  state = await command(root, "compare");
  assert.equal(state.compare.same, true);
  state = await command(root, "status");
  assert.equal(state.compare, null, "Comparing is a one-time result, not saved in the session");
});

test("Neovim opens the diff in a new tab with the reference read-only", { timeout: 30000 }, async t => {
  try { await run("nvim", ["--version"]); } catch { t.skip("Neovim isn't installed"); return; }
  const root = await mkdtemp(join(tmpdir(), "syntax-diff-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const answer = join(root, "it's mine", "Exercise.ts");
  const reference = join(root, "Reference.ts");
  await import("node:fs/promises").then(fs => fs.mkdir(join(root, "it's mine")));
  await writeFile(answer, "const x = 1;\n");
  await writeFile(reference, "const x: number = 1;\n");
  for (const mode of ["remote", "startup"]) {
    const server = process.platform === "win32" ? `127.0.0.1:${20000 + Math.floor(Math.random() * 20000)}` : join(root, `${mode}.sock`);
    const extra = mode === "startup" ? [answer, ...neovimDiffCommands(answer, reference).flatMap(command => ["-c", command])] : [];
    const nvim = spawn("nvim", ["--headless", "--clean", "--listen", server, ...extra], { stdio: "ignore" });
    t.after(() => nvim.kill());
    const ask = async expr => (await run("nvim", ["--server", server, "--remote-expr", expr])).stdout.trim();
    for (let tries = 0; ; tries++) {
      try { await ask("1"); break; } catch (error) { if (tries > 40) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    if (mode === "remote") await ask(neovimDiffExpression(answer, reference));
    assert.equal(await ask("tabpagenr('$')"), "2", mode);
    assert.equal(await ask("expand('%:p')"), answer, `${mode}: the cursor is in your answer`);
    assert.equal(await ask("join(map(tabpagebuflist(), {_, b -> fnamemodify(bufname(b), ':t') . (getbufvar(b, '&modifiable') ? '' : ' [read-only]')}), ' | ')"), "Exercise.ts | Reference.ts [read-only]", mode);
    assert.equal(await ask("len(filter(range(1, winnr('$')), {_, w -> getwinvar(w, '&diff')}))"), "2", `${mode}: both windows diff`);
    // Comparing again replaces the earlier comparison instead of stacking tabs.
    await ask(neovimDiffExpression(answer, reference));
    assert.equal(await ask("tabpagenr('$')"), "2", `${mode}: one comparison tab at a time`);
    // Switching files, as the panel does for another exercise, closes the comparison first.
    const next = join(root, "Next.ts");
    await writeFile(next, "let y = 2;\n");
    await ask(neovimCloseDiffsExpression());
    await run("nvim", ["--server", server, "--remote", next]);
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(await ask("tabpagenr('$')"), "1", `${mode}: the comparison tab is gone`);
    assert.equal(await ask("expand('%:p')"), next);
    assert.equal(await ask("&diff"), "0", `${mode}: the new file isn't in diff mode`);
    assert.equal(await ask(`bufloaded('${answer.replaceAll("'", "''")}')`), "1", "Your answer's buffer stays loaded");
    nvim.kill();
  }
});
