import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, resetThread, visibleMessages, planSteps, PLAN_TOOL } from '../mods/hey-chat/messages.js';

test('each plan call replaces the chat plan, and its card stays hidden in condensed mode', () => {
  const chat = { id: 'chat' };
  resetThread(chat);
  applyEvent(chat, { type: 'user', text: 'Fix it.' });
  applyEvent(chat, { type: 'tool', id: 'p1', name: PLAN_TOOL, input: { items: [
    { text: 'Read the code', status: 'in_progress' },
    { text: 'Fix the bug', status: 'pending' },
  ] } });
  assert.deepEqual(chat.plan.map(s => s.status), ['in_progress', 'pending']);
  applyEvent(chat, { type: 'tool', id: 'p2', name: PLAN_TOOL, input: { items: [
    { text: 'Read the code', status: 'completed' },
    { text: 'Fix the bug', status: 'in_progress' },
  ] } });
  assert.deepEqual(chat.plan.map(s => s.status), ['completed', 'in_progress']);
  assert.equal(visibleMessages(chat, true).filter(m => m.kind === 'tool').length, 0);
  assert.equal(visibleMessages(chat, false).filter(m => m.title?.includes('plan')).length, 2);
});

test('a new message clears the last turn plan, and a queued one does not', () => {
  const chat = { id: 'chat' };
  resetThread(chat);
  applyEvent(chat, { type: 'tool', id: 'p', name: PLAN_TOOL, input: { items: [{ text: 'Step', status: 'pending' }] } });
  applyEvent(chat, { type: 'queued', id: 'q1', text: 'Later' });
  assert.equal(chat.plan.length, 1);
  applyEvent(chat, { type: 'user', text: 'Next task' });
  assert.equal(chat.plan, null);
});

test('plan steps drop empty text and treat unknown states as pending', () => {
  assert.deepEqual(planSteps({ items: [{ text: ' A ', status: 'done' }, { text: '', status: 'completed' }, null] }),
    [{ text: 'A', status: 'pending' }]);
  assert.deepEqual(planSteps(undefined), []);
});

test('Show plan is its own setting and leaves Condense chat alone', async () => {
  const { view, fake } = await import('./support/mod.mjs');
  const saved = [];
  fake('herdr', { setShared: (...args) => saved.push(args) });
  const v = await view({});
  v.showPlan = true;
  v.condenseChat = true;
  v.toggleShowPlan();
  assert.equal(v.showPlan, false);
  assert.equal(v.condenseChat, true);
  assert.deepEqual(saved, [['hey-chat.showPlan', false]]);
});
