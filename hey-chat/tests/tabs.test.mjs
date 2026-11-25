import { mod, fake } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { toggle, chatTabs, showChatTab } = await mod('tabs.js');

function setup({ legacy = false, otherSpace = false } = {}) {
  const work = { id: 'work', name: 'Work', active: true, tabs: [{ id: 'terminal', active: true }] };
  const spaces = [work];
  const panes = [{ pane: 'terminal-pane', tab: 'terminal', mod: null }];
  if (legacy) panes.push({ pane: 'old-chat', tab: 'terminal', mod: 'hey-chat', zoomed: true });
  if (otherSpace) {
    spaces.push({ id: 'other', active: false, tabs: [{ id: 'other-chat' }] });
    panes.push({ pane: 'other-chat-pane', tab: 'other-chat', mod: 'hey-chat' });
  }
  let focus = { space: 'work', tab: 'terminal', cwd: '/project' };
  let saved = {};
  const commands = [];
  let pending;
  const run = (name, args) => {
    commands.push({ name, args });
    if (name === 'tab.new') pending = () => {
      work.tabs.push({ id: 'chat', active: true });
      panes.push({ pane: 'chat-pane', tab: 'chat', mod: args.mod });
      focus = { space: 'work', tab: 'chat', cwd: null };
    };
    if (name === 'tab.select') focus = { ...focus, tab: args.id, cwd: args.id === 'chat' ? null : '/project' };
    if (name === 'pane.close') panes.splice(panes.findIndex(p => p.pane === args.pane), 1);
  };
  fake('herdr', { focused: () => focus, spaces: () => spaces, panes: () => panes, shared: () => saved, setShared: (_key, value) => { saved = value; }, run, home: () => '/home' });
  const cx = { timer: { after(_ms, done) { pending?.(); pending = null; done(); } } };
  return { toggle: folder => toggle(cx, folder), commands, panes, work, focus: () => focus,
    setFocus: id => { focus = { ...focus, tab: id, cwd: id === 'chat' ? null : '/project' }; }, saved: () => saved,
    setSaved: value => { saved = value; } };
}

test('shortcut creates one dedicated chat tab and switches back without destroying it', async () => {
  const s = setup();
  await s.toggle();
  assert.deepEqual(s.commands[0], { name: 'tab.new', args: { name: 'Chat · project', space: 'work', mod: 'hey-chat', props: { folder: '/project' } } });
  assert.deepEqual(s.saved(), { chat: { folder: '/project', previous: 'terminal' } });
  const chatPane = s.panes.find(p => p.mod === 'hey-chat');
  await s.toggle();
  assert.equal(s.focus().tab, 'terminal');
  await s.toggle();
  assert.equal(s.focus().tab, 'chat');
  assert.equal(s.panes.find(p => p.mod === 'hey-chat'), chatPane);
  assert.equal(s.commands.filter(c => c.name === 'tab.new').length, 1);
  assert.equal(s.commands.some(c => c.name === 'pane.close' || c.name === 'tab.close'), false);
});

test('return tab follows the most recent tab used before entering chat', async () => {
  const s = setup();
  await s.toggle();
  s.work.tabs.push({ id: 'review' });
  s.setFocus('review');
  await s.toggle();
  await s.toggle();
  assert.equal(s.focus().tab, 'review');
});

test('moving from the old split closes only its chat pane after the new tab exists', async () => {
  const s = setup({ legacy: true });
  await s.toggle();
  assert.deepEqual(s.commands.map(c => c.name), ['tab.new', 'pane.close']);
  assert.equal(s.commands[1].args.pane, 'old-chat');
  assert.ok(s.panes.some(p => p.pane === 'terminal-pane'));
  assert.ok(s.panes.some(p => p.pane === 'chat-pane'));
  await s.toggle();
  assert.equal(s.focus().tab, 'terminal');
});

test('chat tabs stay in their workspace and stale return ids fall back to an existing tab', async () => {
  const s = setup({ otherSpace: true });
  await s.toggle();
  assert.equal(s.commands[0].name, 'tab.new');
  s.setSaved({ chat: { folder: '/project', previous: 'deleted-tab' } });
  await s.toggle();
  assert.equal(s.focus().tab, 'terminal');
  assert.equal(s.commands.filter(c => c.name === 'tab.new').length, 1, 'find the existing chat pane even if renamed or its saved id is stale');
});

test('a chat that is the only tab remains open', async () => {
  const s = setup();
  await s.toggle();
  s.work.tabs = s.work.tabs.filter(t => t.id === 'chat');
  const count = s.commands.length;
  await s.toggle();
  assert.equal(s.commands.length, count);
  assert.equal(s.focus().tab, 'chat');
});


test('opening the same project focuses its tab and a different project creates another', async () => {
  const s = setup();
  await s.toggle('/project');
  await s.toggle('/project');
  assert.equal(s.commands.filter(c => c.name === 'tab.new').length, 1);
  await s.toggle('/other');
  assert.equal(s.commands.filter(c => c.name === 'tab.new').length, 2);
  assert.equal(s.commands.filter(c => c.name === 'tab.new').at(-1).args.props.folder, '/other');
});

test('the project list shows chat tabs in every space and jumps across spaces', async () => {
  const s = setup({ otherSpace: true, legacy: true });
  s.setSaved({ 'other-chat': { folder: '/code/api' } });
  const list = chatTabs();
  assert.deepEqual(list.map(t => t.tab), ['other-chat'], 'a terminal tab with an old split chat pane is not a chat tab');
  assert.equal(list[0].name, 'api');
  showChatTab(list[0]);
  assert.deepEqual(s.commands, [
    { name: 'space.select', args: { id: 'other' } },
    { name: 'tab.select', args: { id: 'other-chat' } },
    { name: 'pane.focus', args: { pane: 'other-chat-pane' } },
    { name: 'hey-chat.focus', args: undefined },
  ], 'the chat pane and its message box get the keyboard, so its keys work straight away');
});

test('from a mod tab, a new chat is for a terminal folder in the same space, not home', async () => {
  const { spaceFolder } = await mod('tabs.js');
  fake('herdr', { home: () => '/home' });
  const space = { folder: '', tabs: [{ id: 'code' }, { id: 'mod' }, { id: 'split' }] };
  const panes = [
    { pane: 'p1', tab: 'code', terminal: 't1', cwd: '/repo' },
    { pane: 'p2', tab: 'mod', terminal: null, mod: 'git-good', cwd: null },
    { pane: 'p3', tab: 'split', terminal: 't3', cwd: '/other' },
    { pane: 'p4', tab: 'split', terminal: null, mod: 'git-good', cwd: null },
  ];
  assert.equal(spaceFolder(space, 'mod', '/focused', panes), '/focused', 'a focused terminal wins');
  assert.equal(spaceFolder(space, 'mod', null, panes), '/repo', 'else the first terminal in the space');
  assert.equal(spaceFolder(space, 'split', null, panes), '/other', 'a terminal in the same tab comes first');
  assert.equal(spaceFolder({ folder: '/space', tabs: [{ id: 'mod' }] }, 'mod', null, [panes[1]]), '/space');
  assert.equal(spaceFolder({ folder: '', tabs: [{ id: 'mod' }] }, 'mod', null, [panes[1]]), null, 'nothing to go on: the person picks');
  assert.equal(spaceFolder({ folder: '/home', tabs: [{ id: 'mod' }] }, 'mod', null, [panes[1]]), null, 'a space in home is no project either');
  const atHome = [{ pane: 'h', tab: 'shell', terminal: 't', cwd: '/home' }];
  assert.equal(spaceFolder({ folder: '/home', tabs: [{ id: 'shell' }] }, 'shell', '/home', atHome), null, 'a terminal in home: the person picks');
  assert.equal(spaceFolder({ folder: '', tabs: [{ id: 'shell' }, { id: 'code' }] }, 'shell', '/home', [...atHome, panes[0]]), '/repo', 'home is skipped for a real project');
});

test('with no folder to go on, the shortcut asks which project instead of opening home', async () => {
  const commands = [];
  fake('herdr', {
    focused: () => ({ space: 'work', tab: 'mod', cwd: null }),
    spaces: () => [{ id: 'work', active: true, folder: '', tabs: [{ id: 'mod', active: true }] }],
    panes: () => [{ pane: 'p', tab: 'mod', terminal: null, mod: 'git-good' }],
    shared: () => ({}), setShared() {}, run: (name, args) => commands.push({ name, args }), home: () => '/home',
  });
  assert.equal(await toggle({ timer: { after() {} } }), 'choose');
  assert.deepEqual(commands, [], 'no tab is made');
});
