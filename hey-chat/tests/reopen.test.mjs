import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resetThread } from '../mods/hey-chat/messages.js';

const source = (await readFile(new URL('../mods/hey-chat/main.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export default class', 'return class');

function pane(store) {
  const saved = [];
  const HeyChat = new Function('View', 'loadStore', 'listSessions', 'resetThread', 'expand', 'saveStore', source)(
    class {}, async () => store, async () => [], resetThread, x => x,
    async (_chats, _projects, active) => { saved.push(active); });
  const v = Object.assign(Object.create(HeyChat.prototype), {
    chats: [{ id: 'startup', thread: [] }], projects: [], chatId: 'startup', loaded: false,
    unread: {}, bridges: new Map(), collapsed: {},
    addProject: () => 'project', link: async () => null,
    loadHistory: async chat => { chat.historyLoaded = true; },
    scrollDown() {}, focusInput() {}, setCollapsed(id, closed) { this.collapsed[id] = closed; },
  });
  const jobs = [];
  const timers = [];
  const cx = { notify() {}, spawn(fn) { jobs.push(fn(cx)); }, timer: { after(ms, fn) { timers.push({ ms, fn }); } } };
  return { v, cx, saved, jobs, timers };
}

const stored = activeChat => ({ activeChat, projects: [], chats: [
  { id: 'last', session: 'session-last', cwd: '/tmp', agent: 'codex' },
  { id: 'other', session: 'session-other', cwd: '/tmp', agent: 'claude' },
] });

test('reopening restores the last chat, loads its history, and saves later selections', async () => {
  const { v, cx, saved, jobs } = pane(stored('last'));
  await v.loadChats(cx);
  await Promise.all(jobs);
  assert.equal(v.chatId, 'last');
  assert.equal(v.chat('last').historyLoaded, true);
  assert.equal(v.collapsed.project, false);
  assert.equal(v.chats.some(c => c.id === 'startup'), false);
  assert.equal(saved.at(-1), 'last');
  v.openChat('other', cx);
  assert.equal(saved.at(-1), 'other');
});

test('missing saved chats keep the new chat available', async () => {
  const { v, cx } = pane(stored('deleted'));
  await v.loadChats(cx);
  assert.equal(v.chatId, 'startup');
});

test('restoring does not replace a user selection or a message started during loading', async () => {
  for (const action of [v => { v.chatId = 'other'; }, v => { v.chats[0].working = true; }, v => { v.chats[0].thread.push({ kind: 'text', text: 'Hello' }); }]) {
    const { v, cx } = pane(stored('last'));
    const loading = v.loadChats(cx);
    action(v);
    const selected = v.chatId;
    await loading;
    assert.equal(v.chatId, selected);
  }
});

test('restored chat stays hidden through history, layout changes, and the final scroll', async () => {
  const { v, cx, jobs, timers } = pane(stored('last'));
  let finishHistory;
  v.loadHistory = () => new Promise(resolve => { finishHistory = resolve; });
  let scrolls = 0;
  v.scrollDown = () => { scrolls++; };
  await v.loadChats(cx);
  assert.equal(v.restoring.pending, true);
  assert.equal(timers.length, 0, 'loading cannot finish before history arrives');
  finishHistory();
  await Promise.all(jobs);
  assert.equal(v.restoring.pending, false);
  const old = timers.shift();
  v.settleRestore(cx); // A row changed height after history arrived.
  old.fn(cx);
  assert.ok(v.restoring, 'stale layout cannot reveal the chat');
  const before = scrolls;
  timers.shift().fn(cx);
  assert.equal(scrolls, before + 1, 'scroll while the loading cover is still visible');
  assert.ok(v.restoring);
  timers.shift().fn(cx);
  assert.equal(v.restoring, null, 'reveal after the final scroll has painted');
});

test('switching chats cancels the loading cover and stale reveal callbacks', async () => {
  const { v, cx, jobs, timers } = pane(stored('last'));
  await v.loadChats(cx);
  await Promise.all(jobs);
  v.openChat('other', cx);
  for (const timer of timers) timer.fn(cx);
  assert.equal(v.restoring, null);
  assert.equal(v.chatId, 'other');
});


test('loading uses fresh timer contexts and cannot be held open by continuing updates', () => {
  const { v, cx, timers } = pane(stored('last'));
  v.restoring = { id: v.chatId, pending: false, version: 0 };
  const layoutCx = { timer: cx.timer, notify() { throw new Error('expired layout context'); } };
  v.settleRestore(layoutCx);
  let elapsed = 0;
  let frames = 0;
  while (v.restoring && frames++ < 12) {
    // New messages and changed rows arrive before every frame.
    for (let n = 0; n < 20; n++) v.settleRestore(layoutCx);
    assert.equal(timers.length, 1, 'updates must reuse the existing reveal task');
    const timer = timers.shift();
    elapsed += timer.ms;
    timer.fn(cx);
  }
  assert.equal(v.restoring, null, 'ongoing activity must not prevent revealing the chat');
  assert.ok(elapsed <= 288, 'layout settling remains bounded even with continuous changes');
});


test('a layout correction after the final scroll stays covered until the corrected frame', () => {
  const { v, cx, timers } = pane(stored('last'));
  v.restoring = { id: v.chatId, pending: false, version: 0 };
  let scrolls = 0;
  v.scrollDown = () => { scrolls++; };
  v.settleRestore(cx);
  timers.shift().fn(cx);
  assert.equal(scrolls, 1);
  v.settleRestore(cx); // The composer or a row was measured after scrolling.
  timers.shift().fn(cx);
  assert.ok(v.restoring, 'do not reveal in the same frame as a late layout correction');
  assert.equal(scrolls, 2, 'correct the bottom position beneath the cover');
  timers.shift().fn(cx);
  assert.equal(v.restoring, null);
});


test('project tabs load and link only their own chats and restore their own selection', async () => {
  const store = stored('other');
  store.chats.push({ id: 'foreign', session: 'foreign-session', cwd: '/elsewhere', agent: 'codex' });
  store.projects.push({ id: 'foreign-project', path: '/elsewhere' });
  store.activeChats = { '/tmp': 'last', '/elsewhere': 'foreign' };
  const { v, cx, jobs } = pane(store);
  v.folder = '/tmp';
  const linked = [];
  v.link = async chat => { linked.push(chat.id); };
  await v.loadChats(cx);
  await Promise.all(jobs);
  assert.equal(v.chatId, 'last');
  assert.equal(v.chats.some(c => c.id === 'foreign'), false);
  assert.deepEqual([...new Set(linked)].sort(), ['last', 'other']);
});
