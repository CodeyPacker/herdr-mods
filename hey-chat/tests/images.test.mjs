import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathsIn, fileOf } from '../mods/hey-chat/images.mjs';

test('image paths in a message are found by full path, once each, only when the file exists', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hey-chat-images-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const shot = join(dir, 'shot.png');
  await writeFile(shot, 'x');
  // The form each system writes: C:\…\shot.png on Windows, /…/shot.png elsewhere.
  const text = `Saved \`${shot}\` and again (${shot}). Not there: ${join(dir, 'missing.png')}`;
  assert.deepEqual(pathsIn(text), [resolve(shot)]);
  assert.deepEqual(pathsIn('See shot.png and docs/shot.png'), [], 'a relative name is not a full path');
});

test('Windows paths written with forward slashes are found too', { skip: process.platform !== 'win32' && 'Windows only' }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hey-chat-images-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const shot = join(dir, 'shot.jpg');
  await writeFile(shot, 'x');
  assert.deepEqual(pathsIn(`Look at "${shot.replace(/\\/g, '/')}".`), [resolve(shot)]);
});

test('a kept image is always read from the images folder, whatever path is sent', () => {
  const dir = join(tmpdir(), 'images');
  assert.equal(fileOf('data/hey-chat/images/a.png', dir), join(dir, 'a.png'));
  assert.equal(fileOf('../../secret.png', dir), join(dir, 'secret.png'));
  assert.equal(fileOf('..\\..\\secret.png', dir), join(dir, 'secret.png'));
});
