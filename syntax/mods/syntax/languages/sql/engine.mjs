// The check process. The runner starts it with a job file, a token, and a time limit.
import { readFile } from "node:fs/promises";
import { runCheck, snapshot } from "./check.mjs";

const token = process.env.SYNTAX_CHECK_TOKEN;
delete process.env.SYNTAX_CHECK_TOKEN;
try {
  const job = JSON.parse(await readFile(process.argv[2], "utf8"));
  const outcome = await runCheck(job, await snapshot(job.snapshot));
  process.stdout.write(`${JSON.stringify(outcome)}\n${token}\n`);
  process.exit(0);
} catch (error) {
  process.stderr.write(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
}
