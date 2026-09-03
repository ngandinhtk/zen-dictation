export interface ReviewWord {
  word: string;
  mistakes: number;
  correctStreak: number;
  nextReviewAt: string;
  note?: string;
  lastMistakeAt?: string;
}

const REVIEW_KEY = 'zen-dictation-spaced-repetition';
const isDueNowReviewWord = (item: ReviewWord, now = Date.now()) => item.correctStreak < 4 || new Date(item.nextReviewAt).getTime() <= now;
const isActiveReviewWord = (item: ReviewWord) => item.mistakes > 0 && item.correctStreak <= 8;
const readReviews = (): ReviewWord[] => {
  try {
    const value = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isActiveReviewWord) : [];
  } catch {
    return [];
  }
};

const saveReviews = (reviews: ReviewWord[]) => localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews.filter(isActiveReviewWord).slice(-100)));
const normalizeWords = (value: string) => value.toLowerCase().match(/[a-z']+/g) || [];
const nextReviewDate = (correctStreak: number) => {
  const days = correctStreak >= 3 ? 7 : correctStreak === 2 ? 3 : 1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
};

export const recordWordAttempt = (target: string, input: string) => {
  const targetWords = normalizeWords(target);
  const inputWords = normalizeWords(input);
  const reviews = new Map(readReviews().map(item => [item.word, item]));
  targetWords.forEach((word, index) => {
    const existing = reviews.get(word);
    if (inputWords[index] === word) {
      if (!existing) return;
      existing.correctStreak += 1;
      if (existing.correctStreak > 8) {
        reviews.delete(word);
        return;
      }
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
  const reviews = readReviews();
  const existing = reviews.find(item => item.word === word);
  if (existing) {
    if (existing.correctStreak > 8) return getReviewWords();
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

export const updateReviewWord = (currentWord: string, value: string, note: string) => {
  const normalizedWords = normalizeWords(value.trim());
  if (normalizedWords.length !== 1 || normalizedWords[0] !== value.trim().toLowerCase()) return getReviewWords();

  const nextWord = normalizedWords[0];
  const reviews = readReviews();
  const existing = reviews.find(item => item.word === currentWord);
  const duplicate = reviews.some(item => item.word === nextWord && item.word !== currentWord);
  if (!existing || duplicate) return getReviewWords();

  existing.word = nextWord;
  existing.note = note.trim();
  saveReviews(reviews.sort((a, b) => b.mistakes - a.mistakes));
  return getReviewWords();
};

export const removeReviewWord = (word: string) => {
  saveReviews(readReviews().filter(item => item.word !== word));
  return getReviewWords();
};

export const getDueReviewWords = () => readReviews().filter(item => isDueNowReviewWord(item)).map(item => item.word);

export const getReviewWords = () => readReviews()
  .sort((a, b) => new Date(b.lastMistakeAt || b.nextReviewAt).getTime() - new Date(a.lastMistakeAt || a.nextReviewAt).getTime());

export const getReviewSummary = () => {
  const reviews = readReviews();
  return { total: reviews.length, due: getDueReviewWords().length };
};
