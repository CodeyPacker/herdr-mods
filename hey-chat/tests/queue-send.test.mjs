import { mod, fake } from './support/mod.mjs';
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


test('a send that fails after switching chats restores only the original draft', async () => {
  let fail;
  const s = setup({ protocol: 2, send: () => new Promise((_resolve, reject) => { fail = reject; }) });
  s.v.send(s.cx);
  await new Promise(resolve => setImmediate(resolve));
  s.chat.draft = 'Another thought for the original chat';
  s.v.chatId = 'other';
  s.box.set_value('Private draft in the other chat');
  fail(new Error('Disconnected'));
  await Promise.all(s.jobs);
  assert.equal(s.box.value(), 'Private draft in the other chat');
  assert.equal(s.chat.draft, 'A follow-up\n\nAnother thought for the original chat');
  assert.equal(s.chat.attached[0].path, 'picture.png');
});

test('upgrading an old bridge never discards queued messages left after Stop', async () => {
  const calls = [];
  const wire = { protocol: 2, send: async () => calls.push('send'), quit: async () => calls.push('quit') };
  const s = setup(wire, false);
  s.chat.thread.push({ queued: true, queueId: 'waiting', text: 'Still queued' });
  s.v.send(s.cx);
  await Promise.all(s.jobs);
  assert.deepEqual(calls, ['send']);
});

test('queue editing and removal reach the bridge with the message id and replacement skill', async () => {
  const { Bridge } = await mod('agent.js');
  const wire = new Bridge({ chat: 'chat', agent: 'codex', cwd: '/tmp' }, () => {}, () => {});
  const sent = [];
  wire.sock = { write: async line => sent.push(JSON.parse(line)) };
  await wire.editQueued('waiting', '/review Updated', { name: 'review', path: '/skills/review' });
  await wire.removeQueued('waiting');
  await wire.retryTurn('failure-1');
  assert.deepEqual(sent, [
    { type: 'queue_edit', id: 'waiting', text: '/review Updated', skill: { name: 'review', path: '/skills/review' } },
    { type: 'queue_remove', id: 'waiting' },
    { type: 'retry_turn', id: 'failure-1' },
  ]);
});

test('file-only messages keep documents separate from image input', async () => {
  let checked = 0;
  fake('agent.js', { checkDocuments: async files => { checked++; assert.equal(files[0].name, 'report.pdf'); } });
  const sent = [];
  const s = setup({ protocol: 4, send: async (...args) => sent.push(args) });
  s.box.set_value('');
  const file = { kind: 'document', path: 'data/hey-chat/files/report.pdf', name: 'report.pdf' };
  s.chat.attached = [file];
  s.v.send(s.cx);
  await Promise.all(s.jobs);
  assert.equal(checked, 1);
  assert.equal(sent[0][0], '');
  assert.deepEqual(sent[0][1], []);
  assert.deepEqual(sent[0][4], [file]);
  assert.deepEqual(s.chat.attached, []);
});

test('failed file validation restores documents and the draft before starting a bridge', async () => {
  fake('agent.js', { checkDocuments: async () => { throw new Error('The saved file is missing'); } });
  const s = setup({ protocol: 4 });
  let linked = false;
  s.v.link = async () => { linked = true; };
  const file = { kind: 'document', path: 'report.pdf', name: 'report.pdf' };
  s.chat.attached = [file];
  s.v.send(s.cx);
  await Promise.all(s.jobs);
  assert.equal(linked, false);
  assert.deepEqual(s.chat.attached, [file]);
  assert.equal(s.box.value(), 'A follow-up');
  assert.equal(s.chat.thread.at(-1).text, 'The saved file is missing');
});

test('the first message keeps a name the user chose for an empty chat', async () => {
  const s = setup({ protocol: 5, send: async () => {} }, false);
  s.chat.session = null;
  s.chat.title = 'Project notes';
  s.chat.customTitle = true;
  s.v.send(s.cx);
  await Promise.all(s.jobs);
  assert.equal(s.chat.title, 'Project notes');
});
