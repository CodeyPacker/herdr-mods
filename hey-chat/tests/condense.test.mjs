import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyEvent, resetThread, visibleMessages, currentActivity, describeActivity } from '../mods/hey-chat/messages.js';

test('condensed history preserves conversation and unanswered requests while hiding all tool cards', () => {
  const chat = { id: 'chat' };
  resetThread(chat);
  const directive = '::browser-complete{title="Verified the model picker"}';
  for (const ev of [
    { type: 'user', text: 'Please edit this file.' },
    { type: 'tool', id: 'run', name: 'Bash', input: { command: 'ls' } },
    { type: 'tool', id: 'used', name: 'cua_repl.js' },
    { type: 'tool', id: 'read', name: 'Read', input: { file_path: 'main.js' } },
    { type: 'tool', id: 'edit', name: 'Edit', input: { file_path: 'main.js', old_string: 'old', new_string: 'new' } },
    { type: 'tool', id: 'patch', name: 'CodexPatch', input: { changes: [{ path: 'other.js', diff: '+new' }] } },
    { type: 'tool', id: 'write', name: 'Write', input: { file_path: 'new.js', content: 'new' } },
    { type: 'permission', id: 'done', tool: 'Bash', input: { command: 'ls' } },
    { type: 'decided', id: 'done', behavior: 'allow' },
    { type: 'permission', id: 'pending', tool: 'Bash', input: { command: 'git status' } },
    { type: 'question', id: 'q', questions: [{ id: 'one', question: 'Which file?' }] },
    { type: 'text', text: directive },
    { type: 'text', text: 'Edited the file.' },
    { type: 'error', message: 'A connection failed.' },
  ]) applyEvent(chat, ev);
  const visible = visibleMessages(chat, true);
  assert.deepEqual(visible.filter(m => m.kind === 'tool'), []);
  assert.deepEqual(visible.filter(m => m.kind === 'permission').map(m => m.ask), ['pending']);
  assert.ok(visible.some(m => m.kind === 'question'));
  assert.ok(visible.some(m => m.kind === 'error'));
  assert.ok(visible.some(m => m.text === 'Please edit this file.'));
  assert.ok(visible.some(m => m.text === 'Edited the file.'));
  assert.equal(visible.some(m => m.text === directive), false);
  assert.equal(visibleMessages(chat, false), chat.thread);
  assert.ok(chat.thread.some(m => m.text === directive));
  applyEvent(chat, { type: 'user', text: directive });
  assert.ok(visibleMessages(chat, true).some(m => m.from === 'me' && m.text === directive));
});

test('condensing defaults on and scrolling follows the displayed rows when toggled', async () => {
  const source = (await readFile(new URL('../mods/hey-chat/main.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '').replace('export default class', 'return class');
  const saved = [];
  const HeyChat = new Function('View', 'visibleMessages', 'checking', 'setShared', source)(class {}, visibleMessages, () => false, (...args) => saved.push(args));
  const chat = { id: 'chat', working: true, thread: [{ id: 'run', kind: 'tool', icon: 'run' }, { id: 'edit', kind: 'tool', icon: 'edit' }] };
  const v = Object.assign(Object.create(HeyChat.prototype), { chatId: chat.id, chat: () => chat, needsYou: () => false, scrollDown() {} });
  assert.deepEqual(v.rowIds(), ['typing']);
  v.condenseChat = true;
  v.toggleCondenseChat();
  assert.deepEqual(v.rowIds(), ['run', 'edit', 'typing']);
  v.toggleCondenseChat();
  assert.deepEqual(v.rowIds(), ['typing']);
  assert.deepEqual(saved, [['hey-chat.condenseChat', false], ['hey-chat.condenseChat', true]]);
});


test('useful activity follows running tools and disappears when they finish', () => {
  const chat = { id: 'chat' };
  resetThread(chat);
  applyEvent(chat, { type: 'working' });
  applyEvent(chat, { type: 'tool', id: 'search', name: 'Bash', input: { command: 'rg -n typingRow hey-chat' } });
  assert.equal(currentActivity(chat), 'Searching the repo');
  applyEvent(chat, { type: 'tool', id: 'edit', name: 'Edit', input: { file_path: '/repo/chat.js' } });
  assert.equal(currentActivity(chat), 'Editing chat.js');
  applyEvent(chat, { type: 'tool_done', id: 'edit' });
  assert.equal(currentActivity(chat), 'Searching the repo');
  applyEvent(chat, { type: 'tool_done', id: 'search' });
  assert.equal(currentActivity(chat), '');
  applyEvent(chat, { type: 'tool', id: 'test', name: 'Bash', input: { command: 'node --test tests/*.mjs' } });
  assert.equal(currentActivity(chat), 'Running tests');
  applyEvent(chat, { type: 'turn_end' });
  assert.equal(currentActivity(chat), '');
  applyEvent(chat, { type: 'working' });
  assert.equal(currentActivity(chat), '', 'old activity must not reappear on the next turn');
  applyEvent(chat, { type: 'tool', id: 'test2', name: 'Read', input: { file_path: 'chat.js' } });
  applyEvent(chat, { type: 'error', message: 'Disconnected' });
  assert.equal(currentActivity(chat), '');
  assert.equal(describeActivity('TodoWrite', {}), '');
  assert.equal(describeActivity('some_unknown_tool', {}), '');
  assert.equal(describeActivity('Bash', { command: 'pwd' }), '');
  assert.equal(describeActivity('WebSearch', { query: 'animation timing' }), 'Searching the web for animation timing');
  assert.equal(describeActivity('cua_repl.js', { title: 'Checking the chat layout' }), 'Checking the chat layout');
});
