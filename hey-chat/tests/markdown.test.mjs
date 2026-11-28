import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod } from './support/mod.mjs';

const { messageMarkdown } = await mod('markdown.js');

test('inline code contrasts with custom message text in either theme', () => {
  const source = 'Run `hello()` now.';
  for (const [foreground, background] of [['#16161a', '#e8e8ec'], ['#ffffff', '#303038']]) {
    const view = messageMarkdown('message', source, foreground);
    assert.equal(view.foreground, foreground);
    assert.deepEqual(view.highlights, [{ start: 5, end: 12, color: background }]);
  }
});

test('code highlights handle multiple backticks and leave fenced syntax colors alone', () => {
  const source = 'Use ``a ` b``.\n```js\nconst x = `hello`;\n```\nThen `done`.\n~~~\n`hidden`\n~~~';
  const view = messageMarkdown('message', source, '#16161a');
  assert.deepEqual(view.highlights.map(({ start, end }) => source.slice(start, end)), ['a ` b', 'done']);
  assert.equal(Object.hasOwn(messageMarkdown('unfinished', '```js\n`hidden`', '#16161a'), 'highlights'), false);
});
