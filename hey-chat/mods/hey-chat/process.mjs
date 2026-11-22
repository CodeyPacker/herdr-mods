// Launch native agent binaries or npm's JS entry points without a shell.
import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';

export function agentCommand(agent, { platform = process.platform, env = process.env, home = homedir(), exists = executable } = {}) {
  if (!['claude', 'codex'].includes(agent)) throw new Error('Unknown agent.');
  const windows = platform === 'win32';
  const path = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] ?? '';
  const dirs = [...path.split(windows ? ';' : delimiter).filter(Boolean), join(home, '.local', 'bin'), ...(windows && env.APPDATA ? [join(env.APPDATA, 'npm')] : [])];
  for (const dir of dirs) {
    const binary = join(dir.replace(/^"|"$/g, ''), windows ? `${agent}.exe` : agent);
    if (exists(binary)) return { command: binary, args: [] };
    if (windows) {
      const entry = join(dir, 'node_modules', agent === 'codex' ? '@openai/codex/bin/codex.js' : '@anthropic-ai/claude-code/cli.js');
      if (exists(entry, true)) return { command: process.execPath, args: [entry] };
    }
  }
  return null;
}

function executable(file, readable = false) {
  try { accessSync(file, readable || process.platform === 'win32' ? constants.R_OK : constants.X_OK); return true; } catch { return false; }
}

export function spawnAgent(agent, args, options = {}) {
  const found = agentCommand(agent);
  // Preserve asynchronous spawn errors so the bridge can report a missing command.
  return spawn(found?.command ?? agent, [...(found?.args ?? []), ...args], { ...options, windowsHide: true });
}

export function runAgent(agent, args, options = {}) {
  const found = agentCommand(agent);
  return spawnSync(found?.command ?? agent, [...(found?.args ?? []), ...args], { ...options, windowsHide: true });
}
