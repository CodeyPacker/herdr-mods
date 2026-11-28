import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fake, mod, view, findElement } from './support/mod.mjs';

const colors = await mod('message-colors.js');
const {messageRow} = await mod('views/chat.js');
const {settingsDialog} = await mod('views/settings.js');
const theme = {accent:'#2563eb',accent_foreground:'#ffffff',raised:'#303030',foreground:'#eeeeee',background:'#101010',border:'#555555',popover:'#181818'};
function storage() {
  const state={};
  fake('herdr',{shared:key=>state[key],setShared:(key,value)=>{state[key]=value;}});
  return state;
}
const nodes = element => !element || typeof element!=='object' ? [] : [element,...(element.nodes??[]).flatMap(nodes)];

test('message colors accept exact hex values, persist independently, and reject invalid input', async () => {
  storage();
  assert.equal(colors.parseMessageColor('abc'),'#aabbcc');
  assert.equal(colors.parseMessageColor('#1234'),'#11223344');
  assert.equal(colors.saveMessageColor('userBackground','#123456'),true);
  assert.equal(colors.saveMessageColor('userText','#fff'),true);
  assert.equal(colors.saveMessageColor('agentBackground','#654321'),true);
  assert.equal(colors.saveMessageColor('agentText','#abcdef80'),true);
  assert.equal(colors.saveMessageColor('agentText','red; garbage'),false);
  const reopened=await mod('message-colors.js?reopened');
  assert.deepEqual(reopened.messageColors(theme),{userBackground:'#123456',userText:'#ffffff',agentBackground:'#654321',agentText:'#abcdef80'});
  colors.saveMessageColor('agentText','');
  // A custom background without its own text color gets text that suits it, whatever the theme.
  assert.equal(colors.messageColors(theme).agentText,'#ffffff');
  assert.equal(colors.messageColors({...theme,foreground:'#342d26'}).agentText,'#ffffff');
  colors.saveMessageColor('agentBackground','#f4ebdd');
  assert.equal(colors.messageColors(theme).agentText,'#16161a');
  colors.saveMessageColor('agentBackground','');
  assert.equal(colors.messageColors(theme).agentText,theme.foreground);
  colors.resetMessageColors();
  assert.deepEqual(colors.loadMessageColors(),{});
});

test('Theme tab keeps invalid edits editable and resets all four controls to theme defaults', async () => {
  storage();
  const v=await view({shortcuts:{hide(){}},width:1000,height:800});
  v.setSettingsTab('theme');
  v.setMessageColor('userBackground','#336699');
  assert.equal(v.messageColorInputs.userBackground.value(),'#336699');
  v.messageColorInputs.userBackground.set_value('#invalid');
  v.setMessageColor('userBackground','#invalid');
  assert.equal(colors.loadMessageColors().userBackground,'#336699');
  assert.ok(v.messageColorErrors.userBackground);
  const dialog=settingsDialog(v,theme);
  assert.ok(findElement(dialog,'message-color-preview'));
  assert.ok(findElement(dialog,'agentText-ffffff'));
  findElement(dialog,'reset-message-colors').click({}, {notify(){}});
  assert.deepEqual(colors.loadMessageColors(),{});
  assert.ok(Object.values(v.messageColorInputs).every(input=>input.value()===''));
  assert.deepEqual(v.messageColorErrors,{});
});

test('both message directions and agent Markdown use their chosen background and text colors', () => {
  storage();
  for (const [field,color] of Object.entries({userBackground:'#123456',userText:'#ffeedd',agentBackground:'#654321',agentText:'#aabbcc'})) colors.saveMessageColor(field,color);
  const chat={id:'chat',agent:'claude',real:true};
  const v={chatId:'chat',chat:()=>chat,thinking:()=>false,me:{initials:'Me',color:'#444444'}};
  const messages=[{id:'user',kind:'text',from:'me',text:'Hello'}, {id:'agent',kind:'text',from:'agent',text:'**Hello**'}];
  const user=nodes(messageRow(v,theme,messages,0,500)).find(el=>el.background==='#123456');
  const agent=nodes(messageRow(v,theme,messages,1,500)).find(el=>el.background==='#654321');
  assert.equal(user.foreground,'#ffeedd');
  assert.equal(agent.foreground,'#aabbcc');
  assert.ok(agent.nodes.some(el=>el.foreground==='#aabbcc'),'native Markdown receives the text color too');
});

test('custom backgrounds combine their alpha with Wallpaper opacity and keep text readable', () => {
  const state=storage();
  state.layout='islands';state['backgrounds.seeThrough']={layout:'islands',opacity:0.5};
  fake('herdr',{layout:()=>({background:{image:'wallpaper.png'}})});
  colors.saveMessageColor('userBackground','#123456');
  colors.saveMessageColor('agentBackground','#65432180');
  colors.saveMessageColor('userText','#ffffff');
  const faded=colors.messageColors(theme);
  assert.equal(faded.userBackground,'#12345680');
  assert.equal(faded.agentBackground,'#65432140');
  assert.equal(faded.userText,'#ffffff');
  assert.equal(colors.messageColors(theme,false).userBackground,'#123456');
});
