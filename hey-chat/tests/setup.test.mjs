import { view, fake } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../install.mjs';
import { agentCommand } from '../mods/hey-chat/process.mjs';

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), 'hey-setup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('installer works in a fresh home and updates without losing unrelated bindings', async t => {
  const dir = await temp(t);
  const keysFile = join(dir, 'keys.json');
  const keys = { global: { 'ctrl-a x': 'existing' }, terminal: { 'ctrl-k': 'keep' } };
  await writeFile(keysFile, JSON.stringify(keys));
  const result = await install(dir);
  assert.equal((await readFile(join(result.destination, 'main.js'), 'utf8')).includes('class HeyChat'), true);
  const installed = JSON.parse(await readFile(keysFile, 'utf8'));
  assert.equal(installed.global['ctrl-a c'], 'mod.open:hey-chat');
  assert.equal(installed.global['ctrl-a x'], 'existing');
  assert.deepEqual(installed.terminal, keys.terminal);
  assert.deepEqual(JSON.parse(await readFile(join(result.backup, 'keys.json'), 'utf8')), keys);
  const update = await install(dir);
  assert.ok(await readFile(join(update.backup, 'mod', 'main.js')));
  const fresh = await temp(t);
  await install(fresh);
  assert.equal(JSON.parse(await readFile(join(fresh, 'keys.json'), 'utf8')).global['ctrl-a c'], 'mod.open:hey-chat');
});

test('installer refuses shortcut conflicts and invalid settings before copying files', async t => {
  const dir = await temp(t);
  for (const text of [JSON.stringify({ global: { 'ctrl-a c': 'other' } }), '{bad', '[]']) {
    await writeFile(join(dir, 'keys.json'), text);
    await assert.rejects(install(dir));
    assert.equal(await readFile(join(dir, 'keys.json'), 'utf8'), text);
    await assert.rejects(readFile(join(dir, 'mods', 'hey-chat', 'main.js')));
  }
});

test('Windows native and npm agents resolve without shell command interpolation', () => {
  const native = join('/bin with spaces', 'codex.exe');
  const options = { platform: 'win32', env: { Path: '/bin with spaces;/npm' }, home: '/home', exists: path => path === native };
  assert.deepEqual(agentCommand('codex', options), { command: native, args: [] });
  const entry = join('/npm', 'node_modules', '@openai/codex/bin/codex.js');
  const npm = agentCommand('codex', { ...options, exists: path => path === entry });
  assert.equal(npm.command, process.execPath);
  assert.deepEqual(npm.args, [entry]);
  const claude = join('/home', '.local', 'bin', 'claude.exe');
  assert.equal(agentCommand('claude', { ...options, exists: path => path === claude }).command, claude);
  assert.equal(agentCommand('codex', { ...options, exists: () => false }), null);
});

test('setup only guides fresh chats, preserves existing chats, and refreshes after Node installation', async () => {
  let state = { node: false, agents: {} };
  fake('agent.js', { checkSetup: async () => state });
  const chat = { thread: [], agent: 'claude' };
  const v = await view({ chat: () => chat, chatId: 'chat', loadChats: async () => { v.reloaded = true; } });
  const jobs = [];
  const cx = { spawn: fn => jobs.push(fn(cx)), notify() {} };
  v.refreshSetup(cx, true); await Promise.all(jobs);
  assert.equal(v.setupOpen, true);
  state = { node: true, agents: { codex: { installed: true, auth: 'ready' } } };
  v.setupOpen = false;
  v.refreshSetup(cx, true); await Promise.all(jobs);
  assert.equal(v.setupOpen, false);
  assert.equal(v.reloaded, true);
  assert.equal(chat.agent, 'codex');
  chat.session = 'session';
  state = { node: false, agents: {} };
  v.refreshSetup(cx, true); await Promise.all(jobs);
  assert.equal(v.setupOpen, false, 'do not cover an existing conversation with onboarding');
});
