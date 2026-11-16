import type { Difficulty } from '../utils/sentenceTranslations';

export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';

export const LEARNER_LEVEL_DIFFICULTY: Record<LearnerLevel, Difficulty> = {
  beginner: 'easy',
  intermediate: 'medium',
  advanced: 'hard',
};

const LEARNER_LEVEL_STORAGE_KEY = 'zen-dictation-learner-level:v1';
const DIFFICULTY_LEARNER_LEVEL: Record<Difficulty, LearnerLevel> = {
  easy: 'beginner',
  medium: 'intermediate',
  hard: 'advanced',
};

export const isLearnerLevel = (value: unknown): value is LearnerLevel =>
  value === 'beginner' || value === 'intermediate' || value === 'advanced';

export const getLearnerLevel = (fallbackDifficulty: Difficulty = 'easy'): LearnerLevel => {
  try {
    const storedLevel = localStorage.getItem(LEARNER_LEVEL_STORAGE_KEY);
    if (isLearnerLevel(storedLevel)) return storedLevel;
  } catch (error) {
    console.error('Unable to read learner level preference:', error);
  }
  return DIFFICULTY_LEARNER_LEVEL[fallbackDifficulty];
};

export const saveLearnerLevel = (level: LearnerLevel): boolean => {
  if (!isLearnerLevel(level)) {
    console.error('Invalid learner level preference:', level);
    return false;
  }
  try {
    localStorage.setItem(LEARNER_LEVEL_STORAGE_KEY, level);
    return true;
  } catch (error) {
    console.error('Unable to save learner level preference:', error);
    return false;
  }
};

export const clearLearnerLevel = (): boolean => {
  try {
    localStorage.removeItem(LEARNER_LEVEL_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Unable to clear learner level preference:', error);
    return false;
  }
};
