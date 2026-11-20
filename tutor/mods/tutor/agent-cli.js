// The command line for each agent Tutor can use, and reading its reply. Every call is read-only:
// the agent may read the repo and run git's read commands, never change a file.
// Plain JavaScript with no Herdr imports, so tests can use it.
import { TOOLS } from "./constants.js";

// Codex: a read-only sandbox, never asking for approval, and nothing beyond reading the repo.
// --ignore-user-config keeps the user's own Codex setup (MCP servers, plugins) out of Tutor's calls.
const CODEX_CONFIG = ["approval_policy=\"never\"", "sandbox_mode=\"read-only\"", "web_search=\"disabled\"",
  "features.apply_patch_freeform=false", "features.multi_agent=false", "features.apps=false", "features.plugins=false"]
  .flatMap(c => ["--config", c]);

export const AGENT_CLIS = {
  claude: {
    exe: "claude",
    name: "Claude",
    /** Flags for one call; the prompt comes on stdin. `files.reply` is unused: the reply is stdout. */
    args: (session, _files) => ["-p", "--output-format", "json", ...(session ? ["--resume", session] : []), ...TOOLS],
    replyOnStdout: true,
  },
  codex: {
    exe: "codex",
    name: "Codex",
    /**
     * `codex exec` for the first call, `codex exec resume <id>` after. exec's own flags go before
     * `resume`, and "-" reads the prompt from stdin. --json prints events on stdout, the first of
     * which carries the session's thread id; --output-last-message writes the reply to `files.reply`.
     */
    args: (session, files) => ["exec", "--json", "--skip-git-repo-check", "--ignore-user-config", ...CODEX_CONFIG,
      "--output-last-message", files.reply, ...(session ? ["resume", session] : []), "-"],
    replyOnStdout: false,
  },
};

export const agentCli = id => AGENT_CLIS[id] ?? AGENT_CLIS.claude;

/**
 * The reply and session id from one call. `stdout` is what the CLI printed, `reply` the reply
 * file's text (Codex only), `err` its stderr. Throws one readable sentence.
 */
export function readReply(id, { stdout, reply, err }) {
  const cli = agentCli(id);
  if (cli === AGENT_CLIS.codex) {
    let session = null;
    for (const line of String(stdout ?? "").split("\n")) {
      try { const e = JSON.parse(line); if (e?.type === "thread.started" && e.thread_id) session = e.thread_id; } catch { /* not an event */ }
    }
    const text = String(reply ?? "").trim();
    if (!text) {
      const failed = String(stdout ?? "").split("\n").map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(e => e?.type === "error" || e?.type === "turn.failed").map(e => e.message ?? e.error?.message).filter(Boolean).at(-1);
      throw new Error((failed || err || "Codex returned nothing. Check codex login status.").trim().slice(-600));
    }
    return { text, session };
  }
  let out;
  try { out = JSON.parse(String(stdout ?? "").replace(/^﻿/, "")); }
  catch { throw new Error((err || stdout || "Claude returned nothing.").trim().slice(-600)); }
  if (out.is_error) throw new Error(String(out.result || "Claude reported an error."));
  return { text: String(out.result ?? ""), session: out.session_id ?? null };
}
