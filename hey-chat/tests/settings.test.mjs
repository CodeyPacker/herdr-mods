import { view, mod, fake } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetThread } from '../mods/hey-chat/messages.js';
import { handleKey } from '../mods/hey-chat/keys.js';

const { makeShortcuts, keyLabel } = await mod('shortcuts.js');

/** Herdr's shared state, kept in memory, so saved keys can be read back. */
function sharedState() {
  const state = {};
  fake('herdr', { shared: key => state[key], setShared: (key, value) => { state[key] = value; } });
  return state;
}

/** A view with two Claude chats, a open, and the shortcuts as saved in Herdr's shared state. */
async function setup() {
  const chats = ['a', 'b'].map(id => { const chat = { id, agent: 'claude', session: `session-${id}`, thread: [] }; resetThread(chat); return chat; });
  let text = '';
  const box = { value: () => text, set_value: next => { text = next; }, focus() {} };
  const v = await view({
    chats, chatId: 'a', unread: {}, fresh: [], previous: null, syncing: new Set(), bridges: new Map(), links: new Map(),
    inputs: { claude: box, codex: box }, zone: 'chat', settingsOpen: false, settingsTab: 'general',
    handle: { focus() {} }, scrollDown() {}, focusTree() {}, focusInput() { v.zone = 'chat'; },
  });
  v.shortcuts = makeShortcuts((id, on) => v.shortcutChanged(id, on));
  v.keyHints = v.shortcuts.showHints;
  const cx = { notify() {}, spawn() {}, stop_propagation() {}, bind_keys() {}, timer: { after() {} } };
  const press = (keystroke, key = keystroke) => handleKey(v, { keystroke, key }, cx);
  return { v, cx, press };
}

test('keys are written as the screen shows them', () => {
  assert.equal(keyLabel('ctrl-g'), '⌃g');
  assert.equal(keyLabel('shift-n'), 'N');
  assert.equal(keyLabel('ctrl-shift-o'), '⌃⇧o');
  assert.equal(keyLabel('alt-enter'), '⌥↵');
  assert.equal(keyLabel('ctrl--'), '⌃-');
  assert.equal(keyLabel(''), '');
});

test('a changed key works in place of the old one, in every chat tab, and shows on the hints', async () => {
  const state = sharedState();
  const s = await setup();
  s.v.previous = 'b';
  // Change "switch to the last chat" in the Shortcuts tab: open Settings, pick the row, press the new key.
  s.v.openSettings();
  s.v.setSettingsTab('shortcuts');
  const row = s.v.shortcuts.options.length + s.v.shortcuts.keys.findIndex(k => k.id === 'last');
  s.v.shortcuts.change(row);
  s.press('ctrl-y', 'y');
  assert.equal(s.v.shortcuts.keyFor('last'), 'ctrl-y');
  assert.equal(s.v.settingsOpen, true, 'choosing a key leaves Settings open');
  s.press('escape');
  assert.equal(s.v.settingsOpen, false);
  s.press('ctrl-o', 'o');
  assert.equal(s.v.chatId, 'a', 'the old key does nothing now');
  s.press('ctrl-y', 'y');
  assert.equal(s.v.chatId, 'b');
  assert.equal(s.v.keyHint('last'), '⌃y');
  // Another chat tab reads the same saved keys.
  assert.ok(Object.keys(state).some(k => k.startsWith('hey-chat.saved.')));
  assert.equal(makeShortcuts().keyFor('last'), 'ctrl-y');
});

test('a key turned off does nothing and shows no hint', async () => {
  sharedState();
  const s = await setup();
  s.v.previous = 'b';
  s.v.shortcuts.flip(s.v.shortcuts.options.length + s.v.shortcuts.keys.findIndex(k => k.id === 'last'));
  s.press('ctrl-o', 'o');
  assert.equal(s.v.chatId, 'a');
  assert.equal(s.v.keyHint('last'), '');
});

test('hiding key hints hides every key on screen but keeps the keys working', async () => {
  sharedState();
  const s = await setup();
  s.v.toggleKeyHints();
  assert.equal(s.v.keyHints, false);
  assert.equal(s.v.keyHint('allow'), '');
  s.v.previous = 'b';
  s.press('ctrl-o', 'o');
  assert.equal(s.v.chatId, 'b');
});

test('Settings covers the chat: keys don\'t reach it until Settings closes', async () => {
  sharedState();
  const s = await setup();
  s.v.previous = 'b';
  s.press('ctrl-,', ',');
  assert.equal(s.v.settingsOpen, true);
  assert.equal(s.v.zone, 'dialog', 'the keyboard leaves the message box');
  s.press('ctrl-o', 'o');
  assert.equal(s.v.chatId, 'a');
  s.press('ctrl-,', ',');
  assert.equal(s.v.settingsOpen, false);
  assert.equal(s.v.zone, 'chat');
});

test('the copy button shows on hover, stays a moment after, and copies the words', async () => {
  const s = await setup();
  Object.assign(s.v, { copyFor: null, copyLinger: 0, copied: null });
  const timers = [];
  const cx = { notify() {}, timer: { after(ms, fn) { timers.push({ ms, fn }); } }, write_to_clipboard(text) { cx.clipboard = text; } };
  s.v.hoverMessage('m1', true, cx);
  assert.equal(s.v.copyFor, 'm1');
  s.v.hoverMessage('m1', false, cx);
  assert.equal(s.v.copyFor, 'm1', 'still there right after the pointer leaves');
  assert.equal(timers.at(-1).ms, 1500);
  // Back on before it hides: the pending hide is cancelled.
  s.v.hoverMessage('m1', true, cx);
  timers.shift().fn(cx);
  assert.equal(s.v.copyFor, 'm1');
  // Onto another message: it moves there, and the old one's late "left" changes nothing.
  s.v.hoverMessage('m2', true, cx);
  s.v.hoverMessage('m1', false, cx);
  assert.equal(s.v.copyFor, 'm2');
  s.v.hoverMessage('m2', false, cx);
  timers.at(-1).fn(cx);
  assert.equal(s.v.copyFor, null);
  s.v.copyMessage({ id: 'm2', text: '**Hello** there' }, cx);
  assert.equal(cx.clipboard, '**Hello** there');
  assert.equal(s.v.copied.id, 'm2');
  timers.at(-1).fn(cx);
  assert.equal(s.v.copied, null);
});

test('the Settings dialog draws both tabs, and a message draws its copy button', async () => {
  sharedState();
  const s = await setup();
  const { settingsDialog } = await mod('views/settings.js');
  const { messageRow } = await mod('views/chat.js');
  const { findElement } = await import('./support/elements.mjs');
  const { InputState } = await import('./support/stubs/gpui-base.mjs');
  Object.assign(s.v, { width: 900, height: 700, me: { initials: 'Me', color: '#7c5cff', picture: null }, initialsInput: InputState.new(), condenseChat: true });
  const general = settingsDialog(s.v, {});
  assert.ok(findElement(general, 'condense-chat'));
  s.v.setSettingsTab('shortcuts');
  const shortcuts = settingsDialog(s.v, {});
  const row = s.v.shortcuts.options.length + s.v.shortcuts.keys.findIndex(k => k.id === 'jump');
  assert.ok(findElement(shortcuts, `shortcut-key-${row}`), 'each key is a button that waits for a new key');
  // A message with the pointer over it shows the copy button.
  Object.assign(s.v, { copyFor: 'a.0', copied: null });
  s.v.chat('a').thread.push({ id: 'a.0', kind: 'text', from: 'agent', text: 'Hello' });
  s.v.chat('a').real = true;
  const message = messageRow(s.v, {}, s.v.chat('a').thread, 0, 500);
  assert.ok(findElement(message, 'copy-a.0'));
});