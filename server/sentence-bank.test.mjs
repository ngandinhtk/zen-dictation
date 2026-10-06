import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const route = source.slice(source.indexOf("    if (url.pathname === '/api/sentences'"), source.indexOf("    if (url.pathname === '/api/premium/status'"));
const sendSource = source.slice(source.indexOf('const send ='), source.indexOf('const body ='));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const handle = new AsyncFunction('req', 'res', 'url', 'send', 'sentencePackCache', 'createHash', route);
const sendResponse = new Function('isProduction', 'process', 'gzipSync', `${sendSource}\nreturn send;`)(false, { env: {} }, gzipSync);

const run = async (query = '', ifNoneMatch = '', acceptEncoding = '') => {
  const sentences = [
    { id: 'core-easy-1', text: 'A short sentence.', difficulty: 'easy' },
    { id: 'core-easy-2', text: 'Another short sentence.', difficulty: 'easy' },
    { id: 'core-medium-1', text: 'A more advanced sentence.', difficulty: 'medium' },
  ];
  const responses = [];
  const sentencePackCache = new Map([
    ['core:easy', sentences.filter(sentence => sentence.difficulty === 'easy')],
    ['core:medium', sentences.filter(sentence => sentence.difficulty === 'medium')],
  ]);
  await handle(
    { method: 'GET', headers: { 'if-none-match': ifNoneMatch, 'accept-encoding': acceptEncoding } },
    {},
    new URL(`http://localhost/api/sentences${query}`),
    (_res, status, payload, headers) => { responses.push({ status, payload, headers }); },
    sentencePackCache,
    createHash,
  );
  return responses[0];
};

test('sentence packs return an ETag and a bounded public cache policy', async () => {
  const response = await run('?pack=core&difficulty=easy');
  assert.equal(response.status, 200);
  assert.equal(response.payload.sentences.length, 2);
  assert.match(response.headers.ETag, /^W\/"[a-f0-9]{64}"$/);
  assert.equal(response.headers['Cache-Control'], 'public, max-age=300, stale-while-revalidate=3600');
  assert.equal(response.headers.Vary, 'Origin, Accept-Encoding');
});

test('matching sentence pack ETags receive a not-modified response', async () => {
  const initial = await run('?pack=core&difficulty=easy');
  const cached = await run('?pack=core&difficulty=easy', initial.headers.ETag);
  assert.equal(cached.status, 304);
  assert.equal(cached.headers.ETag, initial.headers.ETag);
});

test('sentence response enables gzip when requested by the browser', async () => {
  const response = await run('?pack=core&difficulty=hard', '', 'gzip, br');
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Encoding'], 'gzip');
});

test('sentence response does not gzip when gzip is explicitly disabled', async () => {
  const response = await run('?pack=core&difficulty=easy', '', 'gzip;q=0, br');
  assert.equal(response.headers['Content-Encoding'], undefined);
});

test('send helper compresses sentence JSON and leaves not-modified responses empty', () => {
  let result;
  const response = { writeHead: (status, headers) => { result = { status, headers }; }, end: body => { result.body = body; } };
  sendResponse(response, 200, { sentences: ['a sentence'] }, { 'Content-Encoding': 'gzip' });
  assert.deepEqual(JSON.parse(gunzipSync(result.body).toString('utf8')), { sentences: ['a sentence'] });

  sendResponse(response, 304, {}, { ETag: 'W/"abc"' });
  assert.equal(result.status, 304);
  assert.equal(result.body, undefined);
});

test('all-level sentence requests combine only the requested pack', async () => {
  const response = await run('?pack=core');
  assert.equal(response.status, 200);
  assert.deepEqual(response.payload.sentences.map(sentence => sentence.difficulty), ['easy', 'easy', 'medium']);
});
