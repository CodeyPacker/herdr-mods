// Stands in for Herdr's "fs/promises" module, which has only some of Node's functions.
import { standIn } from '../fakes.mjs';

export const { mkdir } = standIn('fs/promises', {
  mkdir: async () => {},
});
