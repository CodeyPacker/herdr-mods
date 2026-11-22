import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('saving an existing store preserves the bridge id and latest session on reopen', async t => {
  const home = await fs.mkdtemp(join(tmpdir(), 'hey-chat-store-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const code = (await fs.readFile(new URL('../mods/hey-chat/store.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');
  const readTextFile = file => fs.readFile(file, 'utf8').catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  const writeTextFile = async (file, text, expected) => {
    assert.equal(await readTextFile(file), expected, 'the native API requires the current file as its expected snapshot');
    await fs.writeFile(file, text);
  };
  // Expose only the filesystem methods Herdr actually provides. Node's rename is unavailable there.
  const { saveStore, loadStore } = new Function('fs', 'readTextFile', 'writeTextFile', 'appHome', 'checking', `${code}\nreturn { saveStore, loadStore };`)(
    { mkdir: fs.mkdir }, readTextFile, writeTextFile, () => home, () => false,
  );
  const projects = [{ id: 'project', path: '/tmp' }];
  const chat = { id: 'original-bridge-id', agent: 'codex', cwd: '/tmp', project: 'project', session: 'first-session' };
  await saveStore([chat], projects);
  chat.session = 'current-session';
  chat.model = 'current-model';
  chat.selectedModel = 'chosen-model';
  const first = saveStore([chat], projects);
  chat.title = 'Latest title';
  await Promise.all([first, saveStore([chat], projects, chat.id)]);
  const store = await loadStore();
  assert.equal(store.activeChat, chat.id);
  const reopened = store.chats[0];
  assert.equal(reopened.id, 'original-bridge-id');
  assert.equal(reopened.session, 'current-session');
  assert.equal(reopened.model, 'current-model');
  assert.equal(reopened.selectedModel, 'chosen-model');
  assert.equal(reopened.title, 'Latest title');
});


test('independent project saves merge, retry conflicts, and preserve project selections', async t => {
  const root = await fs.mkdtemp(join(tmpdir(), 'hey-chat-projects-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const code = (await fs.readFile(new URL('../mods/hey-chat/store.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');
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
  const make = () => new Function('fs', 'readTextFile', 'writeTextFile', 'appHome', 'home', 'checking', `${code}\nreturn {saveStore, loadStore};`)(
    { mkdir: fs.mkdir }, read, write, () => root, () => root, () => false);
  const a = make(), b = make();
  const chat = (id, cwd) => ({ id, cwd, session: id, project: id });
  await a.saveStore([chat('a', '/a')], [], 'a', '/a');
  assert.deepEqual((await a.loadStore()).chats.map(c => c.id).sort(), ['a', 'foreign']);
  await Promise.all([a.saveStore([chat('a', '/a')], [], 'a', '/a'), b.saveStore([chat('b', '/b')], [], 'b', '/b')]);
  await a.saveStore([], [], '', '/a');
  const stored = await b.loadStore();
  assert.deepEqual(stored.chats.map(c => c.id), ['b']);
  assert.equal(stored.activeChats['/b'], 'b');
});
