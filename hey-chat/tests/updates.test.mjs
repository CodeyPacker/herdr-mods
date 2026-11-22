import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyEvent, resetThread, visibleMessages } from '../mods/hey-chat/messages.js';

const source = async name => (await readFile(new URL(`../mods/hey-chat/${name}`, import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const line = ev => Buffer.from(JSON.stringify(ev) + '\n');

test('idle connection recovery never adds typing dots or scrolls the conversation', async () => {
  const HeyChat = new Function('View', 'applyEvent', 'visibleMessages', (await source('main.js')).replace('export default class', 'return class'))(class {}, applyEvent, visibleMessages);
  const chat = { id: 'chat' };
  resetThread(chat);
  const timers = [];
  let scrolls = 0;
  const cx = { notify() {}, timer: { after(ms, fn) { timers.push({ ms, fn }); } } };
  const v = Object.assign(Object.create(HeyChat.prototype), { chatId: 'chat', chat: () => chat, atBottom: true,
    needsYou: () => false, scrollDown() { scrolls++; } });
  v.onEvent(chat, { type: 'connection', state: 'reconnecting' }, cx);
  assert.equal(v.busy(chat), true, 'sending stays blocked during recovery');
  assert.equal(v.thinking(chat), false);
  assert.deepEqual(v.rowIds(), [], 'no temporary typing row');
  assert.equal(chat.connectionSlow, false, 'brief retries stay out of the status');
  assert.equal(timers[0].ms, 1000);
  v.onEvent(chat, { type: 'connection', state: 'connected' }, cx);
  timers.shift().fn(cx);
  assert.equal(chat.connectionSlow, false, 'a completed retry cannot flash a stale notice');
  assert.equal(v.busy(chat), false);
  assert.equal(scrolls, 0);
  v.onEvent(chat, { type: 'connection', state: 'reconnecting' }, cx);
  timers.shift().fn(cx);
  assert.equal(chat.connectionSlow, true, 'sustained connection problems remain visible');
  assert.deepEqual(v.rowIds(), []);
  chat.working = true;
  assert.equal(v.thinking(chat), true, 'an actual running turn still shows its dots');
  assert.deepEqual(v.rowIds(), ['typing']);
  v.onEvent(chat, { type: 'connection', state: 'disconnected' }, cx);
  assert.equal(chat.connectionSlow, false);
  assert.equal(chat.disconnected, true);
});

test('a dropped stream reconnects and replays missing events without duplicates', async () => {
  const first = [{ type: 'ready', session: 'session' }, { type: 'user', text: 'Hello' }, { type: 'working' }, { type: 'text', text: 'First response' }];
  const final = { type: 'text', text: 'Final response ✓' };
  const complete = { type: 'turn_end' };
  // The original socket fails partway through the final message, including a split UTF-8 character.
  const chunks = [Buffer.concat([...first.map(line), line(final).subarray(0, -4)]), new Error('socket read failed')];
  const replay = Buffer.concat([...first, final, complete].map(line));
  const sockets = [chunks, [replay]];
  let connects = 0, closes = 0, launches = 0;
  const net = { async connect() {
    const reads = sockets[connects++];
    assert.ok(reads, 'must reuse the existing bridge');
    return { async write() {}, async read() { const next = reads.shift(); if (next instanceof Error) throw next; return next ?? null; }, close() {} };
  } };
  const Bridge = new Function('net', (await source('agent.js')).replace(/export /g, '') + '\nreturn Bridge;')(net);
  const events = [];
  const bridge = new Bridge({ chat: 'chat', agent: 'codex', cwd: '/tmp', session: 'session' }, ev => {
    events.push(ev);
    if (ev.type === 'turn_end') bridge.close();
  }, () => { closes++; });
  bridge.running = async () => { bridge.startedAt = 1; return 1234; };
  bridge.launch = async () => { launches++; throw new Error('must not launch'); };
  const cx = { notify() {}, timer: { after(_ms, done) { queueMicrotask(done); } } };
  await bridge.open(cx);
  assert.equal(connects, 2);
  assert.equal(launches, 0);
  assert.equal(closes, 0);
  assert.deepEqual(events.filter(e => e.type !== 'connection'), [...first, final, complete]);
  assert.ok(events.some(e => e.type === 'connection' && e.state === 'reconnecting'));
});

test('a stopped bridge reports disconnection instead of starting a second writer', async () => {
  let probes = 0, closed = false;
  const net = { connect: async () => ({ write: async () => {}, read: async () => null, close() {} }) };
  const Bridge = new Function('net', (await source('agent.js')).replace(/export /g, '') + '\nreturn Bridge;')(net);
  const chat = {};
  resetThread(chat);
  const bridge = new Bridge({ chat: 'chat', agent: 'codex', cwd: '/tmp', session: 'session' }, ev => applyEvent(chat, ev), () => { closed = true; });
  bridge.running = async () => { bridge.startedAt = 1; return ++probes === 1 ? 1234 : null; };
  bridge.launch = async () => { throw new Error('must not launch'); };
  await bridge.open({ notify() {}, timer: { after(_ms, done) { queueMicrotask(done); } } });
  assert.equal(closed, true);
  assert.equal(chat.reconnecting, false);
  assert.equal(chat.disconnected, true);
});

test('the last message and typing indicator stay anchored after layout catches up', async () => {
  const HeyChat = new Function('View', 'applyEvent', 'visibleMessages', 'LIST_PAD_TOP', 'LIST_PAD_BOTTOM', (await source('main.js')).replace('export default class', 'return class'))(class {}, applyEvent, visibleMessages, 16, 10);
  const chat = { id: 'chat' };
  resetThread(chat);
  const scrolls = [];
  let notifications = 0;
  const cx = { notify() { notifications++; } };
  const v = Object.assign(Object.create(HeyChat.prototype), { chatId: 'chat', chat: () => chat, atBottom: true, rowHeights: new Map(), viewH: 500, top: 0,
    scroll: { scroll_to_item(i) { scrolls.push(i); } }, saveChats() {}, needsYou: () => false });
  v.onEvent(chat, { type: 'text', text: 'A response taller than the viewport.\n'.repeat(100) }, cx);
  assert.equal(scrolls.at(-1), 1, 'target the bottom marker after the oversized message');
  v.measureRow(chat.thread[0].id, 3000, cx);
  assert.equal(scrolls.length, 2, 'repeat the scroll after the actual height is measured');
  v.onEvent(chat, { type: 'working' }, cx);
  assert.equal(scrolls.at(-1), 2, 'target the marker after the new typing indicator');
  v.measureRow('typing', 52, cx);
  assert.equal(scrolls.at(-1), 2);
  v.onEvent(chat, { type: 'turn_end' }, cx);
  assert.equal(scrolls.at(-1), 1, 'reanchor when the typing indicator is removed');
  const before = notifications;
  v.measureRow('typing', 52, cx);
  v.measureViewport(500, cx);
  assert.equal(notifications, before, 'stable layout must not cause a redraw loop');
  v.atBottom = false;
  const count = scrolls.length;
  v.onEvent(chat, { type: 'text', text: 'Another response' }, cx);
  v.measureRow(chat.thread.at(-1).id, 80, cx);
  v.measureViewport(400, cx);
  assert.equal(scrolls.length, count, 'do not pull someone away from older messages they are reading');
  v.trackMessageScroll(-10000);
  assert.equal(v.atBottom, true, 'manual scrolling back to the bottom resumes following');
  v.onEvent(chat, { type: 'text', text: 'Latest response' }, cx);
  assert.equal(scrolls.at(-1), 3);
  v.trackMessageScroll(100);
  assert.equal(v.atBottom, false, 'scrolling up pauses following');
});
