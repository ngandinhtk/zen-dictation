import legacySentences, { CAMBRIDGE_LEVELS, VOCABULARY_SENTENCES } from '../components/Stats/SampleSentence';
import type { Difficulty } from '../utils/sentenceTranslations';

export type SentenceSource = 'custom' | 'public-domain' | 'open-license';

export type SentenceItem = {
  id: string;
  text: string;
  difficulty: Difficulty;
  topic: string;
  passageId?: string;
  sequence?: number;
  source: SentenceSource;
  license?: string;
};

export type ConnectedPassage = {
  id: string;
  title: string;
  difficulty: Difficulty;
  topic: string;
  sentences: string[];
  source: SentenceSource;
  license?: string;
};

export type SentenceBank = Record<'en-US', Record<Difficulty, SentenceItem[]>>;

const getTopic = (source: SentenceSource) => source === 'custom' ? 'learning' : 'general';

const createSentenceItems = (sentences: string[], difficulty: Difficulty, source: SentenceSource, collection: string): SentenceItem[] =>
  sentences.map((text, index) => ({
    id: `${collection}-${difficulty}-${index + 1}`,
    text,
    difficulty,
    topic: getTopic(source),
    source,
    ...(source === 'custom' ? {} : { license: source === 'public-domain' ? 'Public domain' : 'CC BY' }),
  }));

const createPassageItems = (passage: ConnectedPassage): SentenceItem[] => passage.sentences.map((text, index) => ({
  id: `${passage.id}-${index + 1}`,
  text,
  difficulty: passage.difficulty,
  topic: passage.topic,
  passageId: passage.id,
  sequence: index + 1,
  source: passage.source,
  ...(passage.license ? { license: passage.license } : {}),
}));

export const CONNECTED_PASSAGES: ConnectedPassage[] = [
  {
    id: 'the-community-garden',
    title: 'The Community Garden',
    difficulty: 'easy',
    topic: 'community',
    sentences: [
      'Our neighbors found an empty space behind the community hall.',
      'They decided to turn the space into a small garden.',
      'Everyone brought a tool or a packet of seeds.',
      'The children painted signs while the adults prepared the soil.',
      'After a few weeks, the garden became a welcoming place for everyone.',
    ],
    source: 'custom',
  },
  {
    id: 'the-team-project',
    title: 'The Team Project',
    difficulty: 'medium',
    topic: 'collaboration',
    sentences: [
      'The team began its project by agreeing on a realistic deadline.',
      'Each member accepted responsibility for a different part of the research.',
      'When an early result created confusion, they compared their notes carefully.',
      'The discussion revealed a small error in the original plan.',
      'By the end of the week, the team had produced a clearer and more useful report.',
    ],
    source: 'custom',
  },
  {
    id: 'the-changing-coastline',
    title: 'The Changing Coastline',
    difficulty: 'hard',
    topic: 'environment',
    sentences: [
      'The researchers returned to the coastline to compare it with earlier surveys.',
      'Several sections of the shore had changed more quickly than expected.',
      'Although the measurements were incomplete, they revealed a consistent pattern.',
      'The team combined field observations with historical records from nearby villages.',
      'Their final report recommended further research before any long-term decision was made.',
    ],
    source: 'custom',
  },
];

const passagesByDifficulty = (difficulty: Difficulty) => CONNECTED_PASSAGES
  .filter(passage => passage.difficulty === difficulty)
  .flatMap(createPassageItems);

const mergeUniqueSentences = (...collections: SentenceItem[][]) => {
  const seen = new Set<string>();
  return collections.flat().filter(sentence => {
    const normalizedText = sentence.text.trim().toLowerCase();
    if (seen.has(normalizedText)) return false;
    seen.add(normalizedText);
    return true;
  });
};

export const SENTENCE_BANK: SentenceBank = {
  'en-US': {
    easy: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].easy, 'easy', 'custom', 'core'), passagesByDifficulty('easy')),
    medium: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].medium, 'medium', 'custom', 'core'), passagesByDifficulty('medium')),
    hard: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].hard, 'hard', 'custom', 'core'), passagesByDifficulty('hard')),
  },
};

export const VOCABULARY_SENTENCE_BANK: SentenceBank = {
  'en-US': {
    easy: createSentenceItems(VOCABULARY_SENTENCES['en-US'].easy, 'easy', 'custom', 'vocabulary'),
    medium: createSentenceItems(VOCABULARY_SENTENCES['en-US'].medium, 'medium', 'custom', 'vocabulary'),
    hard: createSentenceItems(VOCABULARY_SENTENCES['en-US'].hard, 'hard', 'custom', 'vocabulary'),
  },
};

export const getSentenceTexts = (bank: SentenceBank): Record<'en-US', Record<Difficulty, string[]>> => ({
  'en-US': {
    easy: bank['en-US'].easy.map(sentence => sentence.text),
    medium: bank['en-US'].medium.map(sentence => sentence.text),
    hard: bank['en-US'].hard.map(sentence => sentence.text),
  },
});

export { CAMBRIDGE_LEVELS };

export const SAMPLE_SENTENCES = getSentenceTexts(SENTENCE_BANK);
export const VOCABULARY_SENTENCES_TEXT = getSentenceTexts(VOCABULARY_SENTENCE_BANK);

export default SAMPLE_SENTENCES;
