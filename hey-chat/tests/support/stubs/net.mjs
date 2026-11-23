// Stands in for Herdr's "net" module, whose connect() resolves with a socket that has
// promise-based read and write. Fake it per test with fake("net", { connect }).
import { standIn } from '../fakes.mjs';

const net = standIn('net', {
  connect: async () => { throw new Error('net connect is not faked in this test.'); },
});

export default net;
export const { connect } = net;
