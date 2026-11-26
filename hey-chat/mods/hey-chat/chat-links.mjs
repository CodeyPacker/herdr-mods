// Linked chats share the existing bridge transport, queue and provider sessions.
import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { connect } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { bridgeArgs } from './bridge-options.js';
import { flags, isMain } from './cli.mjs';
import { agentCommand } from './process.mjs';

const exec = promisify(execFile);
const SELF = fileURLToPath(new URL('./bridge.mjs', import.meta.url));
const ID = /^[a-zA-Z0-9_-]{1,160}$/;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
function write(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}-${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  renameSync(temp, file);
}
function text(value, name, max = 8000, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${name} must be ${required ? 'nonempty text' : 'text'} of at most ${max} characters.`);
  return value.trim();
}
function lines(value, name, max = 12) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error(`${name} must contain at most ${max} entries.`);
  return value.map(v => text(v, name, 1000, true));
}

export const CHAT_TOOLS = [
  { name: 'chat_create', description: 'Delegate work to a new linked chat. Returns immediately. Use a stable request_id when retrying the same delegation. The child uses the ordinary chat queue, permissions and session. Pass a focused brief and relevant references, not the full parent history. After success, confirm in one short sentence naming the agent/model and task. Do not repeat the brief or list what you told the child.', inputSchema: { type: 'object', properties: { request_id: { type: 'string' }, title: { type: 'string' }, agent: { type: 'string', enum: ['claude', 'codex'] }, model: { type: 'string' }, brief: { type: 'string' }, references: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'object' } }, images: { type: 'array', items: { type: 'object' } } }, required: ['request_id', 'title', 'agent', 'model', 'brief'] } },
  { name: 'chat_send', description: 'Send instructions to a related chat. The ordinary queue is the default; now explicitly steers its active turn. Does not grant permissions or answer human approval prompts. Use a stable request_id for retries.', inputSchema: { type: 'object', properties: { chat_id: { type: 'string' }, request_id: { type: 'string' }, message: { type: 'string' }, now: { type: 'boolean' } }, required: ['chat_id', 'request_id', 'message'] } },
  { name: 'chat_read', description: 'Read a related chat. Default: compact progress summary, task, state and outstanding human requests. Use messages with an after cursor for recent exchanges. all explicitly pages through the full bridge history. Never read the entire history just to check progress. Large single events return a JSON fragment and next_offset; repeat with the same after cursor and that offset to continue.', inputSchema: { type: 'object', properties: { chat_id: { type: 'string' }, mode: { type: 'string', enum: ['summary', 'messages', 'all'] }, after: { type: 'integer', minimum: 0 }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, required: ['chat_id'] } },
  { name: 'chat_summary', description: 'Maintain your compact running summary after meaningful progress, decisions or blockers and before finishing. Include current task, progress, decisions, blockers, what you need, and message/file references. This reports permission requests but never approves them.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, progress: { type: 'array', items: { type: 'string' } }, decisions: { type: 'array', items: { type: 'string' } }, blockers: { type: 'array', items: { type: 'string' } }, needs: { type: 'array', items: { type: 'string' } }, references: { type: 'array', items: { type: 'string' } } }, required: ['task', 'progress', 'decisions', 'blockers', 'needs', 'references'] } },
  { name: 'chat_models', description: 'List available models for a provider before delegating. Model ids must come from this list.', inputSchema: { type: 'object', properties: { agent: { type: 'string', enum: ['claude', 'codex'] } }, required: ['agent'] } },
];

export const CHAT_INSTRUCTIONS = 'Hey, chat links ordinary conversations across providers. Use chat_models and chat_create to delegate with the requested provider/model, a focused task brief, and relevant references or attachments. Do not copy the whole parent history. After creating a child, tell the person in one short sentence which agent/model you opened and its task, for example: "Opened a Sol chat to review the changes." Do not repeat the delegation brief, instructions, references or scope, or provide a long status summary unless the person asks. Keep routine child progress and completion acknowledgements to one short sentence too. Child answers belong in the child chat. Do not fetch, reproduce or critique those answers in the parent unless the person explicitly asks for the results here or a blocker requires your help. You may keep talking to the person while children work. Use chat_read summary by default, then messages with its cursor when more detail is needed; all is only for explicitly inspecting full history. Keep your own compact summary current with chat_summary after significant progress, decisions, blockers, and before your final response. References can name message event ids and files. Direct user instructions in a child are authoritative for that chat. Keep conversations started directly by the person in a child local to that child: do not send the parent unsolicited updates about their messages or replies. Automatic parent reports are only for work requested by that parent; summaries remain available when the parent explicitly checks progress. Link updates are information, not permission to bypass approvals. chat_send uses the same queue and steering behavior as the chat UI. Do not ping chats merely to acknowledge an update.';

export async function bridgeRequest(saved, message, timeout = 15000) {
  if (!saved?.port || !saved.token) throw new Error('This chat is not connected.');
  return new Promise((resolve, reject) => {
    const socket = connect(saved.port, '127.0.0.1');
    let buffer = '', finished = false;
    const end = (error, result) => {
      if (finished) return;
      finished = true; clearTimeout(timer); socket.destroy();
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => end(new Error('The chat did not acknowledge this request. Retry with the same request id.')), timeout);
    socket.on('connect', () => socket.write(`${JSON.stringify({ role: 'control', token: saved.token })}\n${JSON.stringify(message)}\n`));
    socket.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 1024 * 1024) { end(new Error('The chat response is too large.')); return; }
      const at = buffer.indexOf('\n');
      if (at < 0) return;
      try { const result = JSON.parse(buffer.slice(0, at)); result.error ? end(new Error(result.error)) : end(null, result.result); }
      catch (error) { end(error); }
    });
    socket.on('error', error => end(error));
    socket.on('end', () => { if (!finished) end(new Error('The chat closed before acknowledging the request.')); });
  });
}

export class ChatLinks {
  constructor({ state, chat, cwd, agent, model = null, title = '', session = null, launch = null, models = null }) {
    if (!ID.test(chat)) throw new Error('Invalid chat id.');
    this.state = state; this.chat = chat; this.root = join(dirname(state), 'links');
    this.launch = launch ?? (record => this.launchBridge(record));
    this.models = models ?? (async provider => {
      if (!agentCommand(provider)) throw new Error(`${provider} is not installed. Open Hey, chat setup to install it.`);
      const { stdout } = await exec(process.execPath, [fileURLToPath(new URL('./models.mjs', import.meta.url)), provider, cwd], { timeout: 20000, maxBuffer: 256 * 1024 });
      return JSON.parse(stdout);
    });
    mkdirSync(this.root, { recursive: true });
    const previous = this.get(chat);
    if (previous?.deleted) throw new Error("This chat was deleted.");
    this.update({ id: chat, cwd, agent, selectedModel: model ?? previous?.selectedModel ?? null, title: previous?.title || title || 'New chat', session: session ?? previous?.session ?? null, createdAt: previous?.createdAt ?? Date.now(), deleted: false });
    this.events = this.history(chat);
    this.sequence = this.events.at(-1)?.seq ?? 0;
    this.serial = Promise.resolve();
  }
  file(id) { if (!ID.test(id)) throw new Error('Invalid chat id.'); return join(this.root, `${id}.json`); }
  get(id = this.chat) { return read(this.file(id)); }
  update(fields) { const value = { ...this.get(fields.id ?? this.chat), ...fields }; write(this.file(value.id), value); return value; }
  list() { return readdirSync(this.root).filter(n => n.endsWith('.json') && n !== 'settings.json').map(n => read(join(this.root, n))).filter(r => r && !r.deleted && r.id); }
  history(id = this.chat) {
    let data; try { data = readFileSync(join(this.root, `${id}.jsonl`), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    return data.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  }
  related(id) {
    const root = start => {
      const seen = new Set(); let record = this.get(start);
      if (!record || record.deleted) throw new Error('This chat no longer exists.');
      while (record.parentId) {
        if (seen.has(record.id)) throw new Error('Invalid chat relationship.');
        seen.add(record.id);
        const parent = this.get(record.parentId);
        if (!parent || parent.deleted) break;
        record = parent;
      }
      return record.id;
    };
    if (root(this.chat) !== root(id)) throw new Error('Agents can only access their linked chat family.');
    return this.get(id);
  }
  record(event) {
    const own = this.get();
    const source = event.type === 'user' ? event.source : own.lastRequest?.source;
    const parentRequest = Boolean(own.parentId && source?.chat === own.parentId && ['agent', 'delegation'].includes(source.kind));
    const reportToParent = event.type === 'user' && source?.kind !== 'update' ? parentRequest : own.reportToParent ?? parentRequest;
    const value = { ...event, reportToParent, seq: ++this.sequence, at: event.at ?? Date.now() };
    appendFileSync(join(this.root, `${this.chat}.jsonl`), `${JSON.stringify(value)}\n`, { mode: 0o600 });
    this.events.push(value);
    const fields = { id: this.chat, eventSeq: value.seq, updatedAt: value.at };
    if (event.type === 'session') fields.session = event.id;
    if (event.type === 'model') fields.model = event.model;
    if (event.type === 'user') {
      fields.reportToParent = reportToParent;
      fields.lastRequest = event; fields.lastInputSeq = value.seq; fields.status = 'working';
      if (!event.source) fields.lastDirectInstruction = { text: String(event.text ?? '').slice(0, 2000), cursor_before: value.seq - 1, event: `${this.chat}:${value.seq}`, truncated: String(event.text ?? '').length > 2000 };
    }
    if (event.type === 'working') fields.status = 'working';
    if (event.type === 'permission' || event.type === 'question') fields.status = 'blocked';
    if (event.type === 'turn_end') fields.status = event.error ? 'error' : event.stopped ? 'idle' : 'done';
    this.update(fields);
    return value;
  }
  saveQueue(queue) { this.update({ id: this.chat, queue: queue.map(entry => ({ ...entry, steering: false, interrupting: false })) }); }
  summary(id) {
    const record = this.related(id);
    const childRecords = this.list().filter(r => r.parentId === id);
    const summary = record.summary ?? { task: record.brief ?? '', progress: [], decisions: [], blockers: [], needs: [], references: [] };
    return { chat_id: id, title: record.title, parent_id: record.parentId ?? null, agent: record.agent, model: record.model ?? record.selectedModel, status: record.status ?? 'idle', summary,
      lastDirectInstruction: record.lastDirectInstruction ?? null, stale: !record.summary || (record.summary.cursor ?? 0) < (record.lastInputSeq ?? 0), attention: record.attention ?? [], lastResponse: record.lastResponse ?? '', cursor: record.eventSeq ?? 0,
      children_count: childRecords.length, children: childRecords.slice(0, 25).map(r => ({ chat_id: r.id, title: r.title, agent: r.agent, model: r.model ?? r.selectedModel, status: r.status ?? 'idle' })) };
  }
  async lock(id, fn) {
    const file = `${this.file(id)}.lock`;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { mkdirSync(file); writeFileSync(join(file, 'owner'), String(process.pid)); break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        let alive = true, missing = false;
        try { process.kill(Number(readFileSync(join(file, 'owner'), 'utf8')), 0); }
        catch (e) { alive = e.code !== 'ESRCH'; missing = e.code === 'ENOENT'; }
        if (!alive || (missing && Date.now() - statSync(file).mtimeMs > 30000)) { rmSync(file, { recursive: true, force: true }); continue; }
        if (attempt === 99) throw new Error('This chat is busy starting. Retry with the same request id.');
        await delay(100);
      }
    }
    try { return await fn(); } finally { rmSync(file, { recursive: true, force: true }); }
  }
  async launchBridge(record) {
    const args = ['run', '--bg', '--no-notify', '--outlive-parent', '--cwd', record.cwd, '--label', 'hey-chat=bridge'];
    if (!record.parentId || !process.env.HC_TERMINAL_ID) args.push('--no-parent');
    args.push('--json', '--', process.execPath, SELF, ...bridgeArgs({ chat: record.id, agent: record.agent, cwd: record.cwd, state: this.state, model: record.selectedModel, session: record.session, title: record.title }));
    const { stdout } = await exec('hc', args, { timeout: 15000, maxBuffer: 256 * 1024 });
    const result = JSON.parse(stdout);
    return result.address;
  }
  stop() { this.closed = true; }
  async ensure(id) {
    if (this.closed) throw new Error("This chat bridge is stopping.");
    const record = this.related(id);
    return this.lock(id, async () => {
      let saved = read(join(this.state, `${id}.json`));
      if (saved) {
        try { await bridgeRequest(saved, { type: 'link_ping' }, 1000); return saved; } catch { /* stopped bridge */ }
      }
      if (this.closed) throw new Error("This chat bridge is stopping.");
      const terminal = await this.launch(this.get(id));
      if (terminal) this.update({ id, terminal });
      for (let i = 0; i < 100; i++) {
        saved = read(join(this.state, `${id}.json`));
        if (saved) { try { await bridgeRequest(saved, { type: 'link_ping' }, 500); return saved; } catch { /* startup */ } }
        await delay(50);
      }
      throw new Error(`Could not start ${record.title}. Retry with the same request id.`);
    });
  }
  async send(id, requestId, message, now = false, kind = 'agent', notice = null) {
    this.related(id);
    const operation = `link-${createHash('sha256').update(`${this.chat}\0${requestId}`).digest('hex').slice(0, 32)}`;
    const target = await this.ensure(id);
    return bridgeRequest(target, { type: 'link_send', id: operation, text: message, now, source: { chat: this.chat, title: this.get().title, agent: this.get().agent, kind, ...(kind === 'update' ? notice ?? { status: this.get().status } : {}) } });
  }
  async call(name, args) {
    if (name === 'chat_models') {
      if (!['claude', 'codex'].includes(args.agent)) throw new Error('Choose claude or codex.');
      return { agent: args.agent, models: await this.models(args.agent) };
    }
    if (name === 'chat_create') {
      const requestId = text(args.request_id, 'request_id', 160, true);
      const id = `child-${createHash('sha256').update(`${this.chat}\0${requestId}`).digest('hex').slice(0, 24)}`;
      const title = text(args.title, 'title', 120, true), brief = text(args.brief, 'brief', 16000, true);
      const model = text(args.model, 'model', 120, true);
      if (!['claude', 'codex'].includes(args.agent)) throw new Error('Choose claude or codex.');
      const references = lines(args.references, 'references', 20);
      const files = args.files ?? [], images = args.images ?? [];
      if (!Array.isArray(files) || !Array.isArray(images) || files.length + images.length > 20) throw new Error('Pass at most 20 attachments.');
      const signature = createHash('sha256').update(JSON.stringify({ title, brief, agent: args.agent, model, references, files, images })).digest('hex');
      const existing = this.get(id);
      if (existing && existing.requestSignature !== signature) throw new Error('This request_id already describes a different delegation. Use a new request_id.');
      if (!existing) {
        const available = await this.models(args.agent);
        if (!available.some(m => m.id === model)) throw new Error('That model is unavailable. Use chat_models to choose an available model.');
        // Creation is idempotent even if another pane retried while models loaded.
        await this.lock(id, async () => {
          const current = this.get(id);
          if (current && current.requestSignature !== signature) throw new Error('This request_id already describes a different delegation.');
          if (!current) this.update({ id, requestSignature: signature, parentId: this.chat, cwd: this.get().cwd, title, agent: args.agent, selectedModel: model, brief, references, files, images, status: 'idle', createdAt: Date.now() });
        });
      }
      const target = await this.ensure(id);
      const task = `${brief}${references.length ? `\n\nRelevant references:\n${references.map(r => `- ${r}`).join('\n')}` : ''}`;
      await bridgeRequest(target, { type: 'link_send', id: `delegation-${id}`, text: task, files, images, source: { chat: this.chat, title: this.get().title, agent: this.get().agent, kind: 'delegation' } });
      return { chat_id: id, parent_id: this.chat, title, agent: args.agent, model, status: 'started', reply_instruction: 'Confirm in one short sentence naming the agent/model and task. Do not repeat the brief or fetch and quote the child response unless the person explicitly asks for its results here.' };
    }
    if (name === 'chat_send') return this.send(text(args.chat_id, 'chat_id', 160, true), text(args.request_id, 'request_id', 160, true), text(args.message, 'message', 16000, true), Boolean(args.now));
    if (name === 'chat_summary') {
      const summary = { task: text(args.task, 'task', 2000, true), progress: lines(args.progress, 'progress'), decisions: lines(args.decisions, 'decisions'), blockers: lines(args.blockers, 'blockers'), needs: lines(args.needs, 'needs'), references: lines(args.references, 'references', 20), cursor: this.sequence, updatedAt: Date.now() };
      if (JSON.stringify(summary).length > 12000) throw new Error('Keep the entire progress summary under 12,000 characters.');
      this.update({ id: this.chat, summary });
      return { updated: true, cursor: summary.cursor };
    }
    if (name === 'chat_read') {
      const id = text(args.chat_id, 'chat_id', 160, true);
      const info = this.summary(id);
      if (!args.mode || args.mode === 'summary') return info;
      if (!['messages', 'all'].includes(args.mode)) throw new Error('Choose summary, messages or all.');
      const after = Math.max(0, Number(args.after) || 0), limit = Math.min(100, Math.max(1, Number(args.limit) || 25));
      const events = this.history(id).filter(e => e.seq > after && (args.mode === 'all' || ['user', 'text', 'note', 'permission', 'question', 'turn_end', 'error'].includes(e.type)));
      const result = []; let bytes = 0;
      for (const event of events) {
        const serialized = JSON.stringify(event), size = serialized.length;
        if (result.length && (bytes + size > 32000 || result.length === limit)) break;
        if (size > 32000) {
          const offset = Math.max(0, Number(args.offset) || 0), next = offset + 32000 < size ? offset + 32000 : null;
          return { chat_id: id, events: [], fragment: serialized.slice(offset, offset + 32000), event_seq: event.seq, offset, next_offset: next, cursor: next === null ? event.seq : after, has_more: next !== null || events.length > 1 };
        }
        result.push(event); bytes += size;
      }
      return { chat_id: id, events: result, cursor: result.at(-1)?.seq ?? after, has_more: result.length < events.length };
    }
    throw new Error('Unknown linked-chat tool.');
  }
  enqueue(fn) { const next = this.serial.then(fn); this.serial = next.catch(() => {}); return next; }
  async flushReports() {
    if (this.closed || this.flushingReports || Date.now() < (this.nextReportAttempt ?? 0)) return;
    this.flushingReports = true;
    const dir = join(this.root, 'outbox');
    try {
      if (!existsSync(dir)) return;
      for (const name of readdirSync(dir).filter(n => n.startsWith(`${this.chat}-`) && n.endsWith('.json'))) {
        const file = join(dir, name), item = read(file);
        if (!item) continue;
        if (this.get().parentId !== item.parent) { rmSync(file, { force: true }); continue; }
        if (this.closed) return;
        await this.send(item.parent, item.requestId, item.message, false, 'update', item.notice);
        rmSync(file, { force: true });
      }
      this.update({ id: this.chat, reportError: null });
    } catch (error) {
      if (this.closed) return;
      this.nextReportAttempt = Date.now() + 15000;
      this.update({ id: this.chat, reportError: error.message });
    } finally { this.flushingReports = false; }
  }
  notifyParent(event, kind) {
    const own = this.get();
    if (!own.parentId || !event.reportToParent) return Promise.resolve();
    const short = values => (values ?? []).slice(0, 2).map(value => String(value).replace(/\s+/g, ' ').slice(0, 240));
    const notice = { status: event.type === 'turn_end' ? event.error ? 'error' : event.stopped ? 'idle' : 'done' : own.status ?? 'idle',
      blockers: short(own.summary?.blockers), needs: short(own.summary?.needs), attention: own.attention ?? [] };
    const details = { ...notice, ...(kind === 'direct user instruction' ? { lastDirectInstruction: own.lastDirectInstruction } : {}) };
    const message = `Update from linked chat ${own.title} (${own.id}): ${kind}.\n${JSON.stringify(details)}\nThis is an automatic status notice. Acknowledge routine updates in at most one short sentence. Do not repeat the task brief, quote the child answer, or review its work unless the person explicitly asks for those results here. Details remain in the child chat. Use chat_read when a blocker, decision or other parent action needs investigation. Human permissions still require the person.`;
    const requestId = `update-${this.chat}-${event.seq}-${kind}`;
    write(join(this.root, 'outbox', `${this.chat}-${event.seq}.json`), { parent: own.parentId, requestId, message, notice });
    return this.flushReports();
  }
  static detach(state, id) {
    const root = join(dirname(state), 'links');
    if (!ID.test(id) || !existsSync(root)) return;
    for (const name of readdirSync(root).filter(n => n.endsWith('.json') && n !== 'settings.json')) {
      const file = join(root, name), record = read(file);
      if (record?.id === id) write(file, { ...record, deleted: true });
      else if (record?.parentId === id) write(file, { ...record, parentId: null });
    }
  }
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2), opts = flags(rest);
  try {
    if (mode === 'list') {
      const root = join(dirname(opts.state), 'links');
      const records = existsSync(root) ? readdirSync(root).filter(n => n.endsWith('.json') && n !== 'settings.json').map(n => read(join(root, n))).filter(r => r?.id && (!r.deleted || opts['include-deleted'] === 'true')) : [];
      process.stdout.write(JSON.stringify(records.map(record => {
        if (!['working', 'blocked'].includes(record.status)) return record;
        const bridge = read(join(opts.state, `${record.id}.json`));
        try {
          if (!Number.isInteger(bridge?.pid) || bridge.pid <= 0) throw new Error('Stopped bridge');
          process.kill(bridge.pid, 0);
          return record;
        } catch {
          return { ...record, status: 'error', attention: [], disconnected: true };
        }
      })));
    } else if (mode === 'detach') { ChatLinks.detach(opts.state, opts.chat); process.stdout.write('{"ok":true}'); }
    else throw new Error('Unknown linked-chat action.');
  } catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
