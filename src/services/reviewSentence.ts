import type { Difficulty } from '../utils/sentenceTranslations';

interface ReviewSentenceCandidate<Focus extends string> {
  focus: Focus;
  difficulty: Difficulty;
  sentences: string[];
}

export const findReviewSentence = <Focus extends string>(word: string, candidates: ReviewSentenceCandidate<Focus>[]) => {
  const normalizedWord = word.trim().toLowerCase();
  if (!normalizedWord) return null;

  for (const candidate of candidates) {
    const index = candidate.sentences.findIndex(sentence => {
      const tokens: string[] = sentence.toLowerCase().match(/[a-z']+/g) || [];
      return tokens.some(token => token === normalizedWord);
    });
    if (index >= 0) return { focus: candidate.focus, difficulty: candidate.difficulty, index };
  }
  return null;
};
