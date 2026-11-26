import { test } from 'node:test';
import assert from 'node:assert/strict';
import { view, mod, findElement } from './support/mod.mjs';
import { handleKey, treeItems } from '../mods/hey-chat/keys.js';

const { renameEditor } = await mod('views/chat.js');
function box(value = '') { return { value: () => value, set_value: next => { value = next; } }; }
async function setup() {
  const chats = [
    { id: 'a', title: 'Original name', agent: 'claude', session: 'session-a', project: 'project', stamp: 10, thread: [] },
    { id: 'b', title: 'Newer chat', agent: 'codex', session: 'session-b', project: 'project', stamp: 20, thread: [] },
  ];
  const saved = [];
  const v = await view({ chats, chatId: 'a', zone: 'chat', inputs: { claude: box('Unsent message'), codex: box() },
    saveChats() { saved.push(chats.map(c => ({ title: c.title, pinned: c.pinned, customTitle: c.customTitle }))); },
    focusInput() { this.zone = 'chat'; }, query: '',
    treeSyncing: () => false, recentIds: () => [], visibleProjects: () => [{ id: 'project' }], isOpen: () => true,
  });
  const cx = { notify() {}, stop_propagation() {} };
  return { v, chats, saved, cx };
}

test('renaming saves the chat name without replacing the composer or agent session', async () => {
  const { v, chats, saved, cx } = await setup();
  v.beginRename('a');
  assert.equal(v.renaming.box.value(), 'Original name');
  v.renaming.box.set_value('  Project review  ');
  findElement(renameEditor(v, {}), 'save-chat-name').click({}, cx);
  assert.equal(chats[0].title, 'Project review');
  assert.equal(chats[0].customTitle, true);
  assert.equal(chats[0].session, 'session-a');
  assert.equal(v.inputs.claude.value(), 'Unsent message');
  assert.equal(v.chatId, 'a');
  assert.equal(v.renaming, null);
  assert.equal(saved.length, 1);
});

test('invalid names stay editable, Escape cancels and Enter saves', async () => {
  const { v, chats, saved, cx } = await setup();
  v.beginRename('a');
  v.renaming.box.set_value('   ');
  handleKey(v, { keystroke: 'enter' }, cx);
  assert.match(v.renaming.error, /Enter a chat name/);
  assert.equal(saved.length, 0);
  v.renaming.box.set_value('x'.repeat(121));
  handleKey(v, { keystroke: 'enter' }, cx);
  assert.match(v.renaming.error, /120/);
  handleKey(v, { keystroke: 'escape' }, cx);
  assert.equal(v.renaming, null);
  assert.equal(chats[0].title, 'Original name');
  v.beginRename('a');
  v.renaming.box.set_value('New name');
  handleKey(v, { keystroke: 'enter' }, cx);
  assert.equal(chats[0].title, 'New name');
  assert.equal(saved.length, 1);
});

test('pinning changes sidebar and keyboard order, unpinning restores recency, and search still filters', async () => {
  const { v, chats } = await setup();
  assert.deepEqual(v.chatsIn('project').map(c => c.id), ['b', 'a']);
  v.togglePin('a');
  assert.equal(chats[0].pinned, true);
  assert.deepEqual(treeItems(v), ['p:project', 'c:a', 'c:b']);
  v.query = 'newer';
  assert.deepEqual(v.chatsIn('project').map(c => c.id), ['b']);
  v.query = '';
  v.togglePin('a');
  assert.deepEqual(treeItems(v), ['p:project', 'c:b', 'c:a']);
});
