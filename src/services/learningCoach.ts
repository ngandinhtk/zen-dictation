import type { Difficulty } from '../utils/sentenceTranslations';

export type LearningFocus = 'mixed' | 'vocabulary' | 'ielts' | 'business';
export interface LearningAttempt {
  text: string;
  focus: LearningFocus;
  difficulty: Difficulty;
  accuracy: number;
  date: string;
  errors: number;
}
export interface SentenceReview {
  text: string;
  focus: LearningFocus;
  difficulty: Difficulty;
  nextReviewAt: string;
  streak: number;
}
export interface LearningState { attempts: LearningAttempt[]; reviews: SentenceReview[] }
const KEY = 'zen-dictation-learning-coach:v1';
export const readLearningState = (): LearningState => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(value?.attempts) && Array.isArray(value?.reviews)) return value;
  } catch { /* Local storage may be unavailable. */ }
  return { attempts: [], reviews: [] };
};
export const clearLearningState = () => { try { localStorage.removeItem(KEY); } catch { /* Best effort. */ } };
export const applyLearningAttempt = (state: LearningState, attempt: LearningAttempt): LearningState => {
  const reviews = state.reviews.filter(item => !(item.text === attempt.text && item.focus === attempt.focus && item.difficulty === attempt.difficulty));
  const previous = state.reviews.find(item => item.text === attempt.text && item.focus === attempt.focus && item.difficulty === attempt.difficulty);
  if (attempt.errors > 0 || previous) {
    const streak = attempt.errors > 0 ? 0 : (previous?.streak || 0) + 1;
    const days = streak === 0 ? 1 : streak === 1 ? 3 : streak === 2 ? 7 : 14;
    reviews.push({ text: attempt.text, focus: attempt.focus, difficulty: attempt.difficulty, streak,
      nextReviewAt: new Date(new Date(attempt.date).getTime() + days * 86400000).toISOString() });
  }
  return { attempts: [attempt, ...state.attempts].slice(0, 2000), reviews: reviews.slice(-300) };
};
export const recordLearningAttempt = (attempt: LearningAttempt) => {
  const next = applyLearningAttempt(readLearningState(), attempt);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Practice works without persistence. */ }
  return next;
};
export const buildDailyLesson = (pool: string[], reviews: SentenceReview[], focus: LearningFocus, difficulty: Difficulty, now = Date.now(), attempts: LearningAttempt[] = [], weakWords: string[] = []) => {
  const dueReviews = reviews.filter(item => item.focus === focus && item.difficulty === difficulty && Date.parse(item.nextReviewAt) <= now && pool.includes(item.text))
    .sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt)).map(item => item.text);
  const due = dueReviews.slice(0, 2);
  const fresh = [...new Set(pool)].filter(text => !dueReviews.includes(text));
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  const seen = new Set(attempts.filter(item => item.focus === focus && item.difficulty === difficulty).map(item => item.text));
  const score = (text: string) => (seen.has(text) ? 0 : 2) + (text.toLowerCase().match(/[a-z']+/g) || []).filter(word => weakWords.includes(word)).length;
  fresh.sort((a, b) => score(b) - score(a));
  return [...due, ...fresh.slice(0, 5 - due.length)];
};
export const getWeeklyReport = (attempts: LearningAttempt[], focus: LearningFocus, difficulty: Difficulty, now = Date.now()) => {
  const matching = attempts.filter(item => item.focus === focus && item.difficulty === difficulty);
  const current = matching.filter(item => Date.parse(item.date) <= now && Date.parse(item.date) > now - 7 * 86400000);
  const previous = matching.filter(item => Date.parse(item.date) <= now - 7 * 86400000 && Date.parse(item.date) > now - 14 * 86400000);
  const mean = (items: LearningAttempt[]) => items.reduce((sum, item) => sum + item.accuracy, 0) / items.length;
  const errors = (items: LearningAttempt[]) => items.reduce((sum, item) => sum + item.errors, 0) / items.length;
  return { count: current.length, accuracy: current.length ? Math.round(mean(current)) : null,
    change: current.length && previous.length ? Math.round(mean(current) - mean(previous)) : null,
    errorChange: current.length && previous.length ? Math.round((errors(previous) - errors(current)) * 10) / 10 : null,
    mastered: new Set(current.filter(item => item.errors === 0).map(item => item.text)).size };
};
export const LEARNING_PATHS: { focus: LearningFocus; name: string; description: string }[] = [
  { focus: 'mixed', name: 'Everyday listening', description: 'Build confidence with everyday sentences.' },
  { focus: 'vocabulary', name: 'Vocabulary builder', description: 'Practise spelling and recognise words in context.' },
  { focus: 'business', name: 'English at work', description: 'Practise meetings, reports and professional communication.' },
  { focus: 'ielts', name: 'IELTS listening', description: 'Practise academic topics and longer sentence structures.' },
];
