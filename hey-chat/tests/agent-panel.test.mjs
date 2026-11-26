import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fake, findElement } from './support/mod.mjs';

const { default: Panel, panelColors } = await import('../../islands/mods/islands-hey-chat-agents/main.js');

test('default Islands layout keeps the built-in agents and does not load the opt-in panel', async () => {
  const layout = JSON.parse(await readFile(new URL('../../islands/layouts/islands.json', import.meta.url), 'utf8'));
  const mods = [];
  const visit = node => { if (node.content?.mod) mods.push(node.content.mod); for (const child of node.children ?? []) visit(child); };
  visit(layout);
  assert.ok(mods.includes('islands-agents'));
  assert.equal(mods.includes('islands-hey-chat-agents'),false);
});

test('agent card follows the active Wallpaper opacity, including solid, and ignores another layout', () => {
  const values = {layout:'islands','islands.opacity':0.6,'backgrounds.seeThrough':{layout:'islands',opacity:0.25,borders:'none'}};
  fake('herdr',{theme:()=>({chrome:'#102030',hover:'#304050',selected:'#506070',border:'#ffffff'}),shared:key=>values[key]});
  assert.equal(panelColors().chrome,'#10203040');
  assert.equal(panelColors().hover,'#30405040');
  assert.equal(panelColors().selected,'#50607040');
  values['backgrounds.seeThrough'].opacity=1;
  assert.equal(panelColors().chrome,'#102030');
  values['backgrounds.seeThrough'].layout='other';
  assert.equal(panelColors().chrome,'#10203099');
});

test('Islands panel handles absent Hey chat and opens the selected conversation', async () => {
  const commands = [], values = {};
  fake('herdr', { readTextFile: async () => null, shared: () => true, checking: () => true,
    setShared: (key, value) => { values[key] = value; }, run: (...args) => commands.push(args) });
  const panel = new Panel(); panel.init();
  await panel.refresh();
  assert.match(panel.error, /Install Hey, chat/);
  panel.error = null;
  panel.records = [{ id: 'child', title: 'Review', cwd: '/project', status: 'blocked', agent: 'codex' }];
  findElement(panel.render({}), 'hey-chat-agent-child').click();
  assert.equal(values['hey-chat.openRequest'].id, 'child');
  assert.equal(values['hey-chat.openRequest'].cwd, '/project');
  assert.deepEqual(commands, [['mod.open', { name: 'hey-chat' }]]);
});

test('Islands panel shows active and attention states before completed chats', async () => {
  fake('herdr', { readTextFile: async () => '{}', exec: async () => ({ code: 0, stdout: JSON.stringify([
    { id: 'idle', status: 'idle' }, { id: 'done', status: 'done' }, { id: 'working', status: 'working' }, { id: 'blocked', status: 'blocked' },
  ]) }) });
  const panel = new Panel(); panel.init(); await panel.refresh();
  assert.deepEqual(panel.records.map(r => r.id), ['blocked', 'working', 'done']);
});

test('background polling keeps the empty state visible and redraws only for visible changes', async () => {
  let finish, notices = 0;
  fake('herdr', {readTextFile:async ()=>'{}', exec:()=>new Promise(resolve=>{finish=records=>resolve({code:0,stdout:JSON.stringify(records)});})});
  const jobs = [], timers = [];
  const cx = {spawn(fn){jobs.push(fn(cx));},notify(){notices++;},timer:{after(_ms,fn){timers.push(fn);}}};
  const panel = new Panel(); panel.init({},cx);
  const complete = async records => { await Promise.resolve(); finish(records); await jobs.at(-1); };
  await complete([]);
  assert.equal(notices,1);
  const text = element => typeof element==='string' ? [element] : (element?.nodes ?? []).flatMap(text);
  const empty = text(panel.render(cx));
  timers.shift()(cx);
  assert.deepEqual(text(panel.render(cx)),empty,'background refresh must not replace the empty state with Loading');
  await complete([]);
  assert.equal(notices,1,'unchanged polls should not trigger a redraw');
  timers.shift()(cx);
  await complete([{id:'worker',agent:'codex',title:'Review',status:'working',updatedAt:1}]);
  assert.equal(notices,2);
  assert.ok(findElement(panel.render(cx),'hey-chat-agent-worker'));
  timers.shift()(cx);
  await complete([{id:'worker',agent:'codex',title:'Review',status:'working',updatedAt:2,summary:{progress:['More progress']}}]);
  assert.equal(notices,2,'hidden timestamps and summaries should not restart rendered indicators');
});
