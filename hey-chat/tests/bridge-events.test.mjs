import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { readEvents } from '../mods/hey-chat/bridge-events.mjs';

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
