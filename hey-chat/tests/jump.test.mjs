import { view, mod } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetThread } from '../mods/hey-chat/messages.js';
import { handleKey } from '../mods/hey-chat/keys.js';

const { makeShortcuts } = await mod('shortcuts.js');

/** A message box that keeps its text. One per agent, as the view has. */
function box() {
  let text = '';
  return { value: () => text, set_value: next => { text = next; }, focus() {} };
}

/** A view with three Claude chats, a, b and c, with a open. Each has a session, and its bridge has finished replaying. */
async function setup() {
  const chats = ['a', 'b', 'c'].map(id => { const chat = { id, agent: 'claude', session: `session-${id}`, thread: [], stamp: 0 }; resetThread(chat); return chat; });
  const timers = [];
  const cx = { notify() {}, spawn() {}, stop_propagation() {}, timer: { after(ms, fn) { timers.push({ ms, fn }); } } };
  const v = await view({
    chats, loaded: false, chatId: 'a', unread: {}, fresh: [], previous: null, syncing: new Set(), keyHints: true, shortcuts: makeShortcuts(),
    bridges: new Map(chats.map(c => [c.id, { synced: true }])), links: new Map(),
    inputs: { claude: box(), codex: box() }, zone: 'chat', handle: { focus() {} },
    scrollDown() {}, focusInput() {}, focusTree() {},
  });
  const finish = (id, replaying = false) => {
    if (replaying) v.bridges.get(id).synced = false;
    v.onEvent(v.chat(id), { type: 'turn_end' }, cx);
  };
  const press = keystroke => handleKey(v, { keystroke }, cx);
  return { v, cx, timers, finish, press };
}

test('⌃g cycles through every chat that waits on you or finished, in list order', async () => {
  const s = await setup();
  s.finish('b');
  s.v.onEvent(s.v.chat('c'), { type: 'permission', id: 'ask-c', tool: 'Bash', input: { command: 'ls' } }, s.cx);
  assert.equal(s.v.unread.b, true);
  s.press('ctrl-g');
  assert.equal(s.v.chatId, 'b', 'the finished chat after the open one');
  s.press('ctrl-g');
  assert.equal(s.v.chatId, 'c', 'then the waiting one');
  assert.equal(s.v.jumpTarget(), null, 'b was opened, so only c is left, and it is open');
  s.v.chatId = 'a';
  assert.equal(s.v.jumpTarget(), 'c', 'c waits until you answer it');
});

test('⌃g wraps around and skips the open chat', async () => {
  const s = await setup();
  for (const id of ['a', 'c']) s.v.onEvent(s.v.chat(id), { type: 'permission', id: `ask-${id}`, tool: 'Bash', input: { command: 'ls' } }, s.cx);
  s.v.chatId = 'b';
  s.press('ctrl-g');
  assert.equal(s.v.chatId, 'c');
  s.press('ctrl-g');
  assert.equal(s.v.chatId, 'a');
  s.press('ctrl-g');
  assert.equal(s.v.chatId, 'c');
});

test('replayed turns are not news: no unread dot and no ⌃g', async () => {
  const s = await setup();
  s.finish('b', true);
  assert.equal(s.v.unread.b, undefined);
  assert.equal(s.v.jumpTarget(), null);
});

test('⌃o switches between the last two chats, as many times as you press it', async () => {
  const s = await setup();
  s.press('ctrl-o');
  assert.equal(s.v.chatId, 'a', 'no chat before this one yet');
  s.v.openChat('b', s.cx);
  s.v.openChat('c', s.cx);
  for (const expected of ['b', 'c', 'b', 'c', 'b']) {
    s.press('ctrl-o');
    assert.equal(s.v.chatId, expected);
  }
  // A deleted chat can't be gone back to.
  s.v.chats = s.v.chats.filter(c => c.id !== 'c');
  s.press('ctrl-o');
  assert.equal(s.v.chatId, 'b');
});

test('the jump keys are always taken, so the message box never gets them', async () => {
  const s = await setup();
  for (const key of ['ctrl-g', 'ctrl-o']) {
    let stopped = false;
    handleKey(s.v, { keystroke: key }, { ...s.cx, stop_propagation() { stopped = true; } });
    assert.equal(stopped, true, key);
  }
});

test('each chat keeps what you typed in its box', async () => {
  const s = await setup();
  s.v.inputs.claude.set_value('Half a thought for a');
  s.finish('b');
  s.press('ctrl-g');
  assert.equal(s.v.inputs.claude.value(), '', 'the draft stays with its chat');
  s.v.inputs.claude.set_value('A reply to b');
  s.press('ctrl-o');
  assert.equal(s.v.inputs.claude.value(), 'Half a thought for a');
  s.press('ctrl-o');
  assert.equal(s.v.inputs.claude.value(), 'A reply to b');
});

test('a new chat with a draft stays when you leave it', async () => {
  const s = await setup();
  s.v.chat('a').session = null; // a new chat, never sent
  s.v.inputs.claude.set_value('Not sent yet');
  s.v.openChat('b', s.cx);
  assert.ok(s.v.chats.some(c => c.id === 'a'), 'a has no messages, but it has a draft');
  s.v.openChat('a', s.cx);
  s.v.inputs.claude.set_value('');
  s.v.openChat('b', s.cx);
  assert.equal(s.v.chats.some(c => c.id === 'a'), false, 'an empty new chat still goes away');
});


test('an image-only draft stays with its chat when switching', async () => {
  const s = await setup();
  s.v.chat('a').session = null;
  s.v.chat('a').attached = [{ path: '/tmp/image.png' }];
  s.v.openChat('b', s.cx);
  assert.ok(s.v.chats.some(c => c.id === 'a'));
  assert.equal(s.v.chat('b').attached, undefined);
  s.v.openChat('a', s.cx);
  assert.equal(s.v.chat('a').attached[0].path, '/tmp/image.png');
});

test('typing saves after a pause and captures the active draft without switching chats', async () => {
  const s = await setup();
  s.v.loaded = true;
  const saved = [];
  s.v.saveChats = () => saved.push(s.v.chat('a').draft);
  s.v.inputs.claude.set_value('First');
  s.v.draftChanged(s.cx);
  s.v.inputs.claude.set_value('Latest');
  s.v.draftChanged(s.cx);
  for (const timer of s.timers) timer.fn(s.cx);
  assert.deepEqual(saved, ['Latest']);
});


test('changing agents keeps the current draft and never revives text from another chat', async () => {
  const s = await setup();
  s.v.inputs.claude.set_value('Draft for a');
  s.v.setChatAgent(s.v.chat('a'), 'codex');
  assert.equal(s.v.inputs.codex.value(), 'Draft for a');
  s.v.openChat('b', s.cx);
  assert.equal(s.v.inputs.claude.value(), '');
  s.v.setChatAgent(s.v.chat('b'), 'codex');
  assert.equal(s.v.inputs.codex.value(), '');
  s.v.inputs.codex.set_value('Draft for b');
  s.v.openChat('a', s.cx);
  assert.equal(s.v.inputs.codex.value(), 'Draft for a');
  s.v.setChatAgent(s.v.chat('a'), 'claude');
  assert.equal(s.v.inputs.claude.value(), 'Draft for a');
});
