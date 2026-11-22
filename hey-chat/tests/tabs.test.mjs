import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../mods/hey-chat/main.js', import.meta.url), 'utf8');
const source = main.slice(main.indexOf('const CHAT_TABS'), main.indexOf('/** Which projects are closed'));
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
  const toggle = new Function('focused', 'spaces', 'panes', 'shared', 'setShared', 'run', 'expand', 'home', 'folderName', source + '\nreturn toggle;')(
    () => focus, () => spaces, () => panes, () => saved, (_key, value) => { saved = value; }, run, x => x, () => '/home', x => x.split('/').pop());
  const cx = { timer: { after(_ms, done) { pending?.(); pending = null; done(); } } };
  return { toggle: folder => toggle(cx, folder), commands, panes, work, focus: () => focus,
    setFocus: id => { focus = { ...focus, tab: id, cwd: id === 'chat' ? null : '/project' }; }, saved: () => saved,
    setSaved: value => { saved = value; } };
}

test('shortcut creates one dedicated chat tab and switches back without destroying it', async () => {
  const s = setup();
  await s.toggle();
  assert.deepEqual(s.commands[0], { name: 'tab.new', args: { name: 'Hey, chat · project', space: 'work', mod: 'hey-chat', props: { folder: '/project' } } });
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
