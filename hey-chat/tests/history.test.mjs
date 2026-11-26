import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { view, mod, fake } from './support/mod.mjs';
import { applyEvent, resetThread } from '../mods/hey-chat/messages.js';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../mods/hey-chat/sessions.mjs', import.meta.url));

for (const agent of ['claude', 'codex']) {
  test(`${agent} restores and searches messages older than 40 turns, including before a live bridge`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'hey-chat-history-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const file = join(root, 'session.jsonl');
    const start = Date.parse('2026-01-01T00:00:00Z');
    const lines = [];
    for (let i = 0; i < 85; i++) {
      const timestamp = new Date(start + i * 1000).toISOString();
      const user = `Question ${i}`;
      const answer = i === 0 ? 'The earliest answer has the secret phrase.' : `Answer ${i}`;
      if (agent === 'claude') {
        lines.push({ timestamp, type: 'user', message: { content: user } });
        lines.push({ timestamp, type: 'assistant', message: { model: 'claude-model', content: [{ type: 'text', text: answer }] } });
      } else {
        lines.push({ timestamp, type: 'turn_context', payload: { model: 'codex-model' } });
        lines.push({ timestamp, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: user }] } });
        lines.push({ timestamp, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: answer }] } });
      }
    }
    await writeFile(file, lines.map(x => JSON.stringify(x)).join('\n'));
    const read = async (...args) => JSON.parse((await run(process.execPath, [script, 'read', '--agent', agent, '--file', file, '--images', root, ...args])).stdout);
    for (const args of [[], ['--max', '0']]) {
      const events = await read(...args);
      assert.equal(events.filter(e => e.type === 'user').length, 85);
      assert.equal(events.find(e => e.type === 'user').text, 'Question 0');
      assert.equal(events.filter(e => e.type === 'text').at(-1).text, 'Answer 84');
    }
    const limited = await read('--max', '40');
    assert.equal(limited.filter(e => e.type === 'user').length, 40);
    assert.equal(limited.find(e => e.type === 'user').text, 'Question 45');

    const chat = { id: 'history', agent, file };
    resetThread(chat);
    const before = start + 60 * 1000;
    const events = await read('--before', String(before));
    assert.equal(events.filter(e => e.type === 'user').length, 60);
    fake('agent.js', { readSession: async (_agent, _file, cutoff) => {
      assert.equal(cutoff, before);
      return events;
    } });
    const positions = [];
    const v = await view({ chats: [chat], chatId: chat.id, condenseChat: true,
      chatSearchInput: { value: () => 'SECRET PHRASE' }, chatSearchIndex: 0,
      scroll: { scroll_to_item: i => positions.push(i) }, syncOutputs() {}, scrollDown() {} });
    await v.loadHistory(chat, before, { notify() {} });
    for (let i = 60; i < 85; i++) {
      applyEvent(chat, { type: 'user', text: `Question ${i}`, at: start + i * 1000 });
      applyEvent(chat, { type: 'text', text: `Answer ${i}` });
    }
    assert.equal(chat.thread.filter(m => m.from === 'me').length, 85);
    assert.equal(v.chatMatches().length, 1);
    v.findChatMatch(0);
    assert.equal(v.visibleThread(chat)[positions.at(-1)].text, 'The earliest answer has the secret phrase.');
    assert.equal(chat.model, `${agent}-model`);
  });
}

test('the pane requests unlimited history by default', async () => {
  const { readSession } = await mod('agent.js');
  fake('herdr', { exec: async (_command, args) => {
    assert.equal(args[args.indexOf('--max') + 1], '0');
    return { code: 0, stdout: '[]' };
  } });
  assert.deepEqual(await readSession('claude', '/tmp/session.jsonl', 0), []);
});
