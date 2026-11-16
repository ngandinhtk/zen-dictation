const difficulties = new Set(['easy', 'medium', 'hard']);
const focuses = new Set(['mixed', 'vocabulary', 'idioms', 'ielts', 'business']);
const learnerLevels = new Set(['beginner', 'intermediate', 'advanced']);
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const dateValue = value => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const sentenceKey = item => JSON.stringify([item.text, item.focus, item.difficulty]);

const normalizeAttempts = value => (Array.isArray(value) ? value : []).filter(item =>
  isRecord(item)
  && typeof item.text === 'string'
  && item.text.length <= 2000
  && focuses.has(item.focus)
  && difficulties.has(item.difficulty)
  && Number.isFinite(item.accuracy)
  && item.accuracy >= 0
  && item.accuracy <= 100
  && typeof item.date === 'string'
  && Number.isFinite(Date.parse(item.date))
  && Number.isFinite(item.errors)
  && item.errors >= 0
).map(item => ({
  text: item.text,
  focus: item.focus,
  difficulty: item.difficulty,
  accuracy: Math.round(item.accuracy),
  date: item.date,
  errors: Math.round(item.errors),
}));

const normalizeReviews = value => (Array.isArray(value) ? value : []).filter(item =>
  isRecord(item)
  && typeof item.text === 'string'
  && item.text.length <= 2000
  && focuses.has(item.focus)
  && difficulties.has(item.difficulty)
  && typeof item.nextReviewAt === 'string'
  && Number.isFinite(Date.parse(item.nextReviewAt))
  && Number.isFinite(item.streak)
  && item.streak >= 0
).map(item => ({
  text: item.text,
  focus: item.focus,
  difficulty: item.difficulty,
  nextReviewAt: item.nextReviewAt,
  streak: Math.round(item.streak),
}));

const mergeCoachStates = (current, incoming) => {
  const currentAttempts = normalizeAttempts(current?.attempts);
  const incomingAttempts = normalizeAttempts(incoming?.attempts);
  const attemptsByKey = new Map();
  for (const attempt of [...currentAttempts, ...incomingAttempts]) {
    const key = JSON.stringify([attempt.text, attempt.focus, attempt.difficulty, attempt.date]);
    if (!attemptsByKey.has(key)) attemptsByKey.set(key, attempt);
  }
  const attempts = [...attemptsByKey.values()]
    .sort((a, b) => dateValue(a.date) - dateValue(b.date))
    .slice(-2000);
  const reviewsByKey = new Map();
  const sources = [
    { attempts: currentAttempts, reviews: normalizeReviews(current?.reviews) },
    { attempts: incomingAttempts, reviews: normalizeReviews(incoming?.reviews) },
  ];
  for (const source of sources) {
    const latestAttempt = new Map();
    for (const attempt of source.attempts) {
      const key = sentenceKey(attempt);
      latestAttempt.set(key, Math.max(latestAttempt.get(key) || 0, dateValue(attempt.date)));
    }
    for (const review of source.reviews) {
      const key = sentenceKey(review);
      const candidate = { review, attemptDate: latestAttempt.get(key) || 0 };
      const previous = reviewsByKey.get(key);
      if (!previous
        || candidate.attemptDate > previous.attemptDate
        || (candidate.attemptDate === previous.attemptDate
          && (review.streak > previous.review.streak
            || (review.streak === previous.review.streak
              && dateValue(review.nextReviewAt) > dateValue(previous.review.nextReviewAt))))) {
        reviewsByKey.set(key, candidate);
      }
    }
  }
  const reviews = [...reviewsByKey.values()]
    .map(({ review }) => review)
    .sort((a, b) => dateValue(a.nextReviewAt) - dateValue(b.nextReviewAt))
    .slice(-300);
  return { attempts, reviews };
};

const normalizePracticeNotes = value => (Array.isArray(value) ? value : []).filter(note =>
  isRecord(note)
  && typeof note.sentence === 'string'
  && note.sentence.length <= 2000
  && typeof note.note === 'string'
  && note.note.length <= 5000
  && typeof note.createdAt === 'string'
  && Number.isFinite(Date.parse(note.createdAt))
).map(note => ({ sentence: note.sentence, note: note.note, createdAt: note.createdAt }));

const mergePracticeNotes = (current, incoming) => {
  const notesByKey = new Map();
  for (const note of [...normalizePracticeNotes(current), ...normalizePracticeNotes(incoming)]) {
    notesByKey.set(JSON.stringify([note.sentence.trim().toLowerCase(), note.createdAt]), note);
  }
  return [...notesByKey.values()]
    .sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt))
    .slice(-200);
};

const normalizeReviewWords = value => (Array.isArray(value) ? value : []).filter(item =>
  isRecord(item)
  && typeof item.word === 'string'
  && item.word.trim().length > 0
  && item.word.length <= 200
).slice(0, 100);

const mergeReviewWords = (current, incoming) => {
  const merged = new Map();
  for (const item of [...normalizeReviewWords(current), ...normalizeReviewWords(incoming)]) {
    const key = item.word.trim().toLowerCase();
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, item);
      continue;
    }
    const nextMistakeAt = dateValue(item.lastMistakeAt || '');
    const previousMistakeAt = dateValue(previous.lastMistakeAt || '');
    const itemHasNewerProgress = nextMistakeAt > previousMistakeAt
      || (nextMistakeAt === previousMistakeAt
        && (Number(item.correctStreak) > Number(previous.correctStreak)
          || (Number(item.correctStreak) === Number(previous.correctStreak)
            && dateValue(item.nextReviewAt || '') > dateValue(previous.nextReviewAt || ''))));
    const progress = itemHasNewerProgress ? item : previous;
    merged.set(key, {
      ...previous,
      ...item,
      word: previous.word,
      mistakes: Math.max(Number(previous.mistakes) || 0, Number(item.mistakes) || 0),
      correctStreak: Number(progress.correctStreak) || 0,
      nextReviewAt: progress.nextReviewAt,
      note: item.note || previous.note,
      lastMistakeAt: progress.lastMistakeAt,
    });
  }
  return [...merged.values()]
    .sort((a, b) => dateValue(b.lastMistakeAt || b.nextReviewAt || '') - dateValue(a.lastMistakeAt || a.nextReviewAt || ''))
    .slice(0, 100);
};

const mergeDailyTarget = (current, incoming) => {
  if (!isRecord(incoming)) return isRecord(current) ? current : null;
  if (!isRecord(current)) return incoming;
  if (typeof current.date !== 'string') return incoming;
  if (typeof incoming.date !== 'string') return current;
  if (current.date !== incoming.date) return incoming.date > current.date ? incoming : current;
  return {
    ...current,
    ...incoming,
    progress: Math.max(Number(current.progress) || 0, Number(incoming.progress) || 0),
    rewardPoints: Math.max(Number(current.rewardPoints) || 0, Number(incoming.rewardPoints) || 0),
    completed: Boolean(current.completed || incoming.completed),
    rewardClaimed: Boolean(current.rewardClaimed || incoming.rewardClaimed),
  };
};

export const mergeAccountLearningState = (current, incoming) => {
  const currentRow = isRecord(current) ? current : {};
  const payload = isRecord(incoming) ? incoming : {};
  const currentCoach = currentRow.coach_state;
  const incomingCoach = isRecord(payload.coachState) ? payload.coachState : null;
  const currentLevel = learnerLevels.has(currentRow.learner_level) ? currentRow.learner_level : 'beginner';
  const level = learnerLevels.has(payload.learnerLevel) ? payload.learnerLevel : currentLevel;
  const goalCandidate = Number(payload.goalWpm);
  const currentGoal = Number(currentRow.goal_wpm);
  const incomingPoints = Number(payload.points);
  const currentPoints = Number(currentRow.points);
  const goalWpm = Number.isFinite(goalCandidate) && goalCandidate >= 10 && goalCandidate <= 200
    ? Math.round(goalCandidate)
    : Number.isFinite(currentGoal) && currentGoal >= 10 && currentGoal <= 200
      ? currentGoal
      : 40;
  return {
    reviewWords: mergeReviewWords(currentRow.review_words, payload.reviewWords),
    points: Math.max(0, Math.round(Math.max(Number.isFinite(currentPoints) ? currentPoints : 0, Number.isFinite(incomingPoints) ? incomingPoints : 0))),
    dailyTarget: mergeDailyTarget(currentRow.daily_target, payload.dailyTarget),
    goalWpm,
    learnerLevel: level,
    coachState: mergeCoachStates(currentCoach, incomingCoach),
    practiceNotes: mergePracticeNotes(currentRow.practice_notes, payload.practiceNotes),
  };
};
