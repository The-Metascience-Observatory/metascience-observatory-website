import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCitationHtml, transformCitationHtmlToExplorer } from '../lib/citations';
import { POST } from '../app/api/subscribe/route';

test('citation metadata stays text and only HTTP(S) links are rendered', () => {
  const html = generateCitationHtml('<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '<svg/onload=alert(1)>', 'javascript:alert(1)');
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<svg'));
  assert.ok(!html.includes('<a'));
  assert.ok(html.includes('&lt;img'));
  for (const url of ['data:text/html,test', 'java\nscript:alert(1)', 'not a URL']) {
    assert.ok(!generateCitationHtml('Author', '', '', url).includes('<a'));
  }
});

test('citation links cannot break out of their attributes and DOI transformation preserves escaping', () => {
  const html = generateCitationHtml('One; Two; Three', 'Journal', 2026, 'http://doi.org/10.1234/test?x="&y=\'');
  assert.ok(html.includes('<i>et al.</i>'));
  assert.ok(html.includes('href="https://doi.org/'));
  assert.ok(html.includes('&amp;'));
  assert.ok(html.includes('%27'));
  assert.ok(html.includes('%22'));
  const transformed = transformCitationHtmlToExplorer(html);
  assert.ok(transformed.includes('/doi/10.1234/test'));
  assert.ok(!transformed.includes('y=\''));
});

test('newsletter rejects malformed bodies without calling Mailchimp', async () => {
  for (const body of ['null', '{', '[]', JSON.stringify({ email: 'a'.repeat(255) + '@example.org' })]) {
    const response = await POST(new Request('http://localhost/api/subscribe', { method: 'POST', body }));
    assert.equal(response.status, 400);
  }
});

test('newsletter does not disclose provider details or compliance status', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.MAILCHIMP_API_KEY;
  const oldList = process.env.MAILCHIMP_LIST_ID;
  const oldPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
  process.env.MAILCHIMP_API_KEY = 'test-us1';
  process.env.MAILCHIMP_LIST_ID = 'test-list';
  process.env.MAILCHIMP_SERVER_PREFIX = 'us1';
  try {
    for (const title of ['Member In Compliance State', 'Invalid Resource']) {
      globalThis.fetch = async () => Response.json({ title, detail: 'private provider details' }, { status: 400 });
      const response = await POST(new Request('http://localhost/api/subscribe', { method: 'POST', body: JSON.stringify({ email: 'test@example.org' }) }));
      const body = await response.json();
      assert.equal(body.detail, undefined);
      assert.equal(body.note, undefined);
      assert.equal(response.status, title === 'Member In Compliance State' ? 200 : 400);
    }
  } finally {
    globalThis.fetch = oldFetch;
    for (const [name, value] of Object.entries({ MAILCHIMP_API_KEY: oldKey, MAILCHIMP_LIST_ID: oldList, MAILCHIMP_SERVER_PREFIX: oldPrefix })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
