#!/usr/bin/env node
// Reads the agent's model options without opening a conversation or claiming its writer.
//
//   node models.mjs claude|codex <folder>
//       Prints a JSON array: { id, name }. Codex failures go to stderr with exit code 1.
import { askClaude, withCodex } from "./agent-cli.mjs";
import { errorText } from "./cli.mjs";

const [agent, cwd] = process.argv.slice(2);
if (agent === "claude") {
  // Claude Code lists its models in reply to the setup message (initialize) of its JSON mode.
  // No chat message is sent. The short names (opus, fable, ...) are the current models; the
  // pinned older versions are left out so the list stays short. Any failure gives the old list.
  const fallback = ["sonnet", "opus", "haiku"].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1) }));
  const models = await askClaude(cwd, [], { type: "control_request", request_id: "models", request: { subtype: "initialize" } }, (m) => {
    if (m.type !== "control_response" || m.response?.request_id !== "models") return undefined;
    const list = (m.response.response?.models ?? [])
      .filter((/** @type {any} */ x) => typeof x.value === "string" && !x.value.startsWith("claude-"))
      .slice(0, 5)
      .map((/** @type {any} */ x) => ({ id: x.value, name: x.displayName || x.value }));
    return list.length ? list : fallback;
  }, fallback);
  process.stdout.write(JSON.stringify(models));
} else if (agent === "codex") {
  try {
    const models = await withCodex(cwd, async (call) => {
      const found = [];
      let cursor = null;
      do {
        const page = await call("model/list", { cursor, includeHidden: false });
        for (const m of page.data ?? []) if (!m.hidden && m.model) found.push({ id: m.model, name: m.displayName || m.model });
        cursor = page.nextCursor;
      } while (cursor);
      return found;
    }, "Loading models timed out. Try again.");
    process.stdout.write(JSON.stringify(models));
  } catch (e) {
    process.stderr.write(errorText(e));
    process.exitCode = 1;
  }
} else {
  process.stderr.write("Unknown agent."); process.exitCode = 1;
}
