// File operations happen only after an explicit click. Never execute output content.
import { readFile, stat, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { isAbsolute, dirname, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMain } from './cli.mjs';

export async function fileAction(action, target, platform = process.platform, launch = spawn) {
  if (!isAbsolute(target)) throw new Error('Expected an absolute file path.');
  const file = await realpath(target);
  const info = await stat(file);
  if (!info.isFile()) throw new Error('This output is not a file.');
  if (action === 'read') {
    if (!/\.(md|markdown|txt|csv|json|ya?ml)$/i.test(file)) return { kind: 'external' };
    if (info.size > 256 * 1024) return { kind: 'external', note: 'This file is too large to preview. Open it in its usual app.' };
    const text = await readFile(file, 'utf8');
    return { kind: /\.(md|markdown)$/i.test(file) ? 'markdown' : 'text', text: text.slice(0, 20000), truncated: text.length > 20000 };
  }
  if (!['open', 'reveal'].includes(action)) throw new Error('Unknown file action.');
  if (action === 'open' && !/\.(html?|md|markdown|txt|csv|json|ya?ml|svg|png|jpe?g|gif|webp|pdf|docx?|xlsx?|pptx?)$/i.test(extname(file))) throw new Error('Open this file from its folder.');
  let command, args;
  if (platform === 'darwin') { command = 'open'; args = action === 'reveal' ? ['-R', file] : [file]; }
  else if (platform === 'win32') {
    if (action === 'reveal') { command = 'explorer.exe'; args = [`/select,${file}`]; }
    else {
      command = 'powershell.exe';
      const script = `Start-Process -FilePath '${file.replace(/'/g, "''")}'`;
      args = ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
    }
  } else { command = 'xdg-open'; args = [action === 'reveal' ? dirname(file) : pathToFileURL(file).href]; }
  await new Promise((resolve, reject) => {
    const child = launch(command, args, { stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    // Windows Explorer exits with 1 even when it opened the folder, so its exit code says nothing.
    const ignoreCode = platform === 'win32' && action === 'reveal';
    child.once('exit', code => code === 0 || ignoreCode ? resolve() : reject(new Error('Could not open this output.')));
  });
  return { ok: true };
}

if (isMain(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await fileAction(process.argv[2], process.argv[3]))); }
  catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
