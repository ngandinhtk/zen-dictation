import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchYoutubeTranscript, getYoutubeVideoId } from './youtubeTranscript.mjs';

const url = 'https://www.youtube.com/watch?v=Z5sjzG4ZF_w';
const page = () => new Response(JSON.stringify({ captionTracks: [{ languageCode: 'en', baseUrl: 'https://www.youtube.com/api/timedtext?v=Z5sjzG4ZF_w' }] }));
const captions = () => new Response(JSON.stringify({ events: [{ tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: 'Hello world.' }] }] }));

test('accepts YouTube links and rejects lookalike hosts', () => {
  assert.equal(getYoutubeVideoId(url), 'Z5sjzG4ZF_w');
  assert.equal(getYoutubeVideoId('https://youtu.be/Z5sjzG4ZF_w?t=5'), 'Z5sjzG4ZF_w');
  assert.equal(getYoutubeVideoId('https://notyoutube.com/watch?v=Z5sjzG4ZF_w'), '');
});

test('retries a temporary timeout and returns timed captions', async () => {
  let calls = 0;
  const result = await fetchYoutubeTranscript(url, { fetchImpl: async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    calls++;
    if (calls === 1) throw new DOMException('timed out', 'TimeoutError');
    return calls === 2 ? page() : captions();
  } });
  assert.equal(calls, 3);
  assert.deepEqual(result.captions, [{ text: 'Hello world.', start: 1, end: 3 }]);
});

test('reports the video-opening stage when both attempts time out', async () => {
  let calls = 0;
  await assert.rejects(fetchYoutubeTranscript(url, { fetchImpl: async () => {
    calls++; throw new DOMException('timed out', 'TimeoutError');
  } }), error => error.status === 504 && error.code === 'YOUTUBE_TIMEOUT' && error.message.includes('mở video'));
  assert.equal(calls, 2);
});

test('also handles a timeout while reading the caption response body', async () => {
  let calls = 0;
  await assert.rejects(fetchYoutubeTranscript(url, { fetchImpl: async () => {
    calls++;
    return calls === 1 ? page() : { ok: true, status: 200, text: async () => { throw new DOMException('timed out', 'TimeoutError'); } };
  } }), error => error.code === 'YOUTUBE_TIMEOUT' && error.message.includes('tải phụ đề'));
  assert.equal(calls, 3);
});

test('does not retry rate limits or claim a blocked video has no captions', async () => {
  let calls = 0;
  await assert.rejects(fetchYoutubeTranscript(url, { fetchImpl: async () => {
    calls++; return new Response('', { status: 429 });
  } }), { code: 'YOUTUBE_BLOCKED' });
  assert.equal(calls, 1);
});

test('retries upstream server errors once', async () => {
  let calls = 0;
  const result = await fetchYoutubeTranscript(url, { fetchImpl: async () => {
    calls++;
    return calls === 1 ? new Response('', { status: 503 }) : calls === 2 ? page() : captions();
  } });
  assert.equal(result.segments[0], 'Hello world.');
  assert.equal(calls, 3);
});

test('respects the total deadline without starting another request', async () => {
  await assert.rejects(fetchYoutubeTranscript(url, { totalTimeoutMs: 0, fetchImpl: async () => {
    assert.fail('must not fetch after deadline');
  } }), { code: 'YOUTUBE_TIMEOUT' });
});

test('distinguishes network connection failures from timeouts', async () => {
  await assert.rejects(fetchYoutubeTranscript(url, { fetchImpl: async () => { throw new TypeError('fetch failed'); } }), { code: 'YOUTUBE_NETWORK' });
});

test('falls back to the original caption format when json3 is empty', async () => {
  let calls = 0;
  const result = await fetchYoutubeTranscript(url, { fetchImpl: async requestUrl => {
    calls++;
    if (calls === 1) return page();
    if (new URL(requestUrl).searchParams.get('fmt') === 'json3') return new Response('');
    return new Response('<text start="1" dur="2">Hello world.</text>');
  } });
  assert.equal(calls, 3);
  assert.equal(result.captions[0].start, 1);
});

test('distinguishes empty upstream responses from a missing caption track', async () => {
  let calls = 0;
  await assert.rejects(fetchYoutubeTranscript(url, { fetchImpl: async () => ++calls === 1 ? page() : new Response('') }), { code: 'EMPTY_CAPTIONS', status: 502 });
});
