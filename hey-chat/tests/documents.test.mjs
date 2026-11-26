import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prepareDocument, readDocuments, savedFile, TEXT_LIMIT } from '../mods/hey-chat/documents.mjs';
import { withDocuments, splitDocuments } from '../mods/hey-chat/file-messages.mjs';
import { view, fake, mod, findElement } from './support/mod.mjs';
import { resetThread, applyEvent } from '../mods/hey-chat/messages.js';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../mods/hey-chat/sessions.mjs', import.meta.url));
const docScript = fileURLToPath(new URL('../mods/hey-chat/documents.mjs', import.meta.url));
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'hey-chat-files-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, dir: join(root, 'saved') };
}

test('saved text and PDF attachments survive moving or deleting their source without parsing PDFs', async t => {
  const { root, dir } = await setup(t);
  const source = join(root, 'notes.md');
  await writeFile(source, '# Notes\nKeep the original.');
  const text = await prepareDocument(source, dir);
  await writeFile(source, 'Changed source');
  await rm(source);
  const [sent] = readDocuments([text], dir);
  assert.equal(sent.content, '# Notes\nKeep the original.');
  assert.equal(text.name, 'notes.md');
  const pdfSource = join(root, 'report.pdf');
  const bytes = Buffer.from('%PDF-1.7\nOpaque binary PDF bytes\0\xff\n%%EOF', 'latin1');
  await writeFile(pdfSource, bytes);
  const pdf = await prepareDocument(pdfSource, dir);
  await rm(pdfSource);
  const [reference] = readDocuments([pdf], dir);
  assert.equal(reference.format, 'pdf');
  assert.equal(reference.content, undefined, 'PDF bytes must never be decoded into prompt text');
  assert.deepEqual(await readFile(reference.localPath), bytes);
  assert.equal(reference.localPath, savedFile(pdf.path, dir));
  assert.equal(splitDocuments(withDocuments('', [reference])).files[0].name, 'report.pdf');
});

test('unsupported, empty, invalid UTF-8, binary and oversized files fail before attachment', async t => {
  const { root, dir } = await setup(t);
  for (const [name, bytes, message] of [
    ['archive.zip', 'zip', /Supported files/],
    ['empty.txt', '', /empty/],
    ['binary.txt', 'a\0b', /binary/],
    ['encoding.txt', Buffer.from([0xff]), /UTF-8/],
    ['fake.pdf', 'Not PDF bytes', /readable PDF/],
    ['large.txt', Buffer.alloc(256 * 1024 + 1), /too large/],
    ['long.md', 'a'.repeat(TEXT_LIMIT + 1), /too much text/],
    ['large.pdf', Buffer.alloc(20 * 1024 * 1024 + 1), /too large/],
  ]) {
    const path = join(root, name);
    await writeFile(path, bytes);
    await assert.rejects(prepareDocument(path, dir), message);
  }
  const folder = join(root, 'folder.txt');
  await mkdir(folder);
  await assert.rejects(prepareDocument(folder, dir), /folder/);
});

test('saved-file checks reject traversal, missing copies and excessive combined text', async t => {
  const { root, dir } = await setup(t);
  assert.throws(() => savedFile('data/hey-chat/files/../../secret.txt', dir), /unavailable/);
  assert.throws(() => readDocuments([{ path: `data/hey-chat/files/${'a'.repeat(32)}.txt` }], dir), /missing/);
  const files = [];
  for (let i = 0; i < 3; i++) {
    const path = join(root, `file-${i}.txt`);
    await writeFile(path, 'x'.repeat(TEXT_LIMIT));
    files.push(await prepareDocument(path, dir));
  }
  assert.throws(() => readDocuments(files, dir), /fewer files/);
  assert.equal(readDocuments(files.slice(0, 2), dir).length, 2);
});

for (const agent of ['claude', 'codex']) {
  test(`${agent} session history restores file cards instead of exposing the attachment envelope`, async t => {
    const { root, dir } = await setup(t);
    const source = join(root, 'notes.txt');
    await writeFile(source, 'Important attached content');
    const metadata = await prepareDocument(source, dir);
    const files = readDocuments([metadata], dir);
    for (const message of ['', 'Summarize this']) {
      const input = withDocuments(message, files);
      const record = agent === 'claude' ? { type: 'user', message: { content: input } }
        : { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: input }] } };
      const file = join(root, 'session.jsonl');
      await writeFile(file, JSON.stringify(record));
      const result = JSON.parse((await run(process.execPath, [script, 'read', '--agent', agent, '--file', file])).stdout);
      const user = result.find(ev => ev.type === 'user');
      assert.equal(user.text, message);
      assert.deepEqual(user.files, [metadata]);
      const chat = { id: 'chat' };
      resetThread(chat);
      for (const event of result) applyEvent(chat, event);
      assert.equal(chat.thread.filter(m => m.kind === 'file')[0].name, 'notes.txt');
      assert.equal(chat.thread.some(m => m.text?.includes('<hey-chat-attachments>')), false);
    }
  });
}

test('dropping mixed files preserves the original chat, accepts valid files, and reports rejected files', async () => {
  let finish;
  fake('agent.js', {
    imageFile: async () => ({ path: 'image.png', w: 20, h: 10 }),
    documentFile: file => file.endsWith('.txt') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ error: 'Unsupported file' }),
  });
  const chat = { id: 'a', attached: [] }, other = { id: 'b', attached: [] };
  const v = await view({ chatId: 'a', chat: id => id === 'a' ? chat : other, saveChats() {}, focusInput() {} });
  const jobs = [];
  const cx = { notify() {}, spawn: fn => jobs.push(fn(cx)) };
  v.dropImages(['/tmp/picture.png', '/tmp/notes.txt', '/tmp/archive.zip'], cx);
  await new Promise(resolve => setImmediate(resolve));
  v.chatId = 'b';
  finish({ kind: 'document', path: 'notes.txt', name: 'notes.txt' });
  await Promise.all(jobs);
  assert.deepEqual(chat.attached.map(f => f.path), ['image.png', 'notes.txt']);
  assert.match(chat.pasteError, /Unsupported/);
  assert.deepEqual(other.attached, []);
});

test('pasted document paths become attachments and sent file cards open the saved copy', async () => {
  const paths = [];
  const v = await view({ dropImages: files => paths.push(...files) });
  let text = '/tmp/my notes.pdf';
  v.pastedPath({ value: () => text, set_value: x => { text = x; } }, { read_from_clipboard: () => '/tmp/my notes.pdf' });
  assert.equal(text, '');
  assert.deepEqual(paths, ['/tmp/my notes.pdf']);
  const { documentCard } = await mod('views/chat.js');
  const opened = [];
  const file = { name: 'report.pdf', path: 'data/hey-chat/files/report.pdf', format: 'pdf', bytes: 4000 };
  const card = documentCard({ openDocument: path => opened.push(path) }, {}, file);
  findElement(card, `document-${file.path}`).click({}, { notify() {} });
  assert.deepEqual(opened, [file.path]);
});

test('document CLI reports missing paths with a readable error', async t => {
  const { root, dir } = await setup(t);
  await assert.rejects(run(process.execPath, [docScript, 'file', '--file', join(root, 'missing.txt'), '--dir', dir]), error => {
    assert.match(JSON.parse(error.stdout).error, /file is missing/);
    return true;
  });
});
