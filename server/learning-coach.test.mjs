import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const load = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
const { analyzeAttempt, getWordAlignment } = await load('../src/utils/textUtils.ts');
const { applyLearningAttempt, buildDailyLesson, getWeeklyReport } = await load('../src/services/learningCoach.ts');
const now = Date.parse('2026-10-11T08:00:00Z');
const attempt = { text: 'The train is late.', focus: 'mixed', difficulty: 'easy', accuracy: 70, errors: 1, date: new Date(now).toISOString() };

test('a missing word does not mark all later words as incorrect', () => {
  const result = analyzeAttempt('The train is late.', 'The is late.');
  assert.deepEqual(result.missingWords, ['train']);
  assert.deepEqual(result.incorrectWords, []);
  assert.deepEqual(getWordAlignment(['the', 'train', 'is', 'late'], ['the', 'is', 'late']).correctTargetIndices, [0, 2, 3]);
});
test('substitutions, missing words and extra words are separate', () => {
  assert.deepEqual(analyzeAttempt('The train is late.', 'The trian is late.').incorrectWords, [{ actual: 'trian', expected: 'train' }]);
  assert.deepEqual(analyzeAttempt('The train is late.', 'The big train is late.').extraWords, ['big']);
  assert.deepEqual(analyzeAttempt('The train is late.', '').missingWords, ['the', 'train', 'is', 'late']);
});
test('failed sentences return in one day and successful reviews extend the interval', () => {
  const initial = { attempts: [], reviews: [] };
  const failed = applyLearningAttempt(initial, attempt);
  assert.equal(Date.parse(failed.reviews[0].nextReviewAt), now + 86400000);
  assert.equal(initial.reviews.length, 0);
  const passed = applyLearningAttempt(failed, { ...attempt, accuracy: 100, errors: 0 });
  assert.equal(passed.reviews.length, 1);
  assert.equal(passed.reviews[0].streak, 1);
  assert.equal(Date.parse(passed.reviews[0].nextReviewAt), now + 3 * 86400000);
  const again = applyLearningAttempt(passed, attempt);
  assert.equal(again.reviews[0].streak, 0);
});
test('new perfect sentences do not enter the failed-sentence review queue', () => {
  assert.equal(applyLearningAttempt({ attempts: [], reviews: [] }, { ...attempt, errors: 0, accuracy: 100 }).reviews.length, 0);
});
test('daily lessons include at most two due reviews and have no duplicates', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  const reviews = ['a', 'b', 'c'].map(text => ({ ...attempt, text, streak: 0, nextReviewAt: new Date(now - 1).toISOString() }));
  const lesson = buildDailyLesson(pool, reviews, 'mixed', 'easy', now);
  assert.equal(lesson.length, 5);
  assert.deepEqual(lesson.slice(0, 2), ['a', 'b']);
  assert.equal(new Set(lesson).size, 5);
});
test('daily lesson prioritises unseen sentences and words needing practice', () => {
  const lesson = buildDailyLesson(['old', 'new', 'train'], [], 'mixed', 'easy', now, [{ ...attempt, text: 'old' }], ['train']);
  assert.equal(lesson[0], 'train');
  assert.equal(lesson.at(-1), 'old');
});
test('daily lessons exclude wrong-goal, future and unavailable reviews', () => {
  const reviews = [
    { ...attempt, text: 'missing', streak: 0, nextReviewAt: new Date(now - 1).toISOString() },
    { ...attempt, text: 'only', focus: 'business', streak: 0, nextReviewAt: new Date(now - 1).toISOString() },
    { ...attempt, text: 'only', difficulty: 'hard', streak: 0, nextReviewAt: new Date(now - 1).toISOString() },
    { ...attempt, text: 'only', streak: 0, nextReviewAt: new Date(now + 86400000).toISOString() },
  ];
  assert.deepEqual(buildDailyLesson(['only'], reviews, 'mixed', 'easy', now), ['only']);
  assert.deepEqual(buildDailyLesson([], reviews, 'mixed', 'easy', now), []);
});

test('later review intervals are seven and fourteen days', () => {
  let state = applyLearningAttempt({ attempts: [], reviews: [] }, attempt);
  for (const days of [3, 7, 14]) {
    state = applyLearningAttempt(state, { ...attempt, errors: 0, accuracy: 100 });
    assert.equal(Date.parse(state.reviews[0].nextReviewAt), now + days * 86400000);
  }
});
test('weekly comparisons use the same goal and difficulty and count unique mastered sentences', () => {
  const history = [
    { ...attempt, accuracy: 90, errors: 0 }, { ...attempt, accuracy: 100, errors: 0 },
    { ...attempt, accuracy: 60, errors: 2, date: new Date(now - 8 * 86400000).toISOString() },
    { ...attempt, difficulty: 'hard', accuracy: 0 }, { ...attempt, focus: 'business', accuracy: 0 },
  ];
  assert.deepEqual(getWeeklyReport(history, 'mixed', 'easy', now), { count: 2, accuracy: 95, change: 35, errorChange: 2, mastered: 1 });
  assert.equal(getWeeklyReport([], 'mixed', 'easy', now).accuracy, null);
  assert.equal(getWeeklyReport([attempt], 'mixed', 'easy', now).change, null);
});
