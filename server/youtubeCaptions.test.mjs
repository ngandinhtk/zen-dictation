import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimedCaptions } from './youtubeCaptions.mjs';

const json = cues => JSON.stringify({ events: cues.map(([start, duration, text]) => ({ tStartMs: start * 1000, dDurationMs: duration * 1000, segs: [{ utf8: text }] })) });

test('joins caption fragments into sentences while preserving playback boundaries', () => {
  assert.deepEqual(parseTimedCaptions(json([[1, 2, 'Hello'], [3, 2, 'world.'], [6, 2, 'Next sentence!']])) , [
    { text: 'Hello world.', start: 1, end: 5 },
    { text: 'Next sentence!', start: 6, end: 8 },
  ]);
});

test('caps overlapping captions at the next caption start', () => {
  assert.deepEqual(parseTimedCaptions(json([[1, 5, 'One.'], [3, 2, 'Two.']])) , [
    { text: 'One.', start: 1, end: 3 }, { text: 'Two.', start: 3, end: 5 },
  ]);
});

test('splits unpunctuated speech at pauses and maximum duration', () => {
  assert.deepEqual(parseTimedCaptions(json([[0, 8, 'first'], [8, 8, 'second'], [20, 1, 'third']])) , [
    { text: 'first', start: 0, end: 8 }, { text: 'second', start: 8, end: 16 }, { text: 'third', start: 20, end: 21 },
  ]);
});

test('supports XML timestamps and decodes caption entities', () => {
  assert.deepEqual(parseTimedCaptions('<transcript><text start="2.5" dur="1.25">It&#39;s &amp; &quot;fine.&quot;</text></transcript>'), [
    { text: 'It\'s & "fine."', start: 2.5, end: 3.75 },
  ]);
});

test('ignores empty and invalid timed events instead of inventing playback times', () => {
  assert.deepEqual(parseTimedCaptions(json([[0, 1, '\n'], [-1, 1, 'bad'], [2, 0, 'bad'], [3, 1, 'Valid.']])) , [
    { text: 'Valid.', start: 3, end: 4 },
  ]);
  assert.deepEqual(parseTimedCaptions('<text>Untimed text</text>'), []);
  assert.deepEqual(parseTimedCaptions('{}'), []);
});

test('supports original srv3 captions with millisecond timestamps', () => {
  assert.deepEqual(parseTimedCaptions('<timedtext><body><p t="2500" d="1250"><s>Hello </s><s>world.</s></p></body></timedtext>'), [
    { text: 'Hello world.', start: 2.5, end: 3.75 },
  ]);
});
