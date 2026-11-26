import { test } from 'node:test';
import assert from 'node:assert/strict';
import { view, fake, mod, findElement } from './support/mod.mjs';

const { linkedChatsView, summaryButton } = await mod('views/chat.js');

test('linked children stay beneath parents, with search preserving their ancestors', async () => {
  const chats = [
    {id:'parent',linkId:'root',project:'p',title:'Plan',stamp:1},
    {id:'child',parentId:'root',project:'p',title:'Build',stamp:10,pinned:true},
    {id:'other',project:'p',title:'Other',stamp:5},
  ];
  const v = await view({chats,query:''});
  assert.deepEqual(v.chatsIn('p').map(c=>c.id),['other','parent','child']);
  assert.equal(v.chatDepth.child,1);
  v.query = 'build';
  assert.deepEqual(v.chatsIn('p').map(c=>c.id),['parent','child']);
});

test('progress links navigate ordinary chats without changing the composer', async () => {
  const parent={id:'parent',title:'Plan'},child={id:'child',parentId:'parent',title:'Build',linkSummary:{summary:{task:'Build feature',progress:['Done']}}};
  const opened=[];
  const v=await view({chats:[parent,child],summaryFor:'parent',draft:'Unsent work',openChat(id){opened.push(id);}});
  const cx={notify(){}};
  findElement(linkedChatsView(v,{},parent),'open-child-child').click({},cx);
  findElement(linkedChatsView(v,{},child),'open-parent-chat').click({},cx);
  assert.deepEqual(opened,['child','parent']);
  assert.equal(v.draft,'Unsent work');
});

test('summary details stay hidden until the info button is opened, without repeating the answer', async () => {
  const parent={id:'parent',title:'Plan'};
  const child={id:'child',parentId:'parent',title:'Review',linkSummary:{summary:{task:'Review changes',progress:['Checked files']},lastResponse:'Full answer duplicated',stale:true}};
  let refreshed=0;
  const v=await view({chats:[parent,child],async refreshLinkedChats(){refreshed++;}});
  const jobs=[],cx={notify(){},stop_propagation(){},spawn(fn){jobs.push(fn(cx));}};
  const texts=el=>typeof el==='string'?[el]:(el?.nodes??[]).flatMap(texts);
  assert.equal(linkedChatsView(v,{},parent),null);
  assert.deepEqual(texts(linkedChatsView(v,{},child)),['Parent: Plan']);
  findElement(summaryButton(v,{},child),'toggle-chat-summary').click({},cx);
  await Promise.all(jobs);
  assert.equal(refreshed,1);
  const shown=texts(linkedChatsView(v,{},child));
  assert.ok(shown.includes('Review changes'));
  assert.equal(shown.includes('Full answer duplicated'),false);
  findElement(summaryButton(v,{},child),'toggle-chat-summary').click({},cx);
  assert.deepEqual(texts(linkedChatsView(v,{},child)),['Parent: Plan']);
});

test('panel requests wait for the matching project and load newly created children before navigation', async () => {
  let request={id:'child',cwd:'/project',nonce:'one'};
  fake('herdr',{shared:()=>request,setShared:(_key,value)=>{request=value;}});
  const opened=[],jobs=[];
  const v=await view({chats:[],folder:'/other',loaded:true,async refreshLinkedChats(){this.chats.push({id:'child'});},openChat(id){opened.push(id);}});
  const cx={spawn(fn){jobs.push(fn(cx));},notify(){}};
  v.openRequestedChat(cx);
  assert.equal(jobs.length,0);
  v.folder='/project';v.loaded=false;v.openRequestedChat(cx);
  assert.equal(jobs.length,0);
  v.loaded=true;v.openRequestedChat(cx);
  await Promise.all(jobs);
  assert.equal(request,null);
  assert.deepEqual(opened,['child']);
  v.openRequestedChat(cx);
  assert.equal(jobs.length,1);
});

test('replayed child creation snapshots cannot resurrect a deleted chat', async () => {
  const root={id:'root',thread:[]};
  const stale={id:'deleted-child',parentId:'root',cwd:'/project',agent:'codex',deleted:false};
  fake('agent.js',{listLinkedChats:async()=>[{...stale,deleted:true}]});
  const jobs=[];
  const bridge={synced:false};
  const cx={spawn(fn){jobs.push(fn(cx));},notify(){}};
  const v=await view({chats:[root],chatId:'root',folder:'/project',bridges:new Map([['root',bridge]]),syncing:new Set(),
    syncOutputs(){},saveChats(){},projects:[]});
  v.onEvent(root,{type:'linked_chat',chat:stale},cx);
  assert.equal(v.chats.length,1);
  bridge.synced=true;
  v.onEvent(root,{type:'synced'},cx);
  await Promise.all(jobs);
  assert.equal(v.chats.length,1);
  assert.equal(v.deletedLinkedChats.has(stale.id),true);
});

test('a deleted link reports its deletion before launching a bridge', async () => {
  fake('herdr',{readTextFile:async()=>'{"deleted":true}',hc:()=>assert.fail('deleted chat must not start a process')});
  const {Bridge}=await mod('agent.js');
  const bridge=new Bridge({chat:'deleted-child',agent:'codex',cwd:'/project',session:null},()=>{},()=>{});
  await assert.rejects(bridge.launch({}),/This chat was deleted/);
});
