import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { readEvents } from '../mods/hey-chat/bridge-events.mjs';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('snapshot reads only missing events and finishes without closing the agent', async () => {
  await withServer(socket => socket.once('data', data => {
    const request = JSON.parse(data);
    assert.equal(request.after, 3);
    assert.equal(request.snapshot, true);
    socket.end(JSON.stringify({ type: 'permission', id: 'ask1' }) + '\n' + JSON.stringify({ type: 'replay_end', total: 4, startedAt: 123 }) + '\n');
  }), async port => {
    assert.deepEqual(await readEvents(port, 3), { after: 3, events: [{ type: 'permission', id: 'ask1' }], total: 4, startedAt: 123 });
  });
});

test('already-running bridges can be read without upgrading or approving anything', async () => {
  await withServer(socket => socket.once('data', () => {
    socket.write('{"type":"ready"}\n{"type":"working"}\n{"type":"permission","id":"ask2"}\n');
  }), async port => {
    assert.deepEqual(await readEvents(port, 2), { after: 2, events: [{ type: 'permission', id: 'ask2' }], total: 3 });
  });
});

test('linked installations recover replies after a stalled native socket', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hey-chat-replay-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const linked = join(dir, 'hey-chat');
  await symlink(fileURLToPath(new URL('../mods/hey-chat', import.meta.url)), linked, process.platform === 'win32' ? 'junction' : 'dir');
  await withServer(socket => socket.once('data', () => {
    // An older bridge replays its entire history, including the previous usage error.
    socket.write([
      { type: 'turn_end', error: true, text: 'Usage limit reached' },
      { type: 'user', text: 'Continue' },
      { type: 'working' },
      { type: 'text', text: 'Resumed successfully' },
      { type: 'turn_end' },
    ].map(event => JSON.stringify(event) + '\n').join(''));
  }), async port => {
    const { stdout } = await promisify(execFile)(process.execPath, [join(linked, 'bridge-events.mjs'), String(port), '1']);
    const replay = JSON.parse(stdout);
    assert.equal(replay.total, 5);
    assert.deepEqual(replay.events.map(event => event.type), ['user', 'working', 'text', 'turn_end']);
    assert.equal(replay.events[2].text, 'Resumed successfully');
  });
});
