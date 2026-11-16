import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runProcess } from "../mods/syntax/process.mjs";

test("Neovim opens and switches real exercise files while preserving an unsaved buffer", { timeout: 30000 }, async t => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "syntax-editor-")));
  const first = join(directory, "First.cs"), second = join(directory, "Second.cs");
  const server = join(directory, "nvim.sock");
  await writeFile(first, "// first exercise\n");
  await writeFile(second, "// second exercise\n");
  const env = { ...process.env, NVIM_LOG_FILE: join(directory, "nvim.log") };
  const remoteCommand = args => runProcess("nvim", args, { cwd: directory, env });
  const editor = spawn("nvim", ["--headless", "-u", "NONE", "--listen", server, first], { cwd: directory, env, stdio: ["ignore", "pipe", "pipe"] });
  let errors = "";
  editor.stderr.on("data", chunk => { errors += chunk; });
  t.after(async () => { editor.kill("SIGKILL"); await rm(directory, { recursive: true, force: true }); });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const probe = await remoteCommand(["--server", server, "--remote-expr", "1"]);
    if (probe.code === 0 && probe.stdout.trim() === "1") { ready = true; break; }
    if (editor.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, `Neovim did not start: ${errors}`);
  const expression = async text => {
    const result = await remoteCommand(["--server", server, "--remote-expr", text]);
    assert.equal(result.code, 0, result.stderr);
    return result.stdout.trim();
  };
  assert.equal(await expression('expand("%:p")'), first);
  await expression('setline(1, "int count = 12;")');
  const remote = await remoteCommand(["--server", server, "--remote", second]);
  assert.equal(remote.code, 0, remote.stderr);
  assert.equal(await expression('expand("%:p")'), second);
  assert.equal(await expression(`getbufline(${JSON.stringify(first)}, 1)[0]`), "int count = 12;");
  assert.equal(await expression(`getbufvar(${JSON.stringify(first)}, '&modified')`), "1");
});
