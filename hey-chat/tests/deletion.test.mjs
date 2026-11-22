import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, chmod, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { connect } from 'node:net';

const root = new URL('../mods/hey-chat/', import.meta.url);
const source = async name => (await readFile(new URL(name, root), 'utf8')).replace(/^import .*;\n/gm, '');
const tick = () => new Promise(resolve => setImmediate(resolve));

function view(Bridge, deleteSession) {
  return source('main.js').then(code => {
    const HeyChat = new Function('View', 'Bridge', 'deleteSession', code.replace('export default class', 'return class'))(class {}, Bridge, deleteSession);
    return Object.assign(Object.create(HeyChat.prototype), { bridges: new Map(), links: new Map() });
  });
}
const chat = { id: 'chat', agent: 'codex', session: 'session', cwd: '/tmp' };

test('deletion finds a disconnected bridge and waits for shutdown before deleting', async () => {
  let finish;
  const calls = [];
  class Bridge {
    constructor(o) { assert.equal(o.chat, chat.id); }
    quit() { calls.push('quit'); return new Promise(resolve => { finish = resolve; }); }
    close() { calls.push('close'); }
  }
  const v = await view(Bridge, async () => { calls.push('delete'); return { ok: true }; });
  const deleting = v.removeChatSession(chat);
  await tick();
  assert.deepEqual(calls, ['quit']);
  finish();
  assert.equal((await deleting).ok, true);
  assert.deepEqual(calls, ['quit', 'close', 'delete']);
});

test('shutdown failure keeps the chat and never deletes its session', async () => {
  let deletes = 0;
  const v = await view(class {}, async () => { deletes++; });
  v.bridges.set(chat.id, { quit: async () => { throw new Error('Shutdown timed out'); } });
  const r = await v.removeChatSession(chat);
  assert.equal(r.ok, false);
  assert.equal(r.message, 'Shutdown timed out');
  assert.equal(deletes, 0);
  assert.equal(v.bridges.has(chat.id), true);
});

test('concurrent opens share one bridge connection', async () => {
  let made = 0;
  let release;
  class Bridge {
    constructor() { made++; this.sock = null; }
    running() { return new Promise(resolve => { release = resolve; }); }
    async open() { this.sock = {}; }
  }
  const v = await view(Bridge, () => {});
  const jobs = [];
  const cx = { spawn(fn) { jobs.push(fn(cx)); }, timer: { after(_ms, fn) { setImmediate(fn); } } };
  const first = v.link(chat, cx, true);
  const second = v.link(chat, cx, true);
  assert.equal(made, 1);
  release(null);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, b);
  assert.ok(a.sock);
  await Promise.all(jobs);
});

test('bridge quit waits for the actual Codex child to release its writer', { timeout: 15000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hey-chat-delete-'));
  const state = join(dir, 'state');
  const marker = join(dir, 'writer');
  await mkdir(state);
  // A fake Codex server holds its writer briefly after SIGTERM, like a slow real shutdown.
  const fake = join(dir, 'codex');
  await writeFile(fake, `#!${process.execPath}
const fs = require('node:fs');
const readline = require('node:readline');
const marker = ${JSON.stringify(marker)};
fs.writeFileSync(marker, 'active');
process.on('SIGTERM', () => setTimeout(() => { fs.unlinkSync(marker); process.exit(0); }, 200));
readline.createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line);
  if (m.id !== undefined) {
    const result = m.method === 'thread/start' ? { thread: { id: 'fake-thread' } } : m.method === 'turn/start' ? { turn: { id: 'fake-turn' } } : {};
    process.stdout.write(JSON.stringify({ id: m.id, result }) + '\\n');
  }
});
`);
  await chmod(fake, 0o755);
  const script = fileURLToPath(new URL('bridge.mjs', root));
  const child = spawn(process.execPath, [script, 'serve', '--chat', 'chat', '--agent', 'codex', '--cwd', dir, '--state', state], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d; });
  const exited = once(child, 'exit');
  t.after(async () => { if (child.exitCode === null) child.kill('SIGTERM'); await exited; await rm(dir, { recursive: true, force: true }); });
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    try { port = JSON.parse(await readFile(join(state, 'chat.json'), 'utf8')).port; } catch {}
    if (!port) await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(port, stderr);
  const pane = connect(port, '127.0.0.1');
  t.after(() => pane.destroy());
  pane.on('error', () => {});
  await once(pane, 'connect');
  let events = '';
  pane.on('data', d => { events += d; });
  pane.write(JSON.stringify({ role: 'pane' }) + '\n' + JSON.stringify({ type: 'send', text: 'test' }) + '\n');
  for (let i = 0; i < 100 && !events.includes('fake-thread'); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(events.includes('fake-thread'), events);
  await access(marker);
  // Closing the pane leaves its writer alive. A reopened chat may have a different id
  // because older versions failed to save the original id after creating the store.
  pane.destroy();
  const finder = spawn(process.execPath, [script, 'find', '--state', state, '--agent', 'codex', '--resume', 'fake-thread']);
  let found = '';
  finder.stdout.on('data', d => { found += d; });
  assert.equal((await once(finder, 'exit'))[0], 0);
  assert.equal(JSON.parse(found).port, port);
  assert.equal(JSON.parse(found).pid, child.pid);
  const reopened = connect(JSON.parse(found).port, '127.0.0.1');
  t.after(() => reopened.destroy());
  let replay = '';
  reopened.on('data', d => { replay += d; });
  await once(reopened, 'connect');
  reopened.write(JSON.stringify({ role: 'pane' }) + '\n');
  for (let i = 0; i < 100 && !replay.includes('fake-thread'); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(replay.includes('fake-thread'), replay);
  const quitter = spawn(process.execPath, [script, 'quit', '--chat', 'reopened-chat', '--state', state, '--agent', 'codex', '--resume', 'fake-thread']);
  const [code] = await once(quitter, 'exit');
  assert.equal(code, 0);
  await assert.rejects(access(marker), { code: 'ENOENT' });
  assert.equal((await exited)[0], 0, stderr);
  await assert.rejects(access(join(state, 'chat.json')), { code: 'ENOENT' });
  // Retrying shutdown of an already stopped bridge succeeds.
  const retry = spawn(process.execPath, [script, 'quit', '--chat', 'chat', '--state', state]);
  assert.equal((await once(retry, 'exit'))[0], 0);
});
