import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';

let now = 0;
let timerId = 0;
const timers = new Map();
const spoken = [];
let cancellations = 0;
const voice = { name: 'English', lang: 'en-US', default: true };
let availableVoices = [voice];
globalThis.window = {
  speechSynthesis: { getVoices: () => availableVoices, cancel() { cancellations++; }, resume() {}, speak: utterance => spoken.push(utterance) },
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
beforeEach(() => { speechService.stop(); timers.clear(); spoken.length = 0; now = 0; cancellations = 0; availableVoices = [voice]; });

test('starting an idle Android engine does not cancel it first', () => {
  speechService.speak('Hello.', 'en-US', 1, undefined, 1, 1000, true);
  assert.equal(cancellations, 0);
  assert.equal(spoken.length, 1);
});

test('Google US English is preferred over higher-scoring natural voices', () => {
  const google = { name: 'Google US English', lang: 'en-US' };
  availableVoices = [{ name: 'Google English Natural Premium', lang: 'en-US', default: true }, google];
  speechService.speak('Hello.', 'en-US', 1, undefined, 1, 1000, true);
  assert.equal(spoken[0].voice, google);
});

test('the default Google voice falls back when unavailable and is used once loaded', () => {
  speechService.speak('Hello.', 'en-US', 1, 'Google US English', 1, 1000, true);
  assert.equal(spoken[0].voice, voice);
  const google = { name: 'Google US English', lang: 'en-US' };
  availableVoices = [voice, google];
  speechService.speak('Hello again.', 'en-US', 1, 'Google US English', 1, 1000, true);
  assert.equal(spoken[1].voice, google);
});

test('an unavailable selected voice falls back once to the system voice', () => {
  speechService.speak('Hello.', 'en-US', 1, 'English', 2, 1000, true);
  const first = spoken[0];
  assert.equal(first.voice, voice);
  first.onerror({ error: 'voice-unavailable' });
  advance(150);
  assert.equal(spoken.length, 2);
  assert.equal(spoken[1].voice, undefined);
  first.onend();
  spoken[1].onstart();
  advance(1500);
  assert.equal(spoken.length, 2, 'Stale end event must not schedule another read');
  spoken[1].onend();
  advance(1000);
  assert.equal(spoken.length, 3);
});

test('a silent engine timeout reports actionable guidance', () => {
  speechService.speak('Hello.', 'en-US', 1, undefined, 1, 1000, true);
  advance(8000);
  assert.equal(speechService.getStatus(), 'loading', 'Try the system voice before reporting failure');
  advance(8150);
  assert.equal(speechService.getStatus(), 'error');
  assert.match(speechService.getErrorMessage(), /Speech did not start/);
  assert.equal(cancellations, 2);
});

test('Browser default voice stays unset across repeated reads', () => {
  speechService.speak('Hello.', 'en-US', 1, '', 2, 1000, true);
  assert.equal(spoken[0].voice, undefined);
  spoken[0].onend();
  advance(1000);
  assert.equal(spoken[1].voice, undefined);
});

test('unexpected mobile cancellation retries once and then reports failure', () => {
  speechService.speak('Hello.', 'en-US', 1, 'English', 1, 1000, true);
  spoken[0].onerror({ error: 'interrupted' });
  advance(150);
  assert.equal(spoken.length, 2);
  assert.equal(spoken[1].voice, undefined);
  spoken[1].onerror({ error: 'canceled' });
  advance(10000);
  assert.equal(spoken.length, 2);
  assert.equal(speechService.getStatus(), 'error');
});

test('changing sentences during recovery prevents the old sentence from replaying', () => {
  speechService.speak('Old sentence.', 'en-US', 1, '', 1, 1000, true);
  spoken[0].onerror({ error: 'interrupted' });
  speechService.stop();
  speechService.speak('New sentence.', 'en-US', 1, '', 1, 1000, true);
  spoken[1].onstart();
  advance(10000);
  assert.deepEqual(spoken.map(item => item.text), ['Old sentence.', 'New sentence.']);
});

test('voices that load after initialization are refreshed on the next tap', () => {
  const androidVoice = { name: 'Installed English', lang: 'en_US', localService: true };
  availableVoices = [androidVoice];
  speechService.speak('Hello.', 'en-US', 1, androidVoice.name, 1, 1000, true);
  assert.equal(spoken[0].voice, androidVoice);
  assert.equal(spoken[0].lang, 'en-US');
});

test('late pause and resume events from an old sentence cannot change current status', () => {
  speechService.speak('Old sentence.', 'en-US', 1, '', 1, 1000, true);
  const old = spoken[0];
  speechService.speak('New sentence.', 'en-US', 1, '', 1, 1000, true);
  spoken[1].onstart();
  old.onpause();
  assert.equal(speechService.getStatus(), 'speaking');
  speechService.stop();
  old.onresume();
  assert.equal(speechService.getStatus(), 'ready');
});

test('a blocked manual request offers Replay without asking to switch browsers', () => {
  speechService.speak('Hello.', 'en-US', 1, undefined, 1, 1000, true);
  spoken[0].onerror({ error: 'not-allowed' });
  assert.equal(speechService.getStatus(), 'error');
  assert.equal(speechService.getErrorMessage(), 'Tap Replay to start audio.');
  advance(10000);
  assert.equal(spoken.length, 1);
});

test('blocked automatic playback stays ready without showing an error', () => {
  speechService.speak('Hello.', 'en-US');
  advance(50);
  spoken[0].onerror({ error: 'not-allowed' });
  assert.equal(speechService.getStatus(), 'ready');
  assert.equal(speechService.getErrorMessage(), '');
  advance(10000);
  assert.equal(spoken.length, 1);
});

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
  const handler = new Function('useCallback', 'lesson', 'speechService', 'speakTimeoutRef', 'currentSentence', 'LANG', 'speed', 'selectedVoice', 'repeatCount', 'repeatGap', 'speechPlaybackRequestedRef', code + '\nreturn handleSpeak;')(
    callback => callback, null, speechService, { current: null }, 'Mobile sentence.', 'en-US', 1, '', 1, 1, { current: false },
  );
  handler();
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'Mobile sentence.');
});

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
test('opening the page on desktop waits for a playback gesture', () => {
  const start = appSource.indexOf('  useEffect(() => {\n    const stopPlayback');
  const end = appSource.indexOf('\n\n  useEffect(', start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpile(appSource.slice(start, end), { target: ts.ScriptTarget.ES2022 });
  const context = {
    useEffect: callback => callback(), speechService,
    speakTimeoutRef: { current: null }, speechPlaybackRequestedRef: { current: false },
    lesson: null, currentSentence: 'Opening sentence.', LANG: 'en-US', speed: 1,
    selectedVoice: 'Google US English', repeatCount: 1, repeatGap: 1,
    window: { ...window, matchMedia: () => ({ matches: false }) },
  };
  new Function('context', `const { ${Object.keys(context).join(', ')} } = context; ${code}`)(context);
  advance(20000);
  assert.equal(spoken.length, 0);
  assert.equal(speechService.getStatus(), 'ready');
  assert.equal(speechService.getErrorMessage(), '');
});

const nextStart = appSource.indexOf('  const handleNext = () =>');
const nextEnd = appSource.indexOf('  const handleDifficultyChange', nextStart);
const nextCode = ts.transpile(appSource.slice(nextStart, nextEnd), { target: ts.ScriptTarget.ES2022 });
const makeNextHandler = (overrides = {}) => {
  const updates = [];
  const context = {
    lesson: null, recordedAttemptRef: { current: true }, currentSentence: 'Old sentence.',
    clearActivePractice() {}, LAST_SENTENCE_KEY: 'last', lastAttempt: null,
    isCompleted: false, isAdaptiveMode: false, difficulty: 'easy', currentIndex: 0,
    practiceFocus: 'general', getNextSentenceIndex: () => 1,
    getSentencePool: () => ['Old sentence.', 'New sentence.'],
    resolvePracticeSentence: (pool, index, lesson) => lesson ? lesson.texts[lesson.index] : pool[index],
    timeLimit: 30, LANG: 'en-US', speed: 1, selectedVoice: '', repeatCount: 1, repeatGap: 1,
    speechService, window: { matchMedia: () => ({ matches: true }) },
    speechPlaybackRequestedRef: { current: false },
    // Simulate the sentence effect cleanup when React commits the new sentence.
    flushSync(update) { update(); speechService.stop(); },
    ...Object.fromEntries(['setLesson', 'setIsSentenceHidden', 'setDifficulty', 'setCurrentIndex', 'setIsCompleted', 'setIsTimeUp', 'resetStats', 'setKey'].map(name => [name, value => updates.push([name, value])])),
    ...overrides,
  };
  return {
    updates,
    handle: new Function('context', `const { ${Object.keys(context).join(', ')} } = context; ${nextCode}; return handleNext;`)(context),
  };
};

test('mobile Next commits the new sentence before synchronously playing it', () => {
  speechService.speak('Old sentence.', 'en-US', 1, '', 1, 1000, true);
  const { handle, updates } = makeNextHandler();
  handle();
  assert.ok(updates.some(([name, value]) => name === 'setCurrentIndex' && value === 1));
  assert.deepEqual(spoken.map(item => item.text), ['Old sentence.', 'New sentence.']);
  spoken[1].onstart();
  advance(10000);
  assert.equal(speechService.getStatus(), 'speaking');
});

test('mobile Next plays the next lesson sentence rather than a random sentence', () => {
  const { handle } = makeNextHandler({ lesson: { texts: ['Lesson one.', 'Lesson two.'], index: 0 } });
  handle();
  assert.equal(spoken[0].text, 'Lesson two.');
});

test('Next does not skip an unfinished lesson attempt', () => {
  const { handle, updates } = makeNextHandler({ lesson: { texts: ['One.', 'Two.'], index: 0 }, recordedAttemptRef: { current: false } });
  handle();
  assert.equal(updates.length, 0);
  assert.equal(spoken.length, 0);
});

test('desktop Next leaves playback to the existing sentence effect', () => {
  const { handle, updates } = makeNextHandler({ window: { matchMedia: () => ({ matches: false }) } });
  handle();
  assert.ok(updates.some(([name, value]) => name === 'setCurrentIndex' && value === 1));
  assert.equal(spoken.length, 0);
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
  advance(50);
  spoken[1].onstart();
  advance(10_000);
  assert.deepEqual(spoken.map(item => item.text), ['Old sentence.', 'New sentence.']);
});
