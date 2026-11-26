import { mod, fake } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { default: HeyChat } = await mod('main.js');

/** A message box that keeps its text. */
function box() {
  let text = '';
  return { value: () => text, set_value: next => { text = next; }, focus() {} };
}

function pane(store) {
  const saved = [];
  fake('store.js', { loadStore: async () => store, saveStore: async (_chats, _projects, active) => { saved.push(active); } });
  fake('agent.js', { listSessions: async () => [] });
  const v = Object.assign(Object.create(HeyChat.prototype), {
    chats: [{ id: 'startup', thread: [] }], projects: [], chatId: 'startup', loaded: false,
    unread: {}, bridges: new Map(), collapsed: {}, syncing: new Set(), fresh: [], previous: null,
    inputs: { claude: box(), codex: box() },
    addProject(cwd) { if (!this.projects.length) this.projects.push({id:'project',cwd}); return 'project'; }, link: async () => null,
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

test('saved and linked chats connect before the slower session list without duplicate links', async () => {
  const state = stored('deleted');
  state.chats[0].file = '/sessions/last.jsonl';
  const { v, cx, jobs } = pane(state);
  let finishListing;
  fake('agent.js', {
    listSessions: () => new Promise(resolve => { finishListing = resolve; }),
    listLinkedChats: async () => [{id:'child',parentId:'last',cwd:'/tmp',agent:'claude',title:'Review'}],
  });
  const connected = [];
  v.link = async chat => { connected.push(chat.id); return null; };
  const loading = v.loadChats(cx);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(connected, ['last', 'other', 'child']);
  assert.equal(v.chat('last').file, '/sessions/last.jsonl');
  assert.equal(v.loaded, false, 'session discovery is still pending');
  finishListing([]);
  await loading;
  await Promise.all(jobs);
  assert.deepEqual(connected, ['last', 'other', 'child']);
  assert.equal(v.loaded, true);
});

test('reopening opens the first parent chat, loads its history, and saves later selections', async () => {
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

test('missing saved selections still open the first available parent chat', async () => {
  const { v, cx } = pane(stored('deleted'));
  await v.loadChats(cx);
  assert.equal(v.chatId, 'last');
});

test('startup picks the first parent in sidebar order instead of a saved child or newer descendant', async () => {
  const state = {activeChat:'child',projects:[],chats:[
    {id:'parent',linkId:'root',session:'parent-session',cwd:'/tmp',agent:'claude',stamp:10},
    {id:'child',parentId:'root',session:'child-session',cwd:'/tmp',agent:'codex',stamp:100},
    {id:'pinned',session:'pinned-session',cwd:'/tmp',agent:'claude',stamp:1,pinned:true},
  ]};
  const {v,cx,jobs}=pane(state);
  await v.loadChats(cx); await Promise.all(jobs);
  assert.equal(v.chatId,'pinned');
  const next=pane({...state,chats:state.chats.filter(c=>c.id!=='pinned')});
  await next.v.loadChats(next.cx); await Promise.all(next.jobs);
  assert.equal(next.v.chatId,'parent');
});

test('a parent whose bridge already connected releases its startup loading cover', async () => {
  const {v,cx,jobs,timers}=pane(stored('last'));
  v.link=async chat=>{const bridge={sock:{}};v.bridges.set(chat.id,bridge);return bridge;};
  await v.loadChats(cx); await Promise.all(jobs);
  assert.equal(v.chatId,'last');
  assert.equal(v.restoring.pending,false);
  while(timers.length) timers.shift().fn(cx);
  assert.equal(v.restoring,null);
});

test('an empty project keeps its new chat ready', async () => {
  const {v,cx}=pane({projects:[],chats:[]});
  await v.loadChats(cx);
  assert.equal(v.chatId,'startup');
  assert.equal(v.starting,false);
});

test('deleted child records override stale saved chats and provider session listings', async () => {
  const state = stored('child');
  state.chats.push({id:'child',linkId:'child',parentId:'last',session:'deleted-session',agent:'codex',cwd:'/tmp'});
  const {v,cx,jobs}=pane(state);
  fake('agent.js',{
    listLinkedChats:async()=>[{id:'child',session:'deleted-session',agent:'codex',deleted:true}],
    listSessions:async()=>[{id:'provider-copy',session:'deleted-session',agent:'codex',cwd:'/tmp'}],
  });
  await v.loadChats(cx); await Promise.all(jobs);
  assert.equal(v.chats.some(c=>c.id==='child'||c.session==='deleted-session'),false);
  assert.equal(v.chatId,'last');
  assert.equal(v.adoptLinkedChat({...state.chats.at(-1),deleted:false}),null);
});

test('restoring does not replace a user selection or a message started during loading', async () => {
  for (const action of [v => { v.chatId = 'other'; }, v => { v.chats[0].working = true; }, v => { v.chats[0].thread.push({ kind: 'text', text: 'Hello' }); },
    v => { v.inputs.claude.set_value('A message I am still typing'); }]) {
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


test('the sidebar shows syncing until each running bridge has replayed its chat', async () => {
  const { v, cx, jobs } = pane(stored('deleted'));
  // "last" has a running bridge. "other" has none.
  v.link = async chat => chat.id === 'last' ? {} : null;
  assert.equal(v.treeSyncing(), true, 'the sessions are not listed yet');
  await v.loadChats(cx);
  await Promise.all(jobs);
  assert.equal(v.treeSyncing(), true, 'the running bridge is still replaying');
  v.onEvent(v.chat('last'), { type: 'synced' }, cx);
  assert.equal(v.treeSyncing(), false);
  assert.equal(v.chat('last').thread.length, 0, 'the marker adds nothing to the chat');
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


test('reopening restores text and images in a chat that has never sent a message', async () => {
  const draft = { id: 'draft', agent: 'claude', cwd: '/tmp', draft: 'Still writing', attached: [{ path: '/tmp/image.png', w: 20, h: 10 }] };
  const { v, cx, jobs } = pane({ activeChat: draft.id, projects: [], chats: [draft] });
  await v.loadChats(cx);
  await Promise.all(jobs);
  assert.equal(v.chatId, draft.id);
  assert.equal(v.inputs.claude.value(), draft.draft);
  assert.deepEqual(v.chat(draft.id).attached, draft.attached);
  v.newChat('project', cx);
  assert.equal(v.inputs.claude.value(), '');
  assert.equal(v.chat(v.chatId).attached, undefined);
  v.openChat(draft.id, cx);
  assert.equal(v.inputs.claude.value(), draft.draft);
});

test('reopening keeps renamed and pinned empty chats available', async () => {
  const named = { id: 'named', agent: 'claude', cwd: '/tmp', title: 'Research notes', customTitle: true };
  const pinned = { id: 'pinned', agent: 'codex', cwd: '/tmp', title: 'New chat', pinned: true };
  const { v, cx, jobs } = pane({ activeChat: named.id, projects: [], chats: [named, pinned] });
  await v.loadChats(cx);
  await Promise.all(jobs);
  assert.equal(v.chatId, pinned.id);
  assert.equal(v.chat(named.id).title, 'Research notes');
  assert.equal(v.chatsIn('project')[0].id, pinned.id);
  v.openChat(pinned.id, cx);
  assert.ok(v.chats.some(c => c.id === named.id));
  v.openChat(named.id, cx);
  assert.ok(v.chats.some(c => c.id === pinned.id));
});
