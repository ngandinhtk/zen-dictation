import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAccountLearningState } from './learningStateMerge.mjs';

test('learning-state writes merge progress from simultaneous devices', () => {
  const current = {
    review_words: [{ word: 'example', mistakes: 2, correctStreak: 1, nextReviewAt: '2026-11-17T00:00:00.000Z', note: 'local note' }],
    points: 15,
    daily_target: { date: '2026-11-16', target: 5, progress: 2, rewardPoints: 3, completed: false, rewardClaimed: false },
    goal_wpm: 40,
    learner_level: 'beginner',
    coach_state: {
      attempts: [{
        text: 'A short sentence.',
        focus: 'mixed',
        difficulty: 'easy',
        accuracy: 80,
        date: '2026-11-15T10:00:00.000Z',
        errors: 2,
      }],
      reviews: [{
        text: 'A short sentence.',
        focus: 'mixed',
        difficulty: 'easy',
        nextReviewAt: '2026-11-16T10:00:00.000Z',
        streak: 0,
      }],
    },
    practice_notes: [{ sentence: 'A short sentence.', note: 'Check the article.', createdAt: '2026-11-15T10:00:00.000Z' }],
  };
  const incoming = {
    reviewWords: [{ word: 'Example', mistakes: 3, correctStreak: 2, nextReviewAt: '2026-11-18T00:00:00.000Z', note: '' }],
    points: 20,
    dailyTarget: { date: '2026-11-16', target: 5, progress: 4, rewardPoints: 6, completed: false, rewardClaimed: false },
    goalWpm: 50,
    learnerLevel: 'intermediate',
    coachState: {
      attempts: [
        {
          text: 'A short sentence.',
          focus: 'mixed',
          difficulty: 'easy',
          accuracy: 100,
          date: '2026-11-16T10:00:00.000Z',
          errors: 0,
        },
        {
          text: 'A short sentence.',
          focus: 'mixed',
          difficulty: 'easy',
          accuracy: 100,
          date: '2026-11-16T10:00:00.000Z',
          errors: 0,
        },
      ],
      reviews: [{
        text: 'A short sentence.',
        focus: 'mixed',
        difficulty: 'easy',
        nextReviewAt: '2026-11-19T10:00:00.000Z',
        streak: 1,
      }],
    },
    practiceNotes: [{ sentence: 'Another sentence.', note: 'Listen for the ending.', createdAt: '2026-11-16T10:00:00.000Z' }],
  };

  const merged = mergeAccountLearningState(current, incoming);

  assert.equal(merged.reviewWords.length, 1);
  assert.equal(merged.reviewWords[0].mistakes, 3);
  assert.equal(merged.reviewWords[0].note, 'local note');
  assert.equal(merged.points, 20);
  assert.equal(merged.dailyTarget.progress, 4);
  assert.equal(merged.goalWpm, 50);
  assert.equal(merged.learnerLevel, 'intermediate');
  assert.equal(merged.coachState.attempts.length, 2);
  assert.equal(merged.coachState.reviews[0].streak, 1);
  assert.equal(merged.practiceNotes.length, 2);
});

test('missing profiles and notes preserve the previously synced values', () => {
  const existing = {
    learner_level: 'advanced',
    practice_notes: [{ sentence: 'Keep me.', note: 'Existing note.', createdAt: '2026-11-15T10:00:00.000Z' }],
  };

  const merged = mergeAccountLearningState(existing, {});

  assert.equal(merged.learnerLevel, 'advanced');
  assert.deepEqual(merged.practiceNotes, existing.practice_notes);
});

test('review-word progress follows the latest mistake while keeping newly added words', () => {
  const merged = mergeAccountLearningState({
    learner_level: 'invalid',
    points: 'invalid',
    review_words: [
      { word: 'example', mistakes: 2, correctStreak: 4, nextReviewAt: '2026-11-25T00:00:00.000Z', lastMistakeAt: '2026-11-10T00:00:00.000Z' },
      ...Array.from({ length: 99 }, (_, index) => ({
        word: `word${index}`,
        mistakes: 1,
        correctStreak: 0,
        nextReviewAt: '2026-11-12T00:00:00.000Z',
        lastMistakeAt: '2026-11-12T00:00:00.000Z',
      })),
    ],
  }, {
    points: 'not-a-number',
    reviewWords: [
      { word: 'example', mistakes: 3, correctStreak: 0, nextReviewAt: '2026-11-16T00:00:00.000Z', lastMistakeAt: '2026-11-16T00:00:00.000Z' },
      { word: 'newest', mistakes: 1, correctStreak: 0, nextReviewAt: '2026-11-17T00:00:00.000Z', lastMistakeAt: '2026-11-17T00:00:00.000Z' },
    ],
  });

  assert.equal(merged.learnerLevel, 'beginner');
  assert.equal(merged.points, 0);
  assert.equal(merged.reviewWords.length, 100);
  assert.equal(merged.reviewWords[0].word, 'newest');
  assert.equal(merged.reviewWords.find(word => word.word === 'example').correctStreak, 0);
});
