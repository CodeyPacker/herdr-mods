import { view, fake } from './support/mod.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, realpath, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { collectOutputs, fileOutput, webOutput } from '../mods/hey-chat/outputs.js';
import { fileAction } from '../mods/hey-chat/output-files.mjs';
import { applyEvent, resetThread } from '../mods/hey-chat/messages.js';

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), 'hey-output-'));
  t.after(() => rm(dir, { force: true, recursive: true }));
  return dir;
}

test('both agents discover successful generated files, grouping revisions without timestamp churn', () => {
  const chat = { id: 'chat', cwd: '/project' };
  resetThread(chat);
  for (const event of [
    { type: 'tool', id: 'a', name: 'Write', input: { file_path: 'output/review.md' } },
    { type: 'tool_done', id: 'a' },
    { type: 'tool', id: 'b', name: 'CodexPatch', input: { changes: [{ path: './output/review.md' }, { path: 'output/dashboard.html' }] } },
    { type: 'tool_done', id: 'b' },
    { type: 'tool', id: 'c', name: 'Write', input: { file_path: 'failed.md' } },
    { type: 'tool_done', id: 'c', error: true },
    { type: 'tool', id: 'd', name: 'Read', input: { file_path: 'private.md' } },
    { type: 'tool_done', id: 'd' },
    { type: 'tool', id: 'e', name: 'Write', input: { file_path: 'stopped.md' } },
    { type: 'turn_end', stopped: true },
  ]) applyEvent(chat, event);
  chat.outputs = collectOutputs(chat);
  assert.equal(chat.outputs.length, 2);
  assert.equal(chat.outputs.find(o => o.label === 'review.md').message, chat.thread[1].id);
  assert.deepEqual(collectOutputs(chat), chat.outputs);
  chat.thread = [];
  assert.deepEqual(collectOutputs(chat), chat.outputs, 'trimmed session history retains discovered files');
});

test('artifact and preview links appear, research citations and non-web schemes do not', () => {
  const chat = { cwd: '/project', thread: [
    { id: 'one', kind: 'text', from: 'agent', text: '[Docs](https://docs.example.com/start) and [Preview](http://localhost:3000/) and [Project review](output/review.md)' },
    { id: 'two', kind: 'text', from: 'me', text: 'Here it is: https://claude.ai/public/artifacts/abc.' },
  ] };
  const outputs = collectOutputs(chat);
  assert.equal(outputs.length, 3);
  assert.equal(outputs.find(o => o.provider === 'Claude').target, 'https://claude.ai/public/artifacts/abc');
  assert.ok(outputs.some(o => o.label === 'Preview'));
  assert.ok(outputs.some(o => o.target === '/project/output/review.md'));
  for (const url of ['javascript:alert(1)', 'file:///private/report.md', 'https://example.com/<script>', 'https://']) assert.equal(webOutput(url), null);
});

test('paths normalize Windows separators, relative paths and encoded spaces without shell syntax', () => {
  assert.equal(fileOutput('C:\\Project\\out\\..\\report.md:12', 'C:/Project').target, 'C:/Project/report.md');
  assert.equal(fileOutput('./out/project%20review.md', '/project').target, '/project/out/project review.md');
  assert.equal(fileOutput('~/review.md', '/project', '/home/me').target, '/home/me/review.md');
  assert.equal(fileOutput('https://example.com/report.md', '/project'), null);
  assert.equal(fileOutput('script.sh', '/project'), null);
});

test('previews read bounded text, delegate HTML, and report missing files', async t => {
  const dir = await temp(t);
  const file = join(dir, 'review.md');
  await writeFile(file, '# Review\n\nReady.');
  assert.deepEqual(await fileAction('read', file), { kind: 'markdown', text: '# Review\n\nReady.', truncated: false });
  const large = join(dir, 'large.txt');
  await writeFile(large, 'a'.repeat(300000));
  assert.equal((await fileAction('read', large)).kind, 'external');
  const html = join(dir, 'dashboard.html');
  await writeFile(html, '<script>throw Error("must not execute")</script>');
  assert.deepEqual(await fileAction('read', html), { kind: 'external' });
  await assert.rejects(fileAction('read', join(dir, 'missing.md')));
  await assert.rejects(fileAction('read', 'relative.md'));
});

test('the preview CLI works through a linked mod installation', async t => {
  const dir = await temp(t);
  const file = join(dir, 'review.md');
  await writeFile(file, '# Linked preview');
  const linked = join(dir, 'hey-chat');
  await symlink(fileURLToPath(new URL('../mods/hey-chat', import.meta.url)), linked, process.platform === 'win32' ? 'junction' : 'dir');
  const result = JSON.parse(execFileSync(process.execPath, [join(linked, 'output-files.mjs'), 'read', file], { encoding: 'utf8' }));
  assert.equal(result.kind, 'markdown');
  assert.equal(result.text, '# Linked preview');
});

test('opening and revealing outputs use literal arguments on Mac and Windows', async t => {
  const dir = await temp(t);
  const path = join(dir, "project's review.md");
  await writeFile(path, '# Review');
  const file = await realpath(path);
  const calls = [];
  const launch = (command, args) => { calls.push({ command, args }); const child = new EventEmitter(); queueMicrotask(() => child.emit('exit', 0)); return child; };
  await fileAction('open', file, 'darwin', launch);
  assert.equal(calls[0].command, 'open');
  assert.deepEqual(calls[0].args, [file]);
  await fileAction('open', file, 'win32', launch);
  assert.equal(calls[1].command, 'powershell.exe');
  assert.equal(Buffer.from(calls[1].args.at(-1), 'base64').toString('utf16le'), `Start-Process -FilePath '${file.replace(/'/g, "''")}'`);
  await fileAction('reveal', file, 'win32', launch);
  assert.deepEqual(calls[2], { command: 'explorer.exe', args: [`/select,${file}`] });
  const script = join(dir, 'run.sh');
  await writeFile(script, 'do not execute');
  await assert.rejects(fileAction('open', script, 'darwin', launch));
  assert.equal(calls.length, 3);
});

test('a slow preview cannot replace a newer selection or leak into another conversation', async () => {
  const pending = [];
  fake('agent.js', { outputFileAction: () => new Promise(resolve => pending.push(resolve)) });
  const chat = { id: 'one', outputs: [{ key: 'a', kind: 'text', target: '/a.txt' }, { key: 'b', kind: 'text', target: '/b.txt' }] };
  const v = await view({ chatId: 'one', chat: () => chat });
  const jobs = [];
  const cx = { spawn: fn => jobs.push(fn(cx)), notify() {} };
  v.selectOutput('a', cx); v.selectOutput('b', cx);
  pending[1]({ kind: 'text', text: 'new' });
  await jobs[1];
  pending[0]({ kind: 'text', text: 'stale' });
  await jobs[0];
  assert.equal(v.outputPreview.text, 'new');
  v.selectOutput('a', cx);
  v.chatId = 'two';
  pending[2]({ kind: 'text', text: 'wrong conversation' });
  await jobs[2];
  assert.equal(v.outputPreview, null);
});

test('a new file shows a short toast in the open chat only, and replayed history never does', async () => {
  const { resetThread: reset } = await import('../mods/hey-chat/messages.js');
  const chat = { id: 'one', cwd: '/project' };
  reset(chat);
  const timers = [];
  const cx = { notify() {}, timer: { after(ms, fn) { timers.push({ ms, fn }); } } };
  const bridge = { synced: false };
  const v = await view({ chatId: 'one', chat: () => chat, bridges: new Map([['one', bridge]]), outputsOpen: false, outputToast: null,
    unread: {}, atBottom: false, zone: 'chat', needsYou: () => false, saveChats() {}, focusInput() {} });
  const write = (id, file) => {
    v.onEvent(chat, { type: 'tool', id, name: 'Write', input: { file_path: file } }, cx);
    v.onEvent(chat, { type: 'tool_done', id }, cx);
  };
  write('replayed', 'old.md');
  assert.equal(v.outputToast, null, 'a file from replayed history is not news');
  bridge.synced = true;
  write('live', 'review.md');
  assert.equal(v.outputToast.text, 'New: review.md');
  assert.equal(timers.at(-1).ms, 4000);
  timers.at(-1).fn(cx);
  assert.equal(v.outputToast, null, 'it goes away on its own');
  v.chatId = 'other';
  write('elsewhere', 'other.md');
  assert.equal(v.outputToast, null, 'only the open chat shows it');
});