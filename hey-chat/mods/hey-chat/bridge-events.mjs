// A bounded replay read, independent of the UI runtime's persistent socket reader.
import { connect } from 'node:net';
import { pathToFileURL } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { realpath } from 'node:fs/promises';

export function readEvents(port, after = 0) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    const events = [];
    const decoder = new StringDecoder('utf8');
    let buffer = '', quiet, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(quiet);
      socket.destroy();
      if (error) reject(error);
      else resolve(result ?? { after, events: events.slice(after), total: events.length });
    };
    const deadline = setTimeout(() => finish(new Error('Bridge replay timed out.')), 3000);
    socket.on('connect', () => socket.write(JSON.stringify({ role: 'pane', snapshot: true, after }) + '\n'));
    socket.on('data', chunk => {
      buffer += decoder.write(chunk);
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let event;
        try { event = JSON.parse(line); } catch { finish(new Error('Invalid bridge replay.')); return; }
        if (event.type === 'replay_end') {
          finish(null, { after, events, total: event.total, startedAt: event.startedAt });
          return;
        }
        events.push(event);
      }
      // Already-running bridges predate snapshots. They replay everything and stay open.
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        if (!buffer && events.length) finish();
      }, 200);
    });
    socket.on('end', () => {
      if (buffer || !events.length) finish(new Error('Incomplete bridge replay.'));
      else finish();
    });
    socket.on('error', error => finish(error));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  readEvents(Number(process.argv[2]), Number(process.argv[3]) || 0)
    .then(result => process.stdout.write(JSON.stringify(result)))
    .catch(error => { process.stderr.write(error.message); process.exitCode = 1; });
}
