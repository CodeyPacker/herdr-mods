import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { fileOf } from '../mods/hey-chat/images.mjs';

const root = new URL('../mods/hey-chat/', import.meta.url);
const source = async name => (await readFile(new URL(name, root), 'utf8')).replace(/^import .*;\n/gm, '');
const messages = await import(new URL('messages.js', root));
const HeyChat = new Function('View', 'pendingQuestion', (await source('main.js')).replace('export default class', 'return class'))(class {}, messages.pendingQuestion);

function setup(questions, bridge = {}) {
  const chat = { id: 'chat', agent: 'codex' };
  messages.resetThread(chat);
  messages.applyEvent(chat, { type: 'question', id: 'ask1', questions });
  const card = messages.pendingQuestion(chat);
  const v = Object.create(HeyChat.prototype);
  let text = '';
  Object.assign(v, { chatId: chat.id, zone: 'chat', chat: () => chat, bridges: new Map([[chat.id, bridge]]), inputFor: () => ({ value: () => text, set_value: x => { text = x; } }) });
  const jobs = [];
  const cx = { notify() {}, spawn(fn) { jobs.push(fn(cx)); } };
  return { v, chat, card, cx, jobs, type: x => { text = x; } };
}
const q = { id: 'skill', question: 'Which skill?', options: [{ label: 'Languages' }, { label: 'Music' }], multi: false };

test('a click sends exactly once, and waits for the bridge before showing Answered', async () => {
  const calls = [];
  let finish;
  const s = setup([q], { answer: (...args) => { calls.push(args); return new Promise(resolve => { finish = resolve; }); } });
  s.v.pickAnswer(s.card, q, 'Music', s.cx);
  s.v.pickAnswer(s.card, q, 'Languages', s.cx);
  assert.equal(s.card.state, 'pending');
  assert.deepEqual(calls, [['ask1', { skill: ['Music'] }]]);
  finish();
  await Promise.all(s.jobs);
  assert.equal(s.card.state, 'answered');
});

test('multiple questions and multiple choices wait until all answers are ready', async () => {
  const calls = [];
  const multi = { ...q, id: 'second', multi: true };
  const s = setup([q, multi], { answer: async (...args) => calls.push(args) });
  s.v.pickAnswer(s.card, q, 'Music', s.cx);
  s.v.sendAnswers(s.card, s.cx);
  assert.equal(calls.length, 0);
  s.v.pickAnswer(s.card, multi, 'Languages', s.cx);
  s.v.pickAnswer(s.card, multi, 'Music', s.cx);
  s.v.pickAnswer(s.card, multi, 'Languages', s.cx);
  assert.equal(calls.length, 0);
  s.v.sendAnswers(s.card, s.cx);
  await Promise.all(s.jobs);
  assert.deepEqual(calls[0][1], { skill: ['Music'], second: ['Music'] });
});

test('typed answers bypass slash commands and can replace a selected answer', async () => {
  const calls = [];
  const s = setup([{ ...q, multi: true }], { answer: async (...args) => calls.push(args) });
  s.v.pickAnswer(s.card, s.card.questions[0], 'Music', s.cx);
  s.type('/compact');
  assert.equal(s.v.slashItems(), null);
  s.v.send(s.cx);
  await Promise.all(s.jobs);
  assert.deepEqual(calls[0][1], { skill: ['/compact'] });
});

test('failed writes keep the question available for retry', async () => {
  const s = setup([q], { answer: async () => { throw new Error('Disconnected'); } });
  s.v.pickAnswer(s.card, q, 'Music', s.cx);
  await Promise.all(s.jobs);
  assert.equal(s.card.state, 'pending');
  assert.equal(s.card.error, 'Disconnected');
  s.v.bridges.set('chat', { answer: async () => {} });
  s.v.sendAnswers(s.card, s.cx);
  await Promise.all(s.jobs);
  assert.equal(s.card.state, 'answered');
});

test('dismissal goes to the bridge and ended turns disable pending cards', async () => {
  const calls = [];
  const s = setup([q], { decide: async (...args) => calls.push(args) });
  s.v.dismissQuestion(s.card, s.cx);
  await Promise.all(s.jobs);
  assert.deepEqual(calls, [['ask1', 'deny', false]]);
  assert.equal(s.card.state, 'dismissed');
  const next = setup([q]);
  messages.applyEvent(next.chat, { type: 'turn_end', stopped: true });
  assert.equal(messages.pendingQuestion(next.chat), null);
});

// Run the actual bridge against in-memory app-server and pane transports.
async function bridge(agent, model = null, options = {}) {
  const sockets = [];
  const events = [];
  const requests = [];
  const spawns = [];
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {};
  const stdout = msg => child.stdout.emit('data', JSON.stringify(msg) + '\n');
  child.stdin = { write(line) {
    const m = JSON.parse(line); requests.push(m);
    if (m.method === 'initialize') queueMicrotask(() => stdout({ id: m.id, result: {} }));
    if (m.method === 'thread/start' || m.method === 'thread/resume') queueMicrotask(() => stdout({ id: m.id, result: { thread: { id: 'thread' }, model } }));
    if (m.method === 'turn/start') queueMicrotask(() => stdout({ id: m.id, result: { turn: { id: 'turn' } } }));
  } };
  const server = { listen(_port, _host, fn) { fn(); }, address: () => ({ port: 1234 }) };
  const context = vm.createContext({
    spawn: (command, args) => { spawns.push({ command, args }); return child; }, createServer: fn => { server.connect = fn; return server; },
    mkdirSync() {}, writeFileSync() {}, readFileSync() { throw new Error('missing'); }, rmSync() {},
    join: (...x) => x.join('/'), dirname: x => x, fileURLToPath: x => x,
    process: { argv: ['node', 'bridge', 'serve', '--chat', 'chat', '--cwd', '/tmp', '--state', '/tmp/state', '--agent', agent,
      ...(options.model ? ['--model', options.model] : []), ...(options.resume ? ['--resume', options.resume] : [])], on() {} },
    setInterval() {}, setTimeout, clearTimeout, console, fileOf,
  });
  const code = (await source('bridge.mjs')).replace('import.meta.url', '"bridge.mjs"');
  vm.runInContext(code, context);
  const socket = role => {
    const sock = new EventEmitter();
    sock.write = line => events.push(JSON.parse(line));
    sock.end = line => { if (line) sockets.push(JSON.parse(line)); };
    server.connect(sock);
    sock.emit('data', JSON.stringify({ role }) + '\n');
    return sock;
  };
  const pane = socket('pane');
  const send = m => pane.emit('data', JSON.stringify(m) + '\n');
  send({ type: 'send', text: 'Ask me a question' });
  await new Promise(resolve => setImmediate(resolve));
  return { events, requests, stdout, send, socket, sockets, spawns };
}

test('selected models reach new and resumed Codex threads and Claude launches', async () => {
  for (const resume of [null, 'existing-session']) {
    const b = await bridge('codex', 'resolved-model', { model: 'selected-model', resume });
    const request = b.requests.find(r => r.method === (resume ? 'thread/resume' : 'thread/start'));
    assert.equal(request.params.model, 'selected-model');
    if (resume) assert.equal(request.params.threadId, resume);
    assert.equal(b.requests.find(r => r.method === 'turn/start').params.model, 'selected-model');
  }
  const claude = await bridge('claude', null, { model: 'sonnet', resume: 'existing-session' });
  const args = claude.spawns[0].args;
  assert.equal(args[args.indexOf('--model') + 1], 'sonnet');
  assert.equal(args[args.indexOf('--resume') + 1], 'existing-session');
});

test('live model reports update the chat for Codex and Claude', async () => {
  const codex = await bridge('codex', 'codex-model');
  assert.equal(codex.events.find(e => e.type === 'model').model, 'codex-model');
  codex.stdout({ method: 'model/rerouted', params: { toModel: 'fallback-model' } });
  const chat = {};
  messages.resetThread(chat);
  for (const ev of codex.events.filter(e => e.type === 'model')) messages.applyEvent(chat, ev);
  assert.equal(chat.model, 'fallback-model');
  assert.equal(chat.thread.length, 0);
  const claude = await bridge('claude');
  claude.stdout({ type: 'system', subtype: 'init', model: 'claude-model' });
  claude.stdout({ type: 'assistant', message: { model: 'claude-model', content: [] } });
  claude.stdout({ type: 'assistant', message: { model: '<synthetic>', content: [] } });
  assert.deepEqual(claude.events.filter(e => e.type === 'model').map(e => e.model), ['claude-model']);
});

test('Codex receives selected answers and resolved requests withdraw their cards', async () => {
  const b = await bridge('codex');
  assert.equal(b.requests[0].params.capabilities.experimentalApi, true);
  const ask = id => b.stdout({ id, method: 'item/tool/requestUserInput', params: { questions: [q] } });
  ask(42);
  const card = b.events.find(e => e.type === 'question');
  b.send({ type: 'answer', id: card.id, answers: { skill: ['Music'] } });
  assert.deepEqual(b.requests.find(r => r.id === 42).result, { answers: { skill: { answers: ['Music'] } } });
  ask(43);
  const second = b.events.filter(e => e.type === 'question').at(-1);
  b.stdout({ method: 'serverRequest/resolved', params: { requestId: 43 } });
  assert.ok(b.events.some(e => e.type === 'decided' && e.id === second.id));
  b.send({ type: 'answer', id: second.id, answers: { skill: ['Languages'] } });
  assert.equal(b.requests.some(r => r.id === 43), false);
});

test('asynchronous Codex questions remain clickable after completion and send a new turn', async () => {
  const b = await bridge('codex');
  b.stdout({ method: 'item/completed', params: { item: { type: 'agentMessage', id: 'question-message', text: '',
    questions: [{ title: 'Did reopening work?', options: ['Yes', 'No'] }] } } });
  const card = b.events.find(e => e.type === 'question');
  assert.equal(card.async, true);
  assert.deepEqual(card.questions[0].options.map(o => o.label), ['Yes', 'No']);
  b.stdout({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
  const chat = { id: 'chat', agent: 'codex' };
  messages.resetThread(chat);
  for (const ev of b.events) messages.applyEvent(chat, ev);
  const pending = messages.pendingQuestion(chat);
  assert.ok(pending);
  const v = Object.create(HeyChat.prototype);
  Object.assign(v, { chatId: 'chat', chat: () => chat, chatAgentName: () => 'Codex', bridges: new Map([['chat', {
    answer: async (id, answers) => b.send({ type: 'answer', id, answers }),
  }]]) });
  const jobs = [];
  const cx = { notify() {}, spawn(fn) { jobs.push(fn(cx)); } };
  const rendered = renderQuestion(v, {}, pending, element(), 500);
  findElement(rendered, `q-${pending.id}-0-1`).click({}, cx);
  await Promise.all(jobs);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pending.state, 'answered');
  const starts = b.requests.filter(r => r.method === 'turn/start');
  assert.equal(starts.length, 2);
  assert.equal(starts[1].params.input[0].text, 'Did reopening work?\nNo');
});

test('asynchronous answers steer an active turn and dismissal sends no answer', async () => {
  const b = await bridge('codex');
  const ask = () => b.stdout({ method: 'item/completed', params: { item: { type: 'agentMessage', id: 'question', text: '',
    questions: [{ title: 'Which?', options: ['First', 'Second'] }] } } });
  ask();
  let card = b.events.filter(e => e.type === 'question').at(-1);
  b.send({ type: 'answer', id: card.id, answers: { [card.questions[0].id]: ['First'] } });
  const steer = b.requests.find(r => r.method === 'turn/steer');
  assert.equal(steer.params.expectedTurnId, 'turn');
  assert.equal(steer.params.input[0].text, 'Which?\nFirst');
  ask();
  card = b.events.filter(e => e.type === 'question').at(-1);
  const count = b.requests.length;
  b.send({ type: 'decide', id: card.id, behavior: 'deny' });
  assert.equal(b.requests.length, count);
});

test('Claude receives selected answers in AskUserQuestion updatedInput', async () => {
  const b = await bridge('claude');
  const sock = b.socket('mcp');
  const question = { question: 'Which skill?', header: 'Skill', options: q.options, multiSelect: true };
  sock.emit('data', JSON.stringify({ type: 'ask', tool: 'AskUserQuestion', input: { questions: [question] } }) + '\n');
  const card = b.events.find(e => e.type === 'question');
  b.send({ type: 'answer', id: card.id, answers: { 'Which skill?': ['Music', 'Languages'] } });
  assert.deepEqual(b.sockets[0].updatedInput.answers, { 'Which skill?': 'Music, Languages' });
  assert.equal(b.sockets[0].behavior, 'allow');
});

// Exercise the rendered option's click handler, including the answered card's disabled state.
function element() {
  const data = { nodes: [] };
  const el = new Proxy(data, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'when') return (condition, fn) => { if (condition) fn(el); return el; };
    if (key === 'child') return child => { target.nodes.push(child); return el; };
    if (key === 'children') return children => { target.nodes.push(...children); return el; };
    if (key === 'id') return id => { target.elementId = id; return el; };
    if (key === 'on_click') return handler => { target.click = handler; return el; };
    return () => el;
  } });
  return el;
}
const renderQuestion = new Function('div', 'h_flex', 'v_flex', (await source('views/chat.js')).replace(/export function /g, 'function ') + '\nreturn questionCard;')(element, element, element);
function findElement(el, id) {
  if (!el || typeof el !== 'object') return null;
  if (el.elementId === id) return el;
  for (const child of el.nodes ?? []) {
    const found = findElement(child, id);
    if (found) return found;
  }
  return null;
}

test('rendered options are clickable and become inactive after submission', async () => {
  const calls = [];
  const s = setup([q], { answer: async (...args) => calls.push(args) });
  s.v.chatAgentName = () => 'Codex';
  const rendered = renderQuestion(s.v, {}, s.card, element(), 500);
  findElement(rendered, `q-${s.card.id}-0-1`).click({}, s.cx);
  await Promise.all(s.jobs);
  assert.deepEqual(calls, [['ask1', { skill: ['Music'] }]]);
  const answered = renderQuestion(s.v, {}, s.card, element(), 500);
  assert.equal(Object.hasOwn(findElement(answered, `q-${s.card.id}-0-1`), 'click'), false);
  assert.equal(findElement(answered, `qskip-${s.card.id}`), null);
});

test('messages queue FIFO, preserve attachments and skills, and replay without duplicate bubbles', async () => {
  const b = await bridge('codex');
  const queued = { type: 'send', id: 'next', text: '/review Review this too', images: [{ path: 'data/hey-chat/images/p.png', w: 20, h: 10 }], skill: { name: 'review', path: '/skills/review' } };
  b.send(queued);
  b.send(queued);
  b.send({ type: 'send', id: 'third', text: 'Then this' });
  assert.equal(b.requests.filter(r => r.method === 'turn/start').length, 1);
  assert.deepEqual(b.events.filter(e => e.type === 'queued').map(e => e.id), ['next', 'third']);
  const chat = { id: 'chat' };
  messages.resetThread(chat);
  for (const ev of b.events) messages.applyEvent(chat, ev);
  assert.equal(chat.thread.filter(m => m.queueId === 'next').length, 2);
  assert.equal(chat.thread.filter(m => m.queueId === 'next' && m.queueAction).length, 1);
  const pending = chat.thread.find(m => m.queueAction && m.queueId === 'next');
  assert.equal(pending.queued, true);
  const replayStart = b.events.length;
  b.socket('pane'); // Closing and reopening the pane leaves the queue in its bridge.
  const reopened = { id: 'chat' };
  messages.resetThread(reopened);
  for (const ev of b.events.slice(replayStart)) messages.applyEvent(reopened, ev);
  assert.equal(reopened.thread.find(m => m.queueId === 'next').queued, true);
  b.stdout({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
  await new Promise(resolve => setImmediate(resolve));
  const starts = b.requests.filter(r => r.method === 'turn/start');
  assert.equal(starts.length, 2);
  assert.equal(starts[1].params.input[0].type, 'skill');
  assert.equal(starts[1].params.input[1].type, 'localImage');
  assert.equal(starts[1].params.input[2].text, 'Review this too');
  const accepted = b.events.find(e => e.type === 'user' && e.queueId === 'next');
  messages.applyEvent(chat, accepted);
  assert.equal(pending.queued, false);
  assert.equal(chat.thread.filter(m => m.queueId === 'next').length, 2, 'activation updates the original bubbles');
  b.stdout({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.requests.filter(r => r.method === 'turn/start').at(-1).params.input[0].text, 'Then this');
});

test('Send now steers Codex once with the active turn id and removes only that queued message', async () => {
  const b = await bridge('codex');
  b.send({ type: 'send', id: 'later', text: 'Do this later' });
  b.send({ type: 'send', id: 'now', text: 'Change direction', images: [{ path: 'data/hey-chat/images/shot.png' }] });
  b.send({ type: 'send_now', id: 'now' });
  b.send({ type: 'send_now', id: 'now' });
  await new Promise(resolve => setImmediate(resolve));
  const steer = b.requests.find(r => r.method === 'turn/steer');
  assert.equal(steer.params.expectedTurnId, 'turn');
  assert.equal(steer.params.input[0].type, 'localImage');
  assert.equal(steer.params.input[1].text, 'Change direction');
  assert.equal(b.requests.filter(r => r.method === 'turn/steer').length, 1);
  assert.equal(b.requests.some(r => r.method === 'turn/interrupt'), false);
  b.stdout({ id: steer.id, result: {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.events.filter(e => e.type === 'user' && e.queueId === 'now').length, 1);
  b.stdout({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.requests.filter(r => r.method === 'turn/start').at(-1).params.input[0].text, 'Do this later');
});

test('failed steering stays queued and can be retried without failing the active turn', async () => {
  const b = await bridge('codex');
  b.send({ type: 'send', id: 'next', text: 'Try this' });
  b.send({ type: 'send_now', id: 'next' });
  await new Promise(resolve => setImmediate(resolve));
  const steer = b.requests.find(r => r.method === 'turn/steer');
  b.stdout({ id: steer.id, error: { message: 'Steer refused' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.events.at(-1).type, 'queue_error');
  assert.equal(b.events.some(e => e.type === 'turn_end'), false);
  b.send({ type: 'send_now', id: 'next' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.requests.filter(r => r.method === 'turn/steer').length, 2);
});

test('a stopped turn keeps queued messages waiting until Send now', async () => {
  const b = await bridge('codex');
  b.send({ type: 'send', id: 'next', text: 'Wait for me' });
  b.stdout({ method: 'turn/completed', params: { turn: { status: 'interrupted' } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.requests.filter(r => r.method === 'turn/start').length, 1);
  b.send({ type: 'send_now', id: 'next' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.requests.filter(r => r.method === 'turn/start').length, 2);
});

test('Claude Send now interrupts once and resumes with the selected queued message', async () => {
  const b = await bridge('claude');
  b.send({ type: 'send', id: 'next', text: 'Change direction' });
  b.send({ type: 'send_now', id: 'next' });
  b.send({ type: 'send_now', id: 'next' });
  assert.equal(b.events.some(e => e.type === 'user' && e.queueId === 'next'), false);
  b.stdout({ type: 'result', subtype: 'success' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.spawns.length, 2);
  assert.equal(b.requests.filter(r => r.type === 'user' && r.message.content === 'Change direction').length, 1);
  assert.equal(b.events.filter(e => e.type === 'user' && e.queueId === 'next').length, 1);
});

test('a turn ending during steering starts a rejected message once as the next turn', async () => {
  const b = await bridge('codex');
  b.send({ type: 'send', id: 'next', text: 'Still send this' });
  b.send({ type: 'send_now', id: 'next' });
  await new Promise(resolve => setImmediate(resolve));
  const steer = b.requests.find(r => r.method === 'turn/steer');
  b.stdout({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
  assert.equal(b.requests.filter(r => r.method === 'turn/start').length, 1, 'reserve the message until steering resolves');
  b.stdout({ id: steer.id, error: { message: 'Turn already ended' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.requests.filter(r => r.method === 'turn/start').length, 2);
  assert.equal(b.events.filter(e => e.type === 'user' && e.queueId === 'next').length, 1);
});

const renderMessage = new Function('div', 'h_flex', 'v_flex', 'myPicture', 'agentPicture',
  (await source('views/chat.js')).replace(/export function /g, 'function ') + '\nreturn messageRow;')(
  element, element, element, element, element);

test('Send now stays under its queued bubble and disables duplicate clicks until acknowledgement', async () => {
  const calls = [];
  const wire = { sendNow: async id => calls.push(id) };
  const s = setup([], wire);
  s.chat.questions.clear();
  s.chat.thread = [];
  s.chat.working = true;
  s.v.link = async () => wire;
  messages.applyEvent(s.chat, { type: 'queued', id: 'next', text: 'Use this direction' });
  messages.applyEvent(s.chat, { type: 'text', text: 'A response still in progress' });
  const card = s.chat.thread.find(m => m.queueAction);
  const rendered = renderMessage(s.v, {}, s.chat.thread, s.chat.thread.indexOf(card), 500);
  findElement(rendered, 'send-now-next').click({}, s.cx);
  findElement(rendered, 'send-now-next').click({}, s.cx);
  await Promise.all(s.jobs);
  assert.deepEqual(calls, ['next']);
  assert.equal(card.queued, true, 'a socket write alone does not mark the message delivered');
  const sending = renderMessage(s.v, {}, s.chat.thread, s.chat.thread.indexOf(card), 500);
  assert.equal(Object.hasOwn(findElement(sending, 'send-now-next'), 'click'), false);
  messages.applyEvent(s.chat, { type: 'user', queueId: 'next', text: 'Use this direction' });
  const sent = renderMessage(s.v, {}, s.chat.thread, s.chat.thread.indexOf(card), 500);
  assert.equal(findElement(sent, 'send-now-next'), null);
  assert.equal(s.chat.thread.filter(m => m.text === 'Use this direction').length, 1);
});
