import { mod } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { chatRow } = await mod('views/tree.js');

/** A sidebar view with one chat that is not open, and nothing waiting or running. */
function view() {
  return { chatId: 'other', unread: {}, zone: 'chat', cursor: '', needsYou: () => false, thinking: () => false, keyHint: () => '' };
}

/** The texts a row draws, in order. @param {any} el @returns {string[]} */
function texts(el) {
  return typeof el === 'string' ? [el] : (el.nodes ?? []).flatMap(texts);
}

test('a chat whose last message is a card draws a preview, not undefined', () => {
  const cards = [
    { kind: 'permission', from: 'agent', state: 'allowed', title: 'Run npm test', lines: [] },
    { kind: 'permission', from: 'agent', state: 'denied', title: 'Edit main.js', lines: [] },
    { kind: 'question', from: 'agent', state: 'answered', questions: [{ id: 'q', question: 'Which one?' }] },
  ];
  for (const card of cards) {
    const chat = { id: 'a', agent: 'claude', title: 'A chat', time: 'Now', thread: [card] };
    const row = chatRow(view(), {}, chat, 'c:a');
    assert.ok(texts(row).some(s => s.length > 0 && !s.includes('undefined')), card.kind);
  }
});

test('a chat with no title or time from its session still draws', () => {
  const chat = { id: 'a', agent: 'codex', title: undefined, time: undefined, thread: [] };
  assert.doesNotThrow(() => chatRow(view(), {}, chat, 'c:a'));
});
