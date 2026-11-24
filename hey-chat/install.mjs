#!/usr/bin/env node
// Run with Node.js from a downloaded ZIP or checkout. No Git or npm dependencies.
import { cp, mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The key that opens Hey, chat, and what it runs. */
const KEY = 'ctrl-shift-h', OPEN = 'mod.open:hey-chat';

export async function install(appDir = process.env.HERDR_APP_HOME || join(homedir(), '.config', 'herdr-app')) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install the current Node.js LTS release, then run this command again.');
  const source = fileURLToPath(new URL('mods/hey-chat', import.meta.url));
  const destination = join(appDir, 'mods', 'hey-chat');
  const keysFile = join(appDir, 'keys.json');
  const oldKeys = await readFile(keysFile, 'utf8').catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  const keys = oldKeys === null ? {} : JSON.parse(oldKeys);
  if (!keys || Array.isArray(keys) || typeof keys !== 'object' || (keys.global && (typeof keys.global !== 'object' || Array.isArray(keys.global)))) throw new Error('keys.json has an unsupported format. No files were changed.');
  // A key already set for Hey, chat is kept. Otherwise the default key is added, unless it is taken.
  const hasKey = Object.values(keys.global ?? {}).includes(OPEN);
  const binding = keys.global?.[KEY];
  if (!hasKey && binding) throw new Error(`Ctrl+Shift+H is already assigned to ${JSON.stringify(binding)}. Choose another key before installing. No files were changed.`);
  const existing = await lstat(destination).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  if (existing?.isSymbolicLink()) throw new Error(`The mod is linked at ${destination}. Update its source instead. No files were changed.`);
  const backup = join(appDir, 'backups', 'hey-chat', `${Date.now()}-${randomUUID()}`);
  if (existing || oldKeys !== null) {
    await mkdir(backup, { recursive: true });
    if (existing) await cp(destination, join(backup, 'mod'), { recursive: true });
    if (oldKeys !== null) await writeFile(join(backup, 'keys.json'), oldKeys);
  }
  await mkdir(join(appDir, 'mods'), { recursive: true });
  await cp(source, destination, { recursive: true });
  if (!hasKey) {
    keys.global = { ...keys.global, [KEY]: OPEN };
    await writeFile(keysFile, `${JSON.stringify(keys, null, 2)}\n`);
  }
  return { destination, backup: existing || oldKeys !== null ? backup : null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await install();
    console.log(`Installed Hey, chat in ${result.destination}`);
    if (result.backup) console.log(`Previous files saved in ${result.backup}`);
    console.log('Open Herdr and press Ctrl+Shift+H, or the key you already had for Hey, chat. Setup will guide you through anything missing.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
