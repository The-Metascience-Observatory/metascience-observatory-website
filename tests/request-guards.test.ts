import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { clientKey, createRateLimiter, readLimitedBody, RequestError } from '../lib/request-guards';
import { POST as subscribe } from '../app/api/subscribe/route';
import { POST as upload } from '../app/api/upload-bibliography/route';

test('rate limits isolate clients, expire, and do not evict blocked clients at capacity', () => {
  const limit = createRateLimiter(2, 1000, 2);
  assert.equal(limit('a', 0), null);
  assert.equal(limit('a', 0), null);
  const blocked = limit('a', 0)!;
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '1');
  assert.equal(limit('b', 0), null);
  assert.equal(limit('c', 0)!.status, 429);
  assert.equal(limit('a', 0)!.status, 429);
  assert.equal(limit('a', 1000), null);
});

test('untrusted forwarding headers cannot change standalone client keys', () => {
  const previous = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    const request = new Request('http://localhost', { headers: { 'x-forwarded-for': '192.0.2.1' } });
    assert.equal(clientKey(request), 'unknown');
    process.env.VERCEL = '1';
    assert.notEqual(clientKey(request), 'unknown');
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-forwarded-for': 'spoofed, 192.0.2.1' } })), 'unknown');
  } finally {
    if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
  }
});

test('body cap rejects declared and actual oversize bodies, including dishonest lengths', async () => {
  for (const length of [undefined, '1', '100']) {
    const headers = length ? { 'content-length': length } : undefined;
    await assert.rejects(readLimitedBody(new Request('http://localhost', { method: 'POST', headers, body: '12345' }), 4),
      (error: unknown) => error instanceof RequestError && error.status === 413);
  }
  const bounded = await readLimitedBody(new Request('http://localhost', { method: 'POST', body: '1234' }), 4);
  assert.equal(await bounded.text(), '1234');
});

test('oversize chunked bodies are cancelled before parsing', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(3)); },
    cancel() { cancelled = true; },
  });
  const options: RequestInit & { duplex: string } = { method: 'POST', body, duplex: 'half' };
  await assert.rejects(readLimitedBody(new Request('http://localhost', options), 4));
  assert.equal(cancelled, true);
});

test('newsletter rejects large bodies and limits repeated requests before contacting Mailchimp', async () => {
  assert.equal((await subscribe(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(4097) }))).status, 413);
  for (let i = 0; i < 9; i++) {
    assert.equal((await subscribe(new Request('http://localhost', { method: 'POST', body: '{}' }))).status, 400);
  }
  assert.equal((await subscribe(new Request('http://localhost', { method: 'POST', body: '{}' }))).status, 429);
});

test('upload handles normal files, malformed input, file/body limits, and repeated requests', async () => {
  const request = (body: BodyInit) => new NextRequest('http://localhost', { method: 'POST', body });
  const file = (text: string, name = 'references.bib') => {
    const data = new FormData();
    data.set('file', new Blob([text]), name);
    return data;
  };
  const normal = await upload(request(file('@article{test, title={Example}}')));
  assert.equal(normal.status, 200);
  assert.equal((await normal.json()).totalDois, 0);
  const withDoi = await upload(request(file('@article{test, doi={10.1234/test}}')));
  assert.equal(withDoi.status, 200);
  assert.equal((await withDoi.json()).totalDois, 1);
  assert.equal((await upload(request(file('x'.repeat(2 * 1024 * 1024 + 1))))).status, 413);
  assert.equal((await upload(request('x'.repeat(2 * 1024 * 1024 + 65537)))).status, 413);
  const textField = new FormData();
  textField.set('file', 'not a file');
  assert.equal((await upload(request(textField))).status, 400);
  for (let i = 0; i < 5; i++) assert.equal((await upload(request('invalid multipart'))).status, 400);
  const blocked = await upload(request(file('')));
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.has('Retry-After'));
});
