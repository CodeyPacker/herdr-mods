import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { serve } from '../mods/hey-chat/bridge.mjs';
import { bridgeArgs, claudePermissionMode, codexPermissions, permissionLevel } from '../mods/hey-chat/bridge-options.js';

async function until(check, timeout = 4000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = check(); if (value) return value; await new Promise(r => setTimeout(r, 10)); }
  throw new Error('Permissions fixture did not settle.');
}

/** A bridge with a fake agent that records its launch args and every line written to it. */
async function bridge(t, agent, permissions) {
  const root = await mkdtemp(join(tmpdir(), 'hey-chat-permissions-'));
  const state = join(root, 'bridges');
  const spawned = [];
  const spawnAgent = (_name, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    const info = { args, lines: [] };
    spawned.push(info);
    const emit = m => child.stdout.emit('data', `${JSON.stringify(m)}\n`);
    child.stdin = { on() {}, write(line) {
      const m = JSON.parse(line);
      info.lines.push(m);
      if (agent === 'claude' && m.type === 'user') { emit({ type: 'result', subtype: 'success' }); return; }
      if (m.method === 'initialize') queueMicrotask(() => emit({ id: m.id, result: {} }));
      if (m.method === 'thread/start') queueMicrotask(() => emit({ id: m.id, result: { thread: { id: 'thread-1' } } }));
      if (m.method === 'turn/start') {
        queueMicrotask(() => emit({ id: m.id, result: { turn: { id: 'turn-1' } } }));
        queueMicrotask(() => emit({ method: 'turn/completed', params: { turn: { status: 'completed' } } }));
      }
    } };
    child.kill = () => { queueMicrotask(() => child.emit('exit', 0)); return true; };
    return child;
  };
  const handle = serve({ state, chat: 'chat', cwd: root, agent, ...(permissions ? { permissions } : {}) }, { spawnAgent, outputStatus() {}, exit() {} });
  if (!handle.server.listening) await once(handle.server, 'listening');
  const address = JSON.parse(await readFile(join(state, 'chat.json'), 'utf8'));
  const socket = connect(address.port, '127.0.0.1');
  socket.on('data', () => {});
  await once(socket, 'connect');
  socket.write(`${JSON.stringify({ role: 'pane', token: address.token })}\n`);
  t.after(async () => { socket.destroy(); await handle.close(); await rm(root, { recursive: true, force: true }); });
  return { spawned, send: m => socket.write(`${JSON.stringify(m)}\n`) };
}

test('levels map to Claude modes and Codex policies, and unknown values fall back to asking', () => {
  assert.equal(permissionLevel('nonsense'), 'ask');
  assert.deepEqual(['ask', 'edits', 'auto', 'full'].map(claudePermissionMode), ['default', 'acceptEdits', 'auto', 'bypassPermissions']);
  assert.equal(codexPermissions('auto').approvalsReviewer, 'auto_review');
  assert.deepEqual(codexPermissions('full'), { approvalPolicy: 'never', approvalsReviewer: 'user', sandboxPolicy: { type: 'dangerFullAccess' } });
  assert.deepEqual(bridgeArgs({ chat: 'c', agent: 'claude', cwd: '/p', state: '/s', permissions: 'auto' }).slice(-4, -2), ['--permissions', 'auto']);
});

test('Claude starts in the chosen mode and switches a running session without restarting', { timeout: 10000 }, async t => {
  const b = await bridge(t, 'claude', 'auto');
  b.send({ type: 'send', id: 'one', text: 'hi', images: [] });
  const claude = await until(() => b.spawned[0]);
  assert.equal(claude.args[claude.args.indexOf('--permission-mode') + 1], 'auto');
  assert.ok(claude.args.includes('--allow-dangerously-skip-permissions'));
  b.send({ type: 'permissions', level: 'full' });
  const change = await until(() => claude.lines.find(l => l.type === 'control_request'));
  assert.deepEqual(change.request, { subtype: 'set_permission_mode', mode: 'bypassPermissions' });
  assert.equal(b.spawned.length, 1);
});

test('Codex takes the level with each turn, including one carried by a message', { timeout: 10000 }, async t => {
  const b = await bridge(t, 'codex');
  b.send({ type: 'send', id: 'one', text: 'hi', images: [] });
  const codex = await until(() => b.spawned[0]);
  const first = await until(() => codex.lines.find(l => l.method === 'turn/start'));
  assert.equal(first.params.approvalPolicy, 'on-request');
  assert.equal(first.params.approvalsReviewer, 'user');
  await new Promise(r => setTimeout(r, 50));
  b.send({ type: 'send', id: 'two', text: 'again', images: [], permissions: 'auto' });
  const second = await until(() => codex.lines.filter(l => l.method === 'turn/start')[1]);
  assert.equal(second.params.approvalsReviewer, 'auto_review');
  assert.deepEqual(second.params.sandboxPolicy, { type: 'workspaceWrite' });
});
