import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../mods/hey-chat/sessions.mjs', import.meta.url));
const modelsScript = fileURLToPath(new URL('../mods/hey-chat/models.mjs', import.meta.url));

test('model selection waits for writer shutdown and keeps the conversation', async () => {
  const code = (await readFile(new URL('../mods/hey-chat/main.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '').replace('export default class', 'return class');
  const HeyChat = new Function('View', code)(class {});
  const v = Object.create(HeyChat.prototype);
  const chat = { id: 'chat', session: 'same-session', model: 'old-model', models: [{ id: 'next-model' }] };
  let release;
  const calls = [];
  const old = { quit: () => new Promise(resolve => { calls.push('quit'); release = resolve; }), close: () => calls.push('close') };
  Object.assign(v, { chatId: chat.id, chat: () => chat, bridges: new Map([[chat.id, old]]), needsYou: () => false,
    saveChats: () => calls.push('save'), modelPicker: chat.id });
  const jobs = [];
  const cx = { notify() {}, spawn(fn) { jobs.push(fn(cx)); } };
  v.chooseModel('next-model', cx);
  assert.equal(chat.modelSaving, true);
  assert.equal(chat.model, 'old-model');
  assert.deepEqual(calls, ['quit']);
  release();
  await Promise.all(jobs);
  assert.deepEqual(calls, ['quit', 'close', 'save']);
  assert.equal(chat.session, 'same-session');
  assert.equal(chat.selectedModel, 'next-model');
  assert.equal(chat.modelSaving, false);
  assert.equal(v.bridges.has(chat.id), false);
  assert.equal(v.modelPicker, null);
  v.bridges.set(chat.id, { quit: async () => { throw new Error('Still running'); } });
  chat.models.push({ id: 'third-model' });
  v.chooseModel('third-model', cx);
  await Promise.all(jobs);
  assert.equal(chat.selectedModel, 'next-model');
  assert.equal(chat.modelsError, 'Still running');
  assert.equal(v.bridges.has(chat.id), true);
  chat.working = true;
  v.chooseModel('third-model', cx);
  assert.equal(chat.modelSaving, false);
});

test('Codex model discovery handles pagination without opening a thread', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hey-chat-model-list-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fake = join(dir, 'codex');
  await writeFile(fake, `#!${process.execPath}
require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
 const m = JSON.parse(line);
 let result = {};
 if (m.method.startsWith('thread/')) process.exit(3);
 if (m.method === 'model/list') result = m.params.cursor ? { data: [{ model: 'second', displayName: 'Second' }], nextCursor: null }
   : { data: [{ model: 'first', displayName: 'First' }, { model: 'hidden', hidden: true }], nextCursor: 'page-two' };
 if (m.id !== undefined) process.stdout.write(JSON.stringify({ id: m.id, result }) + '\\n');
});
`);
  await chmod(fake, 0o755);
  const { stdout } = await run(process.execPath, [modelsScript, 'codex', dir], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
  assert.deepEqual(JSON.parse(stdout), [{ id: 'first', name: 'First' }, { id: 'second', name: 'Second' }]);
});

test('session lists and trimmed history retain the latest agent model', async t => {
  const home = await mkdtemp(join(tmpdir(), 'hey-chat-models-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const claudeDir = join(home, '.claude/projects/project');
  const codexDir = join(home, '.codex/sessions');
  await mkdir(claudeDir, { recursive: true });
  await mkdir(codexDir, { recursive: true });
  const cwd = homedir();
  const fixtures = {
    claude: [
      { type: 'user', cwd, message: { content: 'First question' } },
      { type: 'assistant', message: { model: 'old-claude', content: [{ type: 'text', text: 'First answer' }] } },
      { type: 'assistant', message: { model: 'current-claude', content: [] } },
      { type: 'assistant', isSidechain: true, message: { model: 'helper', content: [] } },
      { type: 'assistant', message: { model: '<synthetic>', content: [] } },
      { type: 'user', message: { content: 'Second question' } },
    ],
    codex: [
      { type: 'session_meta', payload: { id: 'codex-session', cwd } },
      { type: 'turn_context', payload: { model: 'old-codex' } },
      { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'First question' }] } },
      { type: 'turn_context', payload: { model: 'current-codex' } },
      { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Second question' }] } },
    ],
  };
  const files = { claude: join(claudeDir, 'claude-session.jsonl'), codex: join(codexDir, 'rollout-test.jsonl') };
  for (const agent of ['claude', 'codex']) {
    await writeFile(files[agent], fixtures[agent].map(d => JSON.stringify(d)).join('\n') + '\n');
    const { stdout } = await run(process.execPath, [script, 'read', '--agent', agent, '--file', files[agent], '--max', '1'], { env: { ...process.env, HOME: home } });
    const history = JSON.parse(stdout);
    assert.equal(history.find(e => e.type === 'model').model, `current-${agent}`);
    assert.equal(history.filter(e => e.type === 'user').length, 1);
  }
  const { stdout } = await run(process.execPath, [script, 'list'], { env: { ...process.env, HOME: home } });
  const chats = JSON.parse(stdout);
  assert.equal(chats.length, 2);
  for (const agent of ['claude', 'codex']) assert.equal(chats.find(c => c.agent === agent).model, `current-${agent}`);
});
