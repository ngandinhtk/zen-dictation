import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';

let now = 0;
let timerId = 0;
const timers = new Map();
const spoken = [];
const voice = { name: 'English', lang: 'en-US', default: true };
globalThis.window = {
  speechSynthesis: { getVoices: () => [voice], cancel() {}, resume() {}, speak: utterance => spoken.push(utterance) },
  setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
  clearTimeout: id => timers.delete(id),
};
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
const advance = milliseconds => {
  const end = now + milliseconds;
  while (true) {
    const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    timers.delete(next[0]);
    now = next[1].at;
    next[1].callback();
  }
  now = end;
};
const source = await readFile(new URL('../src/services/speechService.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { speechService } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
beforeEach(() => { speechService.stop(); timers.clear(); spoken.length = 0; now = 0; });

test('single read remains the default', () => {
  speechService.speak('Hello.', 'en-US');
  advance(50);
  assert.equal(spoken.length, 1);
  spoken[0].onend();
  advance(10_000);
  assert.equal(spoken.length, 1);
});

test('manual playback starts synchronously within the mobile tap gesture', () => {
  speechService.speak('Tap to listen.', 'en-US', 1, undefined, 2, 1000, true);
  assert.equal(spoken.length, 1, 'Speech must start before any timer runs');
  spoken[0].onend();
  advance(999);
  assert.equal(spoken.length, 1);
  advance(1);
  assert.equal(spoken.length, 2, 'Repeated reads retain the configured gap');
});

test('the Replay handler reaches speech without deferring through a timer', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const start = app.indexOf('  const handleSpeak = useCallback(');
  const end = app.indexOf('\n\n  useEffect(', start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpile(app.slice(start, end), { target: ts.ScriptTarget.ES2022 });
  const handler = new Function('useCallback', 'lesson', 'speechService', 'speakTimeoutRef', 'currentSentence', 'LANG', 'speed', 'selectedVoice', 'repeatCount', 'repeatGap', code + '\nreturn handleSpeak;')(
    callback => callback, null, speechService, { current: null }, 'Mobile sentence.', 'en-US', 1, '', 1, 1,
  );
  handler();
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'Mobile sentence.');
});

test('three reads wait one second after each completed utterance', () => {
  speechService.speak('Hello.', 'en-US', 0.75, 'English', 3);
  advance(50);
  advance(5_000);
  assert.equal(spoken.length, 1, 'Never overlap a read that has not ended');
  spoken[0].onend();
  advance(999);
  assert.equal(spoken.length, 1);
  advance(1);
  assert.equal(spoken.length, 2);
  assert.equal(spoken[1].rate, 0.75);
  spoken[1].onend();
  advance(1_000);
  assert.equal(spoken.length, 3);
  spoken[2].onend();
  advance(10_000);
  assert.equal(spoken.length, 3);
});

test('custom gap is respected', () => {
  speechService.speak('Hello.', 'en-US', 1, undefined, 2, 2000);
  advance(50);
  spoken[0].onend();
  advance(1999);
  assert.equal(spoken.length, 1);
  advance(1);
  assert.equal(spoken.length, 2);
});

test('stopping during the pause cancels the remaining reads', () => {
  speechService.speak('Old sentence.', 'en-US', 1, undefined, 5);
  advance(50);
  spoken[0].onend();
  speechService.stop();
  advance(10_000);
  assert.equal(spoken.length, 1);
});

test('a new sentence cancels pending repeats and ignores stale end events', () => {
  speechService.speak('Old sentence.', 'en-US', 1, undefined, 3);
  advance(50);
  const old = spoken[0];
  old.onend();
  speechService.speak('New sentence.', 'en-US');
  old.onend();
  advance(10_000);
  assert.deepEqual(spoken.map(item => item.text), ['Old sentence.', 'New sentence.']);
});
