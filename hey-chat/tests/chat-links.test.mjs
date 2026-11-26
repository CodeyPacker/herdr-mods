import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatLinks } from '../mods/hey-chat/chat-links.mjs';
import { withSender, splitSender, updateText } from '../mods/hey-chat/link-messages.js';

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'hey-chat-link-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = join(root, 'bridges');
  const create = (chat, agent = 'claude') => new ChatLinks({ state, chat, cwd: root, agent, model: `${agent}-fixture`, title: chat, models: async provider => [{ id: `${provider}-fixture` }] });
  return { root, state, create };
}

test('summary reads stay compact, include direct user changes, and page detail only when requested', async t => {
  const { create } = await setup(t);
  const parent = create('parent');
  const child = create('child', 'codex'); child.update({ id: 'child', parentId: 'parent', brief: 'Investigate the task' });
  for (let i = 0; i < 60; i++) child.record({ type: 'text', text: `Detailed message ${i}: ${'x'.repeat(1000)}` });
  await child.call('chat_summary', { task: 'Investigate the task', progress: ['Found the issue'], decisions: ['Use the current implementation'], blockers: [], needs: [], references: ['child:12', 'scope.md'] });
  const summary = await parent.call('chat_read', { chat_id: 'child' });
  assert.equal(summary.events, undefined);
  assert.ok(JSON.stringify(summary).length < 3000);
  assert.equal(summary.stale, false);
  assert.equal(summary.summary.progress[0], 'Found the issue');
  child.record({ type: 'user', text: 'The person changed the task', queueId: 'person-change' });
  const changed = await parent.call('chat_read', { chat_id: 'child' });
  assert.equal(changed.stale, true);
  assert.equal(changed.lastDirectInstruction.text, 'The person changed the task');
  const detail = await parent.call('chat_read', { chat_id: 'child', mode: 'messages', after: summary.cursor, limit: 5 });
  assert.equal(detail.events.length, 1);
  assert.equal(detail.events[0].text, 'The person changed the task');
  const firstPage = await parent.call('chat_read', { chat_id: 'child', mode: 'all', limit: 10 });
  const secondPage = await parent.call('chat_read', { chat_id: 'child', mode: 'all', after: firstPage.cursor, limit: 10 });
  assert.equal(firstPage.events.length, 10);
  assert.equal(secondPage.events[0].seq, firstPage.events.at(-1).seq + 1);
  assert.equal(secondPage.has_more, true);
});

test('a large event can be inspected in bounded fragments without losing the rest of the message', async t => {
  const { create } = await setup(t);
  const parent = create('parent'), child = create('child'); child.update({ id: 'child', parentId: 'parent' });
  const text = 'long message '.repeat(8000);
  child.record({ type: 'text', text });
  let offset = 0, combined = '';
  for (;;) {
    const page = await parent.call('chat_read', { chat_id: 'child', mode: 'all', after: 0, offset });
    assert.ok(page.fragment.length <= 32000);
    combined += page.fragment;
    if (page.next_offset === null) { assert.equal(page.cursor, 1); break; }
    assert.equal(page.cursor, 0);
    offset = page.next_offset;
  }
  assert.equal(JSON.parse(combined).text, text);
});

test('linked agents cannot read or message unrelated conversations, approve permissions or escape ids', async t => {
  const { create } = await setup(t);
  const parent = create('parent'); create('unrelated');
  await assert.rejects(parent.call('chat_read', { chat_id: 'unrelated' }), /family/);
  await assert.rejects(parent.call('chat_send', { chat_id: 'unrelated', request_id: 'bad', message: 'hello' }), /family/);
  await assert.rejects(parent.call('chat_read', { chat_id: '../../outside' }), /Invalid chat id/);
  await assert.rejects(parent.call('approve', {}), /Unknown/);
  await assert.rejects(parent.call('chat_summary', { task: 'x', progress: ['x'.repeat(1001)] }), /1000/);
});

test('parent updates remain durable until acknowledged and retain a stable delivery id after restart', async t => {
  const { root, create } = await setup(t);
  create('parent');
  const child = create('child'); child.update({ id: 'child', parentId: 'parent', reportToParent: true });
  const event = child.record({ type: 'turn_end', error: false });
  child.send = async () => { throw new Error('Parent is offline'); };
  await child.notifyParent(event, 'done');
  assert.equal((await readdir(join(root, 'links', 'outbox'))).length, 1);
  assert.match(child.get().reportError, /offline/);
  const before = JSON.parse(await readFile(join(root, 'links', 'outbox', `child-${event.seq}.json`), 'utf8'));
  const reopened = create('child');
  const delivered = [];
  reopened.send = async (...args) => { delivered.push(args); return { accepted: true }; };
  await reopened.flushReports();
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0][0], 'parent');
  assert.equal(delivered[0][1], before.requestId);
  assert.deepEqual(await readdir(join(root, 'links', 'outbox')), []);
  assert.equal(reopened.get().reportError, null);
});

test('deleting a parent detaches its children and preserves their sessions and summaries', async t => {
  const { state, create } = await setup(t);
  const parent = create('parent'), child = create('child');
  child.update({ id: 'child', parentId: 'parent', session: 'child-session', summary: { task: 'Keep working' } });
  ChatLinks.detach(state, 'parent');
  assert.equal(child.get().parentId, null);
  assert.equal(child.get().session, 'child-session');
  assert.equal(child.get().summary.task, 'Keep working');
  assert.deepEqual(child.list().map(r => r.id), ['child']);
  assert.equal(parent.get().deleted, true);
});

test('completion notices omit the brief and answer while preserving status and actionable needs', async t => {
  const { create } = await setup(t);
  const parent = create('parent'), child = create('child');
  const task = 'PRIVATE TASK BRIEF '.repeat(100);
  const answer = 'FULL CHILD ANSWER '.repeat(100);
  child.update({ id:'child', parentId:'parent', reportToParent:true, brief:task, lastResponse:answer,
    summary:{task,progress:[answer],needs:['Choose the target branch'],blockers:[]} });
  const event = child.record({type:'turn_end',error:false});
  child.update({id:'child',status:'idle'}); // The child was viewed before its report was delivered.
  const sent = [];
  child.send = async (...args) => { sent.push(args); return {accepted:true}; };
  await child.notifyParent(event,'done');
  assert.equal(sent.length,1);
  assert.equal(sent[0][2].includes(task),false);
  assert.equal(sent[0][2].includes(answer),false);
  assert.equal(sent[0][5].status,'done');
  assert.deepEqual(sent[0][5].needs,['Choose the target branch']);
  assert.equal(sent[0][5].summary,undefined);
  assert.equal(updateText({title:'child',...sent[0][5]}),'child: done\nNeeds: Choose the target branch');
  const details = await parent.call('chat_read',{chat_id:'child'});
  assert.equal(details.summary.task,task);
  assert.equal(details.lastResponse,answer);
});

test('old update cards no longer repeat the task brief or child answer', () => {
  assert.equal(updateText({title:'Review',status:'done',summary:{task:'Long instructions',progress:['Entire answer']}}),'Review: done');
});

test('reporting follows the delivered request, survives restart, and preserves an earlier delegated completion', async t => {
  const {create}=await setup(t);
  create('parent');
  const child=create('child');child.update({id:'child',parentId:'parent'});
  const sent=[];child.send=async (...args)=>{sent.push(args);return {accepted:true};};
  child.record({type:'user',text:'Delegated task',source:{chat:'parent',kind:'delegation'}});
  child.record({type:'queued',text:'Direct message waiting'});
  const delegatedEnd=child.record({type:'turn_end',error:false});
  child.record({type:'user',text:'hi'});
  const localPermission=child.record({type:'permission',id:'ask'});
  const localEnd=child.record({type:'turn_end',error:false});
  await child.notifyParent(delegatedEnd,'done');
  await child.notifyParent(localPermission,'blocked');
  await child.notifyParent(localEnd,'done');
  assert.equal(sent.length,1,'only the delegated completion should report, even if a direct turn starts before delivery');
  const reopened=create('child');
  assert.equal(reopened.record({type:'turn_end',error:false}).reportToParent,false);
  reopened.record({type:'user',text:'Parent follow-up',source:{chat:'parent',kind:'agent'}});
  assert.equal(reopened.record({type:'turn_end',error:false}).reportToParent,true);
});

test('sender metadata roundtrips without copying the original message twice', () => {
  const source = { chat: 'parent', title: 'Parent', kind: 'delegation', agent: 'claude' };
  const text = 'A focused brief with scope.md';
  const wrapped = withSender(text, source);
  assert.deepEqual(splitSender(wrapped), { text, source });
  assert.equal(wrapped.split(text).length, 2);
  assert.deepEqual(splitSender('Ordinary message'), { text: 'Ordinary message', source: null });
});
