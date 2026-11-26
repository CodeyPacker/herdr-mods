import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod, findElement } from './support/mod.mjs';

const { treeView } = await mod('views/tree.js');
const { messageRow } = await mod('views/chat.js');
const texts = element => typeof element === 'string' ? [element] : (element?.nodes ?? []).flatMap(texts);

test('multiline child replies stay a single sidebar preview without changing the conversation', () => {
  const reply = "Knock knock.\n\nWho's there?\n\nCache.\n\nCache who?\n\nCache you later.";
  const chat = { id:'child', parentId:'parent', agent:'claude', title:'Knock knock joke', time:'8:51 PM', thread:[{kind:'text',from:'agent',text:reply}] };
  const v = { chatId:'parent', selectedIds:()=>[], jumpTarget:()=>null, treeSyncing:()=>false, recentIds:()=>[],
    visibleProjects:()=>[{id:'p'}], chatsIn:()=>[chat], isOpen:()=>true, chatDepth:{child:1}, unread:{}, needsYou:()=>false, thinking:()=>false };
  const row = findElement(treeView(v, {}), 'row-c:child');
  assert.ok(texts(row).includes("Knock knock. Who's there? Cache. Cache who? Cache you later."));
  assert.ok(texts(row).every(text=>!/[\r\n]/.test(text)));
  assert.equal(row.alignment,'items_start');
  assert.equal(chat.thread[0].text,reply);
});

test('message groups put the avatar beside the top of the first card', () => {
  const chat = { id:'chat',agent:'claude',real:false };
  const v = {chatId:'chat',chat:()=>chat,thinking:()=>false};
  const messages = [{id:'first',kind:'text',from:'agent',text:'First card\nSecond line'}, {id:'second',kind:'text',from:'agent',text:'Second card'}];
  const first = findElement(messageRow(v,{},messages,0,500),'msg-first');
  const second = findElement(messageRow(v,{},messages,1,500),'msg-second');
  assert.equal(first.alignment,'items_start');
  assert.equal(first.nodes[0].nodes.length,1);
  assert.equal(second.nodes[0].nodes.length,0);
});

test('linked-agent messages place their avatar on the left while personal messages stay on the right', () => {
  const chat={id:'parent',agent:'claude',real:false};
  const v={chatId:'parent',chat:()=>chat,thinking:()=>false,me:{initials:'Me',color:'#333333'}};
  for (const kind of ['update','delegation','agent']) {
    const message={id:kind,kind:'text',from:'me',text:'Worker message',source:{chat:'child',title:'Worker',agent:'codex',kind}};
    const row=findElement(messageRow(v,{},[message],0,500),`msg-${kind}`);
    assert.equal(row.nodes[0].nodes.length,1,'linked-agent avatar belongs before its bubble');
    assert.ok(findElement(row,`copy-${kind}`));
    assert.equal(row.nodes.at(-1).elementId,`copy-${kind}`,'copy control belongs after the agent bubble');
  }
  const own={id:'own',kind:'text',from:'me',text:'My message'};
  const row=findElement(messageRow(v,{},[own],0,500),'msg-own');
  assert.equal(row.nodes[0].elementId,'copy-own');
  assert.equal(row.nodes.at(-1).nodes.length,1,'personal avatar belongs after its bubble');
});
