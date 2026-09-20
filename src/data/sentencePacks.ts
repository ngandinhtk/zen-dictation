import type { Difficulty } from '../utils/sentenceTranslations';

export type PremiumSentencePack = 'ielts' | 'business';
export type SentencePack = Record<Difficulty, string[]>;

// These packs are original practice content owned by the app.
export const PREMIUM_SENTENCE_PACKS: Record<PremiumSentencePack, SentencePack> = {
  ielts: {
    easy: [
      'Many students choose to study in another country.',
      'Public transport can reduce traffic in large cities.',
      'Reading every day helps people develop a wider vocabulary.',
    ],
    medium: [
      'Some people believe that online courses are more flexible than traditional classes.',
      'Governments should invest in public transport before expanding city roads.',
      'The quality of education depends on both resources and effective teaching.',
    ],
    hard: [
      'Although technology has transformed education, it cannot replace the motivation created by a supportive teacher.',
      'The long-term consequences of rapid urbanization should be considered before further development is approved.',
      'A balanced argument must acknowledge the immediate benefits as well as the potential social costs.',
    ],
  },
  business: {
    easy: [
      'Our team will discuss the project after lunch.',
      'Please send the updated report before Friday.',
      'The customer asked for a clearer explanation.',
    ],
    medium: [
      'The manager postponed the meeting because several figures needed to be checked.',
      'We should identify the main risk before presenting the proposal to the client.',
      'Clear communication helps a team resolve problems before they affect the deadline.',
    ],
    hard: [
      'The revised strategy is viable only if the organization can measure its results consistently.',
      'Before entering a new market, the company should test its assumptions against several realistic scenarios.',
      'A sustainable partnership requires transparent expectations, shared accountability, and a willingness to adapt.',
    ],
  },
};
