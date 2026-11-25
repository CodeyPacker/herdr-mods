import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SESSIONS = fileURLToPath(new URL('../mods/hey-chat/sessions.mjs', import.meta.url));

/** A fake home with Claude's sessions folder, and a quick chat folder with a file in it. */
function setup() {
  const home = mkdtempSync(join(tmpdir(), 'hc-quick-'));
  const projects = join(home, '.claude', 'projects');
  const quick = join(home, 'data', 'hey-chat', 'quick', 'qabc1');
  const mine = join(projects, 'C--x-data-hey-chat-quick-qabc1');
  const other = join(projects, 'C--x-personal-herdr-mods');
  for (const d of [quick, mine, other]) mkdirSync(d, { recursive: true });
  writeFileSync(join(quick, 'notes.txt'), 'x');
  writeFileSync(join(mine, '11111111-2222-3333-4444-555555555555.jsonl'), '{}');
  writeFileSync(join(other, 'keep.jsonl'), '{}');
  const forget = (folder) => spawnSync(process.execPath, [SESSIONS, 'forget', '--folder', folder, '--state', join(home, 'bridges'), '--chats', '[]'],
    { env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8' });
  return { home, quick, mine, other, forget };
}

test('forget removes the quick folder and its Claude sessions, and nothing else', () => {
  const s = setup();
  const r = s.forget(s.quick);
  assert.equal(JSON.parse(r.stdout).ok, true);
  assert.equal(existsSync(s.quick), false);
  assert.equal(existsSync(s.mine), false);
  assert.equal(existsSync(join(s.other, 'keep.jsonl')), true, 'other projects stay');
});

test('forget refuses a folder that is not a quick chat folder', () => {
  const s = setup();
  const r = s.forget(s.other);
  assert.equal(JSON.parse(r.stdout).ok, false);
  assert.equal(existsSync(join(s.other, 'keep.jsonl')), true);
});

test('the quick chat trash closes its own tab, and never a project chat tab', async () => {
  const { view, fake } = await import('./support/mod.mjs');
  const closed = [];
  const tabs = [{ id: 'quick', name: 'Chat · Quick' }, { id: 'project', name: 'Chat · herdr-mods' }];
  let focusedPane = 'pq';
  fake('herdr', {
    focused: () => ({ pane: focusedPane }),
    panes: () => [{ pane: 'pq', tab: 'quick', mod: 'hey-chat' }, { pane: 'pp', tab: 'project', mod: 'hey-chat' }],
    spaces: () => [{ id: 's', tabs }],
    run: (name, args) => { if (name === 'tab.close') closed.push(args.id); },
  });
  const v = await view({ quick: true, folder: '/q' });
  v.closeQuick();
  assert.deepEqual(closed, ['quick']);
  const other = await view({ quick: true, folder: '/q' });
  focusedPane = 'pp';
  other.closeQuick();
  assert.deepEqual(closed, ['quick'], 'a project tab is left alone');
});
