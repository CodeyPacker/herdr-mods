import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { serve } from '../mods/hey-chat/bridge.mjs';
import { ChatLinks, bridgeRequest } from '../mods/hey-chat/chat-links.mjs';
import { splitSender } from '../mods/hey-chat/link-messages.js';
import { LINK_TOOL_NAMES } from '../mods/hey-chat/bridge-options.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await check(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 15)); }
  throw new Error('Linked-chat fixture did not settle.');
}
function callMcp(args, name, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '', stderr = '', done = false;
    const finish = (error, result) => {
      if (done) return; done = true; clearTimeout(timer); child.stdin.end(); child.kill();
      error ? reject(error) : resolve(result);
    };
    const send = value => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...value })}\n`);
    const timer = setTimeout(() => finish(new Error(`MCP fixture timeout: ${stderr}`)), 10000);
    child.on('error', error => finish(error));
    child.stderr.on('data', data => { stderr += data; });
    child.on('exit', code => { if (!done) finish(new Error(`MCP exited ${code}: ${stderr}`)); });
    child.stdout.on('data', data => {
      buffer += data;
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const message = JSON.parse(buffer.slice(0, at)); buffer = buffer.slice(at + 1);
        if (message.id === 1) send({ id: 2, method: 'tools/list', params: {} });
        else if (message.id === 2) {
          assert.ok(message.result.tools.some(tool => tool.name === name));
          send({ id: 3, method: 'tools/call', params: { name, arguments: arguments_ } });
        } else if (message.id === 3) {
          const text = message.result.content[0].text;
          message.result.isError ? finish(new Error(text)) : finish(null, JSON.parse(text));
        }
      }
    });
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 'fixture', version: '1' }, capabilities: {} } });
  });
}

async function fixture(t, rootAgent, childAgent) {
  const root = await mkdtemp(join(tmpdir(), 'hey-chat-linked-'));
  const state = join(root, 'bridges');
  const handles = [], processes = [], statuses = [], errors = [];
  const listModels = async agent => [{ id: `${agent}-fixture`, name: `${agent} fixture` }];
  const saved = async id => JSON.parse(await readFile(join(state, `${id}.json`), 'utf8'));
  const records = id => JSON.parse(requireRead(join(root, 'links', `${id}.json`)));
  const sockets = [];
  let dependencies;
  let heldExecutions = 0;
  const makeAgent = (agent, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.exitCode = null;
    const processInfo = { agent, args, messages: [], model: null };
    processes.push(processInfo);
    const emit = message => child.stdout.emit('data', `${JSON.stringify(message)}\n`);
    const mcpArgs = agent === 'claude' ? JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.heychat.args
      : JSON.parse(args.find(arg => arg.startsWith('mcp_servers.heychat.args=')).split('=').slice(1).join('='));
    const respond = async text => {
      processInfo.messages.push(text);
      const clean = splitSender(text).text;
      if (clean === 'Hold fixture' && ++heldExecutions === 1) return;
      try {
        if (clean === 'Ask permission') {
          if (agent === 'claude') {
            const result = await callMcp(mcpArgs, 'approve', { tool_name: 'Bash', input: { command: 'echo permission-fixture' }, tool_use_id: 'approval-fixture' });
            processInfo.permissionDecision = result.behavior;
          } else {
            await new Promise(resolve => {
              processInfo.finishPermission = resolve;
              emit({ id: 'approval-fixture', method: 'item/commandExecution/requestApproval', params: { command: 'echo permission-fixture' } });
            });
          }
        }
        if (clean.startsWith('Delegate fixture')) {
          if (agent === 'claude') {
            const input = { request_id: 'fixture-task' };
            const approval = await callMcp(mcpArgs, 'approve', { tool_name: 'mcp__heychat__chat_create', input });
            assert.equal(approval.behavior, 'allow');
            assert.deepEqual(approval.updatedInput, input);
          }
          const result = await callMcp(mcpArgs, 'chat_create', { request_id: 'fixture-task', title: 'Child fixture', agent: childAgent, model: `${childAgent}-fixture`, brief: 'Work on the linked fixture.', references: ['scope.md'] });
          processInfo.childId = result.chat_id;
        } else if (clean.startsWith('Work on the linked fixture.') || clean.startsWith('New decision')) {
          await callMcp(mcpArgs, 'chat_summary', { task: clean.startsWith('New decision') ? 'Follow the new user decision' : 'Work on the linked fixture', progress: ['Checked the fixture'], decisions: ['Reuse the ordinary chat'], blockers: [], needs: [], references: ['scope.md'] });
        }
        if (child.exitCode !== null) return;
        if (agent === 'claude') {
          emit({ type: 'assistant', message: { content: [{ type: 'text', text: 'Fixture response complete.' }] } });
          emit({ type: 'result', subtype: 'success' });
        } else {
          emit({ method: 'item/completed', params: { item: { id: `answer-${processInfo.messages.length}`, type: 'agentMessage', text: 'Fixture response complete.' } } });
          emit({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
        }
      } catch (error) { errors.push(error); }
    };
    child.stdin = { on() {}, write(line) {
      const message = JSON.parse(line);
      if (message.id === 'approval-fixture' && message.result) {
        processInfo.permissionDecision = message.result.decision;
        processInfo.finishPermission?.();
      }
      if (agent === 'claude') {
        if (message.type === 'user') {
          const content = message.message.content;
          void respond(typeof content === 'string' ? content : content.filter(c => c.type === 'text').map(c => c.text).join('\n'));
        }
      } else {
        if (message.method === 'initialize') queueMicrotask(() => emit({ id: message.id, result: {} }));
        if (message.method === 'thread/start' || message.method === 'thread/resume') {
          processInfo.model = message.params.model;
          queueMicrotask(() => emit({ id: message.id, result: { thread: { id: `thread-${processes.length}` }, model: message.params.model } }));
        }
        if (message.method === 'turn/start' || message.method === 'turn/steer') {
          queueMicrotask(() => emit({ id: message.id, result: { turn: { id: 'turn-fixture' } } }));
          void respond(message.params.input.filter(i => i.type === 'text').map(i => i.text).join('\n'));
        }
        if (message.method === 'turn/interrupt') {
          queueMicrotask(() => emit({ id: message.id, result: {} }));
          queueMicrotask(() => emit({ method: 'turn/completed', params: { turn: { status: 'interrupted' } } }));
        }
      }
    } };
    child.kill = () => { child.exitCode = 0; queueMicrotask(() => child.emit('exit', 0)); return true; };
    return child;
  };
  const start = async record => {
    const handle = serve({ state, chat: record.id, cwd: root, agent: record.agent, model: record.selectedModel, title: record.title, links: 'true' }, dependencies);
    handles.push(handle);
    if (!handle.server.listening) await once(handle.server, 'listening');
    return `fixture-${record.id}`;
  };
  dependencies = { listModels, launchBridge: start, spawnAgent: makeAgent, outputStatus: value => statuses.push(value), exit() {} };
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    for (const handle of handles.reverse()) await handle.close();
    await rm(root, { recursive: true, force: true });
  });

  await start({ id: 'parent', agent: rootAgent, selectedModel: `${rootAgent}-fixture`, title: 'Parent fixture' });
  const send = async (id, message) => {
    const address = await saved(id);
    const socket = connect(address.port, '127.0.0.1'); sockets.push(socket);
    socket.on('data', () => {});
    await once(socket, 'connect');
    socket.write(`${JSON.stringify({ role: 'pane', token: address.token })}\n${JSON.stringify(message)}\n`);
  };
  return { root, state, saved, records, processes, statuses, errors, send, handles,
    restartParent: async () => {
      await handles[0].close();
      return start(records('parent'));
    },
  };
}
import { readFileSync as requireRead, writeFileSync } from 'node:fs';

for (const rootAgent of ['claude', 'codex']) for (const childAgent of ['claude', 'codex']) {
  test(`${rootAgent} → ${childAgent}: delegate, summarize, converse and report using ordinary bridges`, { timeout: 15000 }, async t => {
    const f = await fixture(t, rootAgent, childAgent);
    await f.send('parent', { type: 'send', id: 'start-fixture', text: 'Delegate fixture' });
    const parent = await until(() => f.processes.find(p => p.childId));
    const childId = parent.childId;
    await until(() => f.records(childId).status === 'done' && f.processes[0].messages.some(text => text.startsWith('Update from linked chat')));
    assert.deepEqual(f.errors, []);
    const child = f.processes.find(p => p !== parent && p.agent === childAgent);
    assert.ok(child);
    for (const process of [parent, child]) {
      if (process.agent === 'claude') {
        const allowed = process.args.slice(process.args.indexOf('--allowedTools') + 1, process.args.indexOf('--append-system-prompt'));
        assert.deepEqual(allowed, ['mcp__heychat__plan', ...LINK_TOOL_NAMES.map(name => `mcp__heychat__${name}`)]);
      } else {
        const overrides = process.args.filter(arg => arg.includes('.approval_mode='));
        assert.deepEqual(overrides, LINK_TOOL_NAMES.map(name => `mcp_servers.heychat.tools.${name}.approval_mode="approve"`));
      }
    }
    assert.equal(f.records(childId).parentId, 'parent');
    assert.equal(f.records(childId).selectedModel, `${childAgent}-fixture`);
    if (childAgent === 'claude') assert.equal(child.args[child.args.indexOf('--model') + 1], 'claude-fixture');
    else assert.equal(child.model, 'codex-fixture');
    assert.ok(child.messages[0].includes('scope.md'));
    assert.ok(f.statuses.some(s => s.includes('state=working')));
    const info = await bridgeRequest(await f.saved('parent'), { type: 'link_tool', name: 'chat_read', arguments: { chat_id: childId } });
    assert.equal(info.summary.progress[0], 'Checked the fixture');
    assert.equal(info.events, undefined, 'summary checks never copy the transcript');
    const reportsBeforeDirect = f.processes[0].messages.length;
    await f.send(childId, { type: 'send', id: 'direct-message', text: 'New decision from the person' });
    await until(() => f.records(childId).summary?.task === 'Follow the new user decision');
    await until(() => f.records(childId).status === 'done');
    await bridgeRequest(await f.saved(childId), { type: 'link_tool', name: 'chat_read', arguments: { chat_id: childId } });
    assert.equal(f.processes[0].messages.length, reportsBeforeDirect, 'direct child conversations must stay quiet in the parent');
    await bridgeRequest(await f.saved('parent'), { type: 'link_tool', name: 'chat_send', arguments: { chat_id: childId, request_id: 'parent-follow-up', message: 'Work on the linked fixture. Again.' } });
    await until(() => f.processes[0].messages.length > reportsBeforeDirect);
    assert.deepEqual(f.errors, []);
    assert.ok(f.records(childId).lastDirectInstruction.text.includes('New decision'));
    const again = await bridgeRequest(await f.saved('parent'), { type: 'link_tool', name: 'chat_create', arguments: { request_id: 'fixture-task', title: 'Child fixture', agent: childAgent, model: `${childAgent}-fixture`, brief: 'Work on the linked fixture.', references: ['scope.md'] } });
    assert.equal(again.chat_id, childId);
    assert.equal(f.processes.filter(p => p !== parent).length, 1, 'retrying delegation cannot create another worker');
  });
}

for (const agent of ['claude', 'codex']) {
  test(`${agent}: interrupted work and queued messages recover without silently rerunning`, { timeout: 15000 }, async t => {
    const f = await fixture(t, agent, agent);
    await f.send('parent', { type: 'send', id: 'original-work', text: 'Hold fixture' });
    await until(() => f.processes[0]?.messages.includes('Hold fixture'));
    await f.send('parent', { type: 'send', id: 'queued-work', text: 'Queued fixture' });
    await until(() => f.records('parent').queue?.length === 1);
    // A crash after recording delivery can leave the old queue snapshot on disk.
    const snapshot = f.records('parent');
    snapshot.queue.unshift({ id: 'original-work', text: 'Hold fixture', images: [], files: [] });
    writeFileSync(join(f.root, 'links', 'parent.json'), JSON.stringify(snapshot));
    await f.restartParent();
    await until(() => f.records('parent').status === 'error');
    assert.equal(f.processes.length, 1, 'recovering the bridge must not rerun the agent');
    const events = requireRead(join(f.root, 'links', 'parent.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const failure = events.findLast(e => e.type === 'turn_end' && e.retry);
    assert.equal(failure.retry.text, 'Hold fixture');
    assert.equal(f.records('parent').queue[0].id, 'queued-work');
    await f.send('parent', { type: 'retry_turn', id: failure.retry.id });
    await until(() => f.records('parent').queue?.length === 0 && f.records('parent').status === 'done');
    assert.equal(f.processes[1].messages.filter(text => text === 'Hold fixture').length, 1);
    assert.equal(f.processes[1].messages.filter(text => text === 'Queued fixture').length, 1);
    assert.deepEqual(f.errors, []);
  });

  test(`${agent}: a parent sees a child's approval request but cannot approve through chat messages`, { timeout: 15000 }, async t => {
    const f = await fixture(t, 'codex', agent);
    const child = await bridgeRequest(await f.saved('parent'), { type: 'link_tool', name: 'chat_create', arguments: {
      request_id: 'approval-task', title: 'Approval child', agent, model: `${agent}-fixture`, brief: 'Ask permission',
    } });
    await until(() => f.records(child.chat_id).status === 'blocked');
    const info = await bridgeRequest(await f.saved('parent'), { type: 'link_tool', name: 'chat_read', arguments: { chat_id: child.chat_id } });
    assert.equal(info.attention[0].kind, 'permission');
    await bridgeRequest(await f.saved('parent'), { type: 'link_tool', name: 'chat_send', arguments: {
      chat_id: child.chat_id, request_id: 'not-human-approval', message: 'Permission granted',
    } });
    assert.equal(f.records(child.chat_id).status, 'blocked');
    const worker = f.processes.find(p => p.messages.some(text => text.startsWith('Ask permission')));
    assert.equal(worker.permissionDecision, undefined);
    await f.send(child.chat_id, { type: 'decide', id: info.attention[0].id, behavior: 'allow', always: false });
    await until(() => worker.permissionDecision);
    assert.ok(['allow', 'accept'].includes(worker.permissionDecision));
    await until(() => f.records(child.chat_id).status === 'done');
    assert.deepEqual(f.errors, []);
  });
}
