// Saved document attachments. PDFs are passed to agent tools without parsing.
import { writeFile, mkdir, open } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, join, resolve } from 'node:path';
import { flags, isMain } from './cli.mjs';

export const FILES_REL = 'data/hey-chat/files';
export const TEXT_LIMIT = 100_000;
export const TOTAL_LIMIT = 200_000;
const TEXT_BYTES = 256 * 1024;
const PDF_BYTES = 20 * 1024 * 1024;
const TYPES = new Set(['.txt', '.md', '.csv', '.pdf']);

/** Read a bounded file even if its size changes after stat. */
async function readBounded(file, limit) {
  const handle = await open(file, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('Choose a file, not a folder.');
    if (info.size > limit) throw new Error(`This file is too large. The limit is ${limit === PDF_BYTES ? '20 MB for PDFs' : '256 KB for text files'}.`);
    const bytes = Buffer.alloc(Math.min(info.size, limit) + 1);
    let bytesRead = 0;
    while (bytesRead < bytes.length) {
      const part = await handle.read(bytes, bytesRead, bytes.length - bytesRead, bytesRead);
      if (!part.bytesRead) break;
      bytesRead += part.bytesRead;
    }
    if (bytesRead > limit) throw new Error('This file is too large.');
    return bytes.subarray(0, bytesRead);
  } finally { await handle.close(); }
}

/** Copies the original first so edits to the source cannot change a queued attachment. */
export async function prepareDocument(file, dir) {
  const ext = extname(file).toLowerCase();
  if (!TYPES.has(ext)) throw new Error('Supported files: PDF, TXT, Markdown (.md), CSV, and images.');
  const bytes = await readBounded(file, ext === '.pdf' ? PDF_BYTES : TEXT_BYTES);
  if (ext === '.pdf' && !bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('This file is not a readable PDF.');
  const name = basename(file);
  const savedName = `${createHash('sha256').update(bytes).update(name).digest('hex').slice(0, 32)}${ext}`;
  let text = "";
  if (ext !== '.pdf') {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('Save this text file as UTF-8, then attach it again.'); }
    if (text.includes('\0')) throw new Error('This file contains binary data. Attach a UTF-8 text file instead.');
  }
  text = text.replace(/^\uFEFF/, '');
  if (ext !== '.pdf' && !text.trim()) throw new Error('This file is empty.');
  if (text.length > TEXT_LIMIT) throw new Error('This file contains too much text. Attach a shorter file (up to 100,000 characters).');
  await mkdir(dir, { recursive: true });
  const saved = join(dir, savedName);
  await writeFile(saved, bytes, { mode: 0o600 });
  return { kind: 'document', path: `${FILES_REL}/${savedName}`, name, bytes: bytes.length, format: ext === '.pdf' ? 'pdf' : 'text', characters: text.length };
}

/** Resolves only attachment names inside this app's saved files directory. */
export function savedFile(path, dir) {
  const name = String(path).replace(/\\/g, '/').slice(FILES_REL.length + 1);
  if (!String(path).replace(/\\/g, '/').startsWith(`${FILES_REL}/`) || !/^[a-f0-9]{32}\.(txt|md|csv|pdf)$/.test(name)) throw new Error('This attachment is unavailable. Remove it and attach it again.');
  return join(dir, name);
}

export function readDocuments(files, dir) {
  let total = 0;
  return files.map(file => {
    const saved = savedFile(file.path, dir);
    const pdf = extname(saved) === ".pdf";
    let info;
    try { info = statSync(saved); } catch { throw new Error("This attachment is missing. Remove it and attach it again."); }
    if (!info.isFile() || info.size > (pdf ? PDF_BYTES : TEXT_BYTES)) throw new Error('This attachment is unavailable or too large. Remove it and attach it again.');
    const content = pdf ? undefined : readFileSync(saved, 'utf8');
    total += content?.length ?? 0;
    if ((content?.length ?? 0) > TEXT_LIMIT || total > TOTAL_LIMIT) throw new Error('These attachments contain too much text. Send fewer files (up to 200,000 characters total).');
    return { kind: 'document', path: file.path, name: String(file.name ?? basename(saved)), bytes: info.size, format: pdf ? "pdf" : "text", characters: content?.length ?? 0, localPath: resolve(saved), content };
  });
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const opts = flags(rest);
  try {
    const result = mode === 'open' ? await (await import('./output-files.mjs')).fileAction('open', savedFile(opts.path, opts.dir))
      : mode === 'file' ? await prepareDocument(opts.file, opts.dir)
      : mode === 'check' ? (readDocuments(JSON.parse(opts.files), opts.dir), { ok: true })
      : { error: 'Unknown document action.' };
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    const message = error.code === 'ENOENT' ? 'This file is missing. Check its location and try again.'
      : ['EACCES', 'EPERM'].includes(error.code) ? 'This file cannot be read. Check its permissions and try again.'
      : error.message || 'Could not read this file.';
    process.stdout.write(JSON.stringify({ error: message }));
    process.exitCode = 1;
  }
}
