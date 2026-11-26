import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openBy } from '../mods/hey-chat/sessions.mjs';

const fake = (pids, commands) => (program, args) =>
  program === 'lsof' ? { stdout: pids } : { stdout: commands[args.at(-1)] ?? '' };

test('names the app that still has a Codex session open', { skip: process.platform === 'win32' }, () => {
  assert.equal(openBy('/s.jsonl', fake('21915\n', { 21915: '/Applications/ChatGPT.app/Contents/MacOS/codex app-server' })), 'the ChatGPT app');
  assert.equal(openBy('/s.jsonl', fake('7\n', { 7: '/Applications/Codex.app/Contents/MacOS/codex' })), 'the Codex app');
  assert.equal(openBy('/s.jsonl', fake('7\n', { 7: '/usr/local/bin/codex' })), 'another Codex window');
});

test('reports nothing when no other program has the file open, or the file is unknown', () => {
  assert.equal(openBy('/s.jsonl', fake('', {})), null);
  assert.equal(openBy('/s.jsonl', fake(`${process.pid}\n`, {})), null);
  assert.equal(openBy(undefined, fake('7\n', {})), null);
});
