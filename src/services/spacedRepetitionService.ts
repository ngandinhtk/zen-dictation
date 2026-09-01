export interface ReviewWord {
  word: string;
  mistakes: number;
  correctStreak: number;
  nextReviewAt: string;
  note?: string;
  lastMistakeAt?: string;
}

const REVIEW_KEY = 'zen-dictation-spaced-repetition';
const readReviews = (): ReviewWord[] => {
  try {
    const value = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const saveReviews = (reviews: ReviewWord[]) => localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews.slice(-100)));
const normalizeWords = (value: string) => value.toLowerCase().match(/[a-z']+/g) || [];
const nextReviewDate = (correctStreak: number) => {
  const days = correctStreak >= 3 ? 7 : correctStreak === 2 ? 3 : 1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
};

export const recordWordAttempt = (target: string, input: string) => {
  const targetWords = normalizeWords(target);
  const inputWords = normalizeWords(input);
  const reviews = new Map(readReviews().filter(item => item.mistakes > 0).map(item => [item.word, item]));
  targetWords.forEach((word, index) => {
    const existing = reviews.get(word);
    if (inputWords[index] === word) {
      if (!existing) return;
      existing.correctStreak += 1;
      existing.nextReviewAt = nextReviewDate(existing.correctStreak);
    } else {
      const review = existing || { word, mistakes: 0, correctStreak: 0, nextReviewAt: new Date().toISOString() };
      review.mistakes += 1;
      review.correctStreak = 0;
      review.nextReviewAt = new Date().toISOString();
      review.lastMistakeAt = review.nextReviewAt;
      reviews.set(word, review);
    }
  });
  saveReviews([...reviews.values()].sort((a, b) => b.mistakes - a.mistakes));
};

export const saveReviewNoteForAttempt = (target: string, input: string, note: string) => {
  const cleanNote = note.trim();
  if (!cleanNote) return;
  const targetWords = normalizeWords(target);
  const inputWords = normalizeWords(input);
  const reviews = readReviews();
  targetWords.forEach((word, index) => {
    if (inputWords[index] === word) return;
    const existing = reviews.find(item => item.word === word);
    if (existing && existing.mistakes > 0) existing.note = cleanNote;
  });
  saveReviews(reviews.sort((a, b) => b.mistakes - a.mistakes));
};

export const addReviewWord = (value: string) => {
  const normalizedWords = normalizeWords(value.trim());
  if (normalizedWords.length !== 1 || normalizedWords[0] !== value.trim().toLowerCase()) return readReviews();

  const word = normalizedWords[0];
  const reviews = readReviews().filter(item => item.mistakes > 0);
  const existing = reviews.find(item => item.word === word);
  if (existing) {
    existing.mistakes = Math.max(existing.mistakes, 1);
    existing.correctStreak = 0;
    existing.nextReviewAt = new Date().toISOString();
    existing.lastMistakeAt = existing.nextReviewAt;
  } else {
    const now = new Date().toISOString();
    reviews.push({ word, mistakes: 1, correctStreak: 0, nextReviewAt: now, lastMistakeAt: now });
  }
  saveReviews(reviews.sort((a, b) => b.mistakes - a.mistakes));
  return getReviewWords();
};

export const getDueReviewWords = () => readReviews().filter(item => item.mistakes > 0 && new Date(item.nextReviewAt).getTime() <= Date.now()).map(item => item.word);

export const getReviewWords = () => readReviews()
  .filter(item => item.mistakes > 0)
  .sort((a, b) => new Date(b.lastMistakeAt || b.nextReviewAt).getTime() - new Date(a.lastMistakeAt || a.nextReviewAt).getTime());

export const getReviewSummary = () => {
  const reviews = readReviews().filter(item => item.mistakes > 0);
  return { total: reviews.length, due: getDueReviewWords().length };
};
