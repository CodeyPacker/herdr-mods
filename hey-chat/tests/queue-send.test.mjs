import { mod } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { default: HeyChat } = await mod('main.js');
function setup(wire, working = true) {
  const chat = { id: 'chat', agent: 'codex', session: 'same-session', working, thread: [], attached: [{ path: 'picture.png' }] };
  let text = 'A follow-up';
  const box = { value: () => text, set_value: x => { text = x; } };
  const v = Object.assign(Object.create(HeyChat.prototype), {
    chatId: chat.id, chat: () => chat, bridges: new Map([[chat.id, wire]]),
    inputFor: () => box, question: () => null, codexSkill: () => null,
    saveChats() {}, missingCli: () => null, scrollDown() {}, link: async () => wire,
  });
  const jobs = [];
  const cx = { notify() {}, spawn(fn) { jobs.push(fn(cx)); } };
  return { v, chat, box, cx, jobs };
}

test('sending during work queues messages without stopping the turn and clears the composer', async () => {
  const sent = [];
  const s = setup({ protocol: 2, send: async (...args) => sent.push(args) });
  s.v.send(s.cx);
  assert.equal(s.box.value(), '');
  assert.deepEqual(s.chat.attached, []);
  assert.equal(s.chat.working, true);
  assert.equal(s.chat.connecting, false);
  s.box.set_value('One more');
  s.v.send(s.cx);
  await Promise.all(s.jobs);
  assert.equal(sent.length, 2);
  assert.equal(sent[0][0], 'A follow-up');
  assert.equal(sent[0][1][0].path, 'picture.png');
  assert.notEqual(sent[0][3], sent[1][3]);
});

test('failed queue submission restores the message and attachments without overwriting a newer draft', async () => {
  const s = setup({ protocol: 2, send: async () => { throw new Error('Disconnected'); } });
  s.v.send(s.cx);
  await Promise.all(s.jobs);
  assert.equal(s.box.value(), 'A follow-up');
  assert.equal(s.chat.attached[0].path, 'picture.png');
  assert.equal(s.chat.thread.at(-1).text, 'Disconnected');
  const next = setup({ protocol: 2, send: async () => { throw new Error('Disconnected'); } });
  next.v.send(next.cx);
  next.box.set_value('A newer draft');
  await Promise.all(next.jobs);
  assert.equal(next.box.value(), 'A follow-up\n\nA newer draft');
  assert.equal(next.chat.attached[0].path, 'picture.png');
});

test('an older idle bridge releases its writer before the queue-capable bridge starts', async () => {
  const calls = [];
  let release;
  const old = { protocol: 1, quit: () => new Promise(resolve => { calls.push('quit'); release = resolve; }), close: () => calls.push('close') };
  const next = { protocol: 2, send: async () => calls.push('send') };
  const s = setup(old, false);
  let links = 0;
  s.v.link = async () => ++links === 1 ? old : (calls.push('new bridge'), next);
  s.v.send(s.cx);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['quit']);
  release();
  await Promise.all(s.jobs);
  assert.deepEqual(calls, ['quit', 'close', 'new bridge', 'send']);
  assert.equal(s.chat.session, 'same-session');
});
