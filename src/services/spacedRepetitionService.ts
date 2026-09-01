interface ReviewWord {
  word: string;
  mistakes: number;
  correctStreak: number;
  nextReviewAt: string;
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
  const reviews = new Map(readReviews().map(item => [item.word, item]));
  targetWords.forEach((word, index) => {
    const existing = reviews.get(word) || { word, mistakes: 0, correctStreak: 0, nextReviewAt: new Date().toISOString() };
    if (inputWords[index] === word) {
      existing.correctStreak += 1;
      existing.nextReviewAt = nextReviewDate(existing.correctStreak);
    } else {
      existing.mistakes += 1;
      existing.correctStreak = 0;
      existing.nextReviewAt = new Date().toISOString();
    }
    reviews.set(word, existing);
  });
  saveReviews([...reviews.values()].sort((a, b) => b.mistakes - a.mistakes));
};

export const getDueReviewWords = () => readReviews().filter(item => new Date(item.nextReviewAt).getTime() <= Date.now()).map(item => item.word);

export const getReviewSummary = () => {
  const reviews = readReviews();
  return { total: reviews.length, due: getDueReviewWords().length };
};
