import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

const [serviceSource, textUtilsSource] = await Promise.all([
  readFile(new URL('../src/services/spacedRepetitionService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/utils/textUtils.ts', import.meta.url), 'utf8'),
]);
const textUtilsJavascript = ts.transpile(textUtilsSource, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const textUtilsUrl = `data:text/javascript;base64,${Buffer.from(textUtilsJavascript).toString('base64')}`;
const serviceJavascript = ts.transpile(serviceSource.replace("../utils/textUtils", textUtilsUrl), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
const { getReviewWords, replaceReviewWords, saveReviewNoteForAttempt, saveReviewWordNotes } = await import(`data:text/javascript;base64,${Buffer.from(serviceJavascript).toString('base64')}`);

test('saving a note adds a missed word to the review list with its note', () => {
  storage.clear();
  saveReviewNoteForAttempt('I enjoy reading books', 'I enjoy books', 'Remember this word');

  assert.deepEqual(getReviewWords().map(({ word, note }) => ({ word, note })), [
    { word: 'reading', note: 'Remember this word' },
  ]);
});

test('saving a note does not add words that were typed correctly', () => {
  storage.clear();
  saveReviewNoteForAttempt('I enjoy reading books', 'I enjoy books', 'Review the missing word');

  assert.equal(getReviewWords().some(item => item.word === 'books'), false);
});

test('a note can be saved to multiple comma-separated review words', () => {
  storage.clear();
  saveReviewWordNotes('serendipity, eloquent, concise', 'A useful word to remember');

  assert.deepEqual(getReviewWords().map(({ word, note }) => ({ word, note })).sort((a, b) => a.word.localeCompare(b.word)), [
    { word: 'concise', note: 'A useful word to remember' },
    { word: 'eloquent', note: 'A useful word to remember' },
    { word: 'serendipity', note: 'A useful word to remember' },
  ]);
});

test('an invalid comma-separated list is not partially saved', () => {
  storage.clear();
  saveReviewWordNotes('valid, not-a-word', 'A note');

  assert.deepEqual(getReviewWords(), []);
});

test('saving a note to an existing word preserves review progress', () => {
  storage.clear();
  replaceReviewWords([{ word: 'hello', mistakes: 3, correctStreak: 1, nextReviewAt: '2026-11-16T00:00:00.000Z', note: 'Existing note' }]);
  saveReviewWordNotes('hello, world', 'Updated note');

  const [hello] = getReviewWords().filter(item => item.word === 'hello');
  assert.equal(hello.mistakes, 3);
  assert.equal(hello.correctStreak, 1);
  assert.equal(hello.note, 'Updated note');
});

test('review words are returned newest first', () => {
  storage.clear();
  replaceReviewWords([
    { word: 'older', mistakes: 4, correctStreak: 0, nextReviewAt: '2026-11-10T00:00:00.000Z', lastMistakeAt: '2026-11-10T00:00:00.000Z' },
    { word: 'newer', mistakes: 1, correctStreak: 0, nextReviewAt: '2026-11-15T00:00:00.000Z', lastMistakeAt: '2026-11-15T00:00:00.000Z' },
  ]);

  assert.deepEqual(getReviewWords().map(({ word }) => word), ['newer', 'older']);
});
