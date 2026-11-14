const RECENT_SENTENCES_KEY = 'zen-dictation-recent-sentences';
export const MAX_RECENT_SENTENCES = 40;

const normalizeSentence = (sentence: string) => sentence.trim().toLowerCase().replace(/\s+/g, ' ');

export const loadRecentSentenceHistory = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_SENTENCES_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((sentence): sentence is string => typeof sentence === 'string')
      .map(normalizeSentence)
      .filter(Boolean)
      .slice(-MAX_RECENT_SENTENCES);
  } catch {
    return [];
  }
};

export const rememberRecentSentence = (history: string[], sentence: string) => {
  const normalized = normalizeSentence(sentence);
  if (!normalized) return history;
  return [...history.filter(item => normalizeSentence(item) !== normalized), normalized].slice(-MAX_RECENT_SENTENCES);
};

export const saveRecentSentenceHistory = (history: string[]) => {
  try {
    localStorage.setItem(RECENT_SENTENCES_KEY, JSON.stringify(history.slice(-MAX_RECENT_SENTENCES)));
  } catch {
    // Sentence rotation still works for the current page when storage is unavailable.
  }
};

export const isRecentlyUsedSentence = (history: string[], sentence: string) => history.includes(normalizeSentence(sentence));

export const chooseRandomSentenceIndex = (
  sentences: string[],
  history: string[] = [],
  currentIndex?: number,
  random = Math.random,
) => {
  if (sentences.length < 2) return 0;
  const alternatives = sentences
    .map((_, index) => index)
    .filter(index => index !== currentIndex && !isRecentlyUsedSentence(history, sentences[index]));
  const available = alternatives.length
    ? alternatives
    : sentences.map((_, index) => index).filter(index => index !== currentIndex);
  if (!available.length) return 0;
  const randomIndex = Math.min(Math.floor(random() * available.length), available.length - 1);
  return available[Math.max(0, randomIndex)];
};
