import { mod, fake } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Expose only the filesystem methods Herdr actually provides. Node's rename is unavailable there.
const herdrFs = { mkdir: fs.mkdir };

test('saving an existing store preserves the bridge id and latest session on reopen', async t => {
  const home = await fs.mkdtemp(join(tmpdir(), 'hey-chat-store-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const readTextFile = file => fs.readFile(file, 'utf8').catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  const writeTextFile = async (file, text, expected) => {
    assert.equal(await readTextFile(file), expected, 'the native API requires the current file as its expected snapshot');
    await fs.writeFile(file, text);
  };
  fake('herdr', { readTextFile, writeTextFile, appHome: () => home });
  fake('fs/promises', herdrFs);
  const { saveStore, loadStore } = await mod('store.js');
  const projects = [{ id: 'project', path: '/tmp' }];
  const chat = { id: 'original-bridge-id', agent: 'codex', cwd: '/tmp', project: 'project', session: 'first-session', file: '/sessions/first.jsonl' };
  await saveStore([chat], projects);
  chat.session = 'current-session';
  chat.model = 'current-model';
  chat.selectedModel = 'chosen-model';
  chat.outputs = [{ key: 'file:/tmp/review.md', target: '/tmp/review.md', kind: 'markdown', label: 'Review' }];
  const first = saveStore([chat], projects);
  chat.title = 'Latest title';
  await Promise.all([first, saveStore([chat], projects, chat.id)]);
  const store = await loadStore();
  assert.equal(store.activeChat, chat.id);
  const reopened = store.chats[0];
  assert.equal(reopened.id, 'original-bridge-id');
  assert.equal(reopened.session, 'current-session');
  assert.equal(reopened.file, '/sessions/first.jsonl');
  assert.equal(reopened.model, 'current-model');
  assert.equal(reopened.selectedModel, 'chosen-model');
  assert.equal(reopened.title, 'Latest title');
  assert.deepEqual(reopened.outputs, chat.outputs);
});


test('independent project saves merge, retry conflicts, and preserve project selections', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'hey-chat-projects-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let text = null;
  let conflict = true;
  const read = async () => text;
  const write = async (_file, next, expected) => {
    if (conflict) {
      conflict = false;
      text = JSON.stringify({ chats: [{ id: 'foreign', cwd: '/b', session: 'b' }], projects: [], activeChats: { '/b': 'foreign' } });
      throw new Error('stale snapshot');
    }
    if (text !== expected) throw new Error('stale snapshot');
    text = next;
  };
  fake('herdr', { readTextFile: read, writeTextFile: write, appHome: () => root, home: () => root });
  fake('fs/promises', herdrFs);
  // Two panes, each with its own copy of store.js, as two Herdr tabs have.
  const a = await mod('store.js?pane-a'), b = await mod('store.js?pane-b');
  const chat = (id, cwd) => ({ id, cwd, session: id, project: id });
  await a.saveStore([chat('a', '/a')], [], 'a', '/a');
  assert.deepEqual((await a.loadStore()).chats.map(c => c.id).sort(), ['a', 'foreign']);
  await Promise.all([a.saveStore([chat('a', '/a')], [], 'a', '/a'), b.saveStore([chat('b', '/b')], [], 'b', '/b')]);
  await a.saveStore([], [], '', '/a');
  const stored = await b.loadStore();
  assert.deepEqual(stored.chats.map(c => c.id), ['b']);
  assert.equal(stored.activeChats['/b'], 'b');
});


test('draft-only chats and unsent images survive saving and clearing removes empty chats', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'hey-chat-drafts-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let text = null;
  fake('herdr', { readTextFile: async () => text, writeTextFile: async (_file, next) => { text = next; }, appHome: () => root });
  fake('fs/promises', herdrFs);
  const { saveStore, loadStore } = await mod('store.js');
  const chats = [
    { id: 'text', project: 'project', draft: '  unfinished\nmessage  ' },
    { id: 'image', project: 'project', attached: [{ path: '/tmp/image.png', w: 20, h: 10 }, { kind: 'document', path: 'data/hey-chat/files/report.pdf', name: 'report.pdf', format: 'pdf' }] },
    { id: 'empty', project: 'project' },
  ];
  await saveStore(chats, [{ id: 'project', path: '/tmp' }], 'text');
  const store = await loadStore();
  assert.deepEqual(store.chats.map(c => c.id), ['text', 'image']);
  assert.equal(store.chats[0].draft, chats[0].draft);
  assert.deepEqual(store.chats[1].attached, chats[1].attached);
  assert.equal(store.activeChat, 'text');
  assert.equal(store.projects.length, 1);
  chats[0].draft = '';
  chats[1].attached = [];
  await saveStore(chats, [], '');
  assert.deepEqual((await loadStore()).chats, []);
});

test('custom names and pins survive reopening even for chats without messages', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'hey-chat-names-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let text = null;
  fake('herdr', { readTextFile: async () => text, writeTextFile: async (_file, next) => { text = next; }, appHome: () => root });
  fake('fs/promises', herdrFs);
  const { saveStore, loadStore } = await mod('store.js');
  const chats = [
    { id: 'named', project: 'project', title: 'Research notes', customTitle: true },
    { id: 'pinned', project: 'project', title: 'New chat', pinned: true },
  ];
  await saveStore(chats, [{ id: 'project', path: '/tmp' }], 'named');
  const restored = await loadStore();
  assert.equal(restored.chats[0].title, 'Research notes');
  assert.equal(restored.chats[0].customTitle, true);
  assert.equal(restored.chats[1].pinned, true);
  assert.equal(restored.projects.length, 1);
  chats[1].pinned = false;
  await saveStore(chats, [{ id: 'project', path: '/tmp' }], 'named');
  assert.deepEqual((await loadStore()).chats.map(c => c.id), ['named']);
});
