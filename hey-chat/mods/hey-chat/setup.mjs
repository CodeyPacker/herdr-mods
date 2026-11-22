// Read-only checks. Never return auth output, which can contain account details.
import { agentCommand, runAgent } from './process.mjs';

const agents = {};
for (const agent of ['codex', 'claude']) {
  if (!agentCommand(agent)) { agents[agent] = { installed: false, auth: 'missing' }; continue; }
  const result = runAgent(agent, agent === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json'], { encoding: 'utf8', timeout: 5000, maxBuffer: 65536 });
  let auth = 'unknown';
  if (!result.error) {
    if (agent === 'codex') auth = result.status === 0 ? 'ready' : /not logged in|not authenticated/i.test(`${result.stdout}\n${result.stderr}`) ? 'login' : 'unknown';
    else {
      try { auth = JSON.parse(result.stdout).loggedIn ? 'ready' : 'login'; } catch { /* Older CLIs may not support auth status. */ }
    }
  }
  agents[agent] = { installed: true, auth };
}
process.stdout.write(JSON.stringify({ executable: process.execPath, node: Number(process.versions.node.split('.')[0]) >= 22, agents }));
