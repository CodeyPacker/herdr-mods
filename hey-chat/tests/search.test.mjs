import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markedText, markedMarkdown } from '../mods/hey-chat/search.js';

test('search marks literal case-insensitive terms and escapes message HTML', () => {
  assert.equal(markedText('One ONE one', 'one'), '<u>One</u> <u>ONE</u> <u>one</u>');
  assert.equal(markedText('a+b <img>', 'a+b'), '<u>a+b</u> &lt;img&gt;');
  assert.equal(markedText('<script>', '<script>'), '<u>&lt;script&gt;</u>');
  assert.equal(markedText('Hello', '  '), 'Hello');
});

test('Markdown underlines preserve link destinations, code contents, and original messages', () => {
  const text = '**Review** [Review](https://example.com/Review) `Review`\n\n```txt\nReview <tag>\n```';
  const highlighted = markedMarkdown(text, 'review');
  assert.ok(highlighted.includes('**<u>Review</u>**'));
  assert.ok(highlighted.includes('[<u>Review</u>](https://example.com/Review)'));
  assert.ok(highlighted.includes('<code><u>Review</u></code>'));
  assert.ok(highlighted.includes('<pre><code><u>Review</u> &lt;tag&gt;\n</code></pre>'));
  assert.equal(markedMarkdown(text, ''), text);
  assert.equal(markedMarkdown(text, 'missing'), text);
});
