import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { typescript } from "../mods/tutor/lang/typescript.js";

const modDir = fileURLToPath(new URL("../mods/tutor", import.meta.url));
const dir = await mkdtemp(join(tmpdir(), "tutor-ts-"));
let n = 0;

/** Composes, runs run.mjs the way practice.js does, and parses the result. */
async function run(ex, source) {
  const p = typescript.practice, path = join(dir, `${ex.id}.${++n}.ts`);
  await writeFile(path, p.compose(ex, source));
  const { exe, args } = p.command(path, { modDir, appHome: null });
  const r = await new Promise(done => execFile(exe, args, { timeout: 60000 }, (e, stdout, stderr) => done({ code: e ? e.code ?? 1 : 0, stdout, stderr })));
  return p.parseRun(ex, { ...r, timedOut: false });
}

const program = { id: "02-total", kind: "program", expected: "6\n" };
const checks = { id: "03-point", kind: "checks", checks: 'check("x is kept", new Point(1, 2).x === 1);\ncheck("moved adds", new Point(1, 2).moved(1).x === 2);' };

test("a program passes when it prints what is expected", async () => {
  const ok = await run(program, "const xs: number[] = [1, 2, 3];\nconsole.log(xs.reduce((a, b) => a + b, 0));");
  assert.equal(ok.passed, true);
  const wrong = await run(program, "console.log(5);");
  assert.equal(wrong.passed, false);
  assert.equal(wrong.actual, "5");
});

test("type errors name the learner's own line, and broken checks by name", async () => {
  const r = await run(program, "// totals\nconst n: number = \"6\";\nconsole.log(n);");
  assert.equal(r.compiled, false);
  assert.deepEqual(r.errors.map(e => [e.line, e.code]), [[2, "TS2322"]]);
  const b = await run(checks, "class Point { constructor(public x: number, public y: number) {} }");
  assert.equal(b.compiled, false);
  assert.deepEqual(b.errors, []);
  assert.deepEqual(b.broken.map(x => x.check), ["moved adds"]);
});

test("checks run after the learner's code, and a throw fails only its check", async () => {
  const solution = "class Point {\n  constructor(public x: number, public y: number) {}\n  moved(dx: number): Point { return new Point(this.x + dx, this.y); }\n}";
  const ok = await run(checks, solution);
  assert.equal(ok.passed, true, JSON.stringify(ok));
  const throws = await run(checks, solution.replace("return new Point(this.x + dx, this.y);", "throw new RangeError(\"no\");"));
  assert.equal(throws.passed, false);
  assert.deepEqual(throws.checks, [{ name: "x is kept", ok: true, why: null }, { name: "moved adds", ok: false, why: "threw RangeError" }]);
});

test("a crash is reported and the probe finds the compiler", async () => {
  const r = await run(program, "throw new Error(\"boom\");");
  assert.equal(r.passed, false);
  assert.match(r.crash, /boom/);
  const probe = typescript.practice.probe({ modDir, appHome: null });
  const code = await new Promise(done => execFile(probe.exe, probe.args, e => done(e ? e.code : 0)));
  assert.equal(code, 0);
});

test("exercise fields are checked", () => {
  const check = typescript.practice.check;
  assert.deepEqual(check({ ...checks, title: "t", prompt: "p", starter: "s", solution: "x", concept: "c" }), []);
  assert.match(check({ kind: "checks", checks: 'check("a", true); check("b", true);' }).join(" "), /at least 2/);
  assert.match(check({ kind: "types" }).join(" "), /not "program" or "checks"/);
});
