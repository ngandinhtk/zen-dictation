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

type ConversationSeed = {
  id: string;
  title: string;
  topic: string;
  subject: string;
  action: string;
  detail: string;
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

const createConversationPassages = (difficulty: Difficulty, seeds: ConversationSeed[]): ConnectedPassage[] =>
  seeds.map(seed => {
    const sentences = difficulty === 'easy'
      ? [
        `Hello, can I ask about ${seed.subject}?`,
        `Of course. What would you like to know?`,
        `When can I ${seed.action}?`,
        `You can do it ${seed.detail}.`,
        'Thank you for your help.',
      ]
      : difficulty === 'medium'
        ? [
          `I am planning to ${seed.action}, but I need some advice about ${seed.subject}.`,
          'That sounds sensible. What part would you like to discuss first?',
          `I am mainly concerned about whether ${seed.detail} will be practical.`,
          `It should work well if you ${seed.action} and check the details carefully.`,
          'That gives me a much clearer plan. Thanks for explaining it.',
        ]
        : [
          `Before we decide, we should examine how ${seed.subject} might affect the wider project.`,
          'I agree, although the available evidence is not completely conclusive yet.',
          `The central question is whether ${seed.detail} justifies the additional effort.`,
          `It may, provided that we ${seed.action} and remain open to revising our assumptions.`,
          'Then let us record the risks before we make a final recommendation.',
        ];

    return {
      id: seed.id,
      title: seed.title,
      difficulty,
      topic: seed.topic,
      sentences,
      source: 'custom',
    };
  });

const easyConversationSeeds: ConversationSeed[] = [
  { id: 'easy-cafe', title: 'At the cafe', topic: 'daily life', subject: 'the menu', action: 'order a sandwich', detail: 'after lunch' },
  { id: 'easy-bus', title: 'Taking the bus', topic: 'travel', subject: 'the bus stop', action: 'catch the number five bus', detail: 'in ten minutes' },
  { id: 'easy-library', title: 'At the library', topic: 'learning', subject: 'a library card', action: 'borrow this book', detail: 'for three weeks' },
  { id: 'easy-weather', title: 'Talking about weather', topic: 'daily life', subject: 'tomorrow’s weather', action: 'go for a walk', detail: 'in the afternoon' },
  { id: 'easy-shopping', title: 'Buying a shirt', topic: 'shopping', subject: 'this blue shirt', action: 'try it on', detail: 'in the changing room' },
  { id: 'easy-doctor', title: 'At the clinic', topic: 'health', subject: 'your appointment', action: 'see the doctor', detail: 'at two o’clock' },
  { id: 'easy-homework', title: 'Doing homework', topic: 'learning', subject: 'the English exercise', action: 'finish the homework', detail: 'before dinner' },
  { id: 'easy-garden', title: 'In the garden', topic: 'home', subject: 'these flowers', action: 'water the plants', detail: 'every morning' },
  { id: 'easy-birthday', title: 'A birthday party', topic: 'friends', subject: 'the birthday cake', action: 'bring some plates', detail: 'before the guests arrive' },
  { id: 'easy-phone', title: 'A phone call', topic: 'communication', subject: 'your new phone', action: 'call me tonight', detail: 'after work' },
  { id: 'easy-school', title: 'At school', topic: 'learning', subject: 'the new classroom', action: 'meet the teacher', detail: 'on Monday' },
  { id: 'easy-breakfast', title: 'Making breakfast', topic: 'food', subject: 'some fresh eggs', action: 'make breakfast', detail: 'in the kitchen' },
  { id: 'easy-pet', title: 'Looking after a pet', topic: 'home', subject: 'your dog', action: 'take him outside', detail: 'before breakfast' },
  { id: 'easy-movie', title: 'Choosing a movie', topic: 'entertainment', subject: 'the new movie', action: 'watch it tonight', detail: 'with your family' },
  { id: 'easy-room', title: 'Cleaning a room', topic: 'home', subject: 'the living room', action: 'open the window', detail: 'for some fresh air' },
  { id: 'easy-park', title: 'Meeting at the park', topic: 'friends', subject: 'the park entrance', action: 'meet me there', detail: 'at four o’clock' },
  { id: 'easy-train', title: 'Catching a train', topic: 'travel', subject: 'the morning train', action: 'buy a ticket', detail: 'at the station' },
  { id: 'easy-lunch', title: 'Making lunch plans', topic: 'food', subject: 'our lunch', action: 'meet at noon', detail: 'near the office' },
  { id: 'easy-clothes', title: 'Getting dressed', topic: 'daily life', subject: 'these new shoes', action: 'wear them today', detail: 'with your jacket' },
  { id: 'easy-directions', title: 'Asking for directions', topic: 'travel', subject: 'the town center', action: 'walk straight ahead', detail: 'past the bank' },
];

const mediumConversationSeeds: ConversationSeed[] = [
  { id: 'medium-project', title: 'Planning a project', topic: 'work', subject: 'the project schedule', action: 'review the first draft', detail: 'the timeline is realistic' },
  { id: 'medium-interview', title: 'Preparing for an interview', topic: 'career', subject: 'the interview process', action: 'describe your experience', detail: 'your examples are specific enough' },
  { id: 'medium-travel', title: 'Planning a trip', topic: 'travel', subject: 'the travel itinerary', action: 'reserve the accommodation', detail: 'the location is convenient' },
  { id: 'medium-budget', title: 'Managing a budget', topic: 'finance', subject: 'our monthly budget', action: 'compare the main expenses', detail: 'the savings target is achievable' },
  { id: 'medium-course', title: 'Choosing a course', topic: 'learning', subject: 'the evening course', action: 'check the entry requirements', detail: 'the workload fits your schedule' },
  { id: 'medium-meeting', title: 'A difficult meeting', topic: 'communication', subject: 'the meeting agenda', action: 'clarify the main concern', detail: 'everyone has enough information' },
  { id: 'medium-health', title: 'Building a healthy routine', topic: 'health', subject: 'your exercise routine', action: 'start with shorter sessions', detail: 'the plan remains manageable' },
  { id: 'medium-neighbor', title: 'Helping a neighbor', topic: 'community', subject: 'the neighborhood event', action: 'organize the volunteer list', detail: 'more people offer their time' },
  { id: 'medium-repair', title: 'Repairing a device', topic: 'technology', subject: 'the broken laptop', action: 'back up the important files', detail: 'the problem is limited to the battery' },
  { id: 'medium-book', title: 'Discussing a book', topic: 'culture', subject: 'the author’s argument', action: 'explain the final chapter', detail: 'the ending changes the reader’s perspective' },
  { id: 'medium-food', title: 'Cooking for guests', topic: 'food', subject: 'the dinner menu', action: 'prepare the vegetables early', detail: 'everyone’s dietary needs are considered' },
  { id: 'medium-rent', title: 'Finding a new apartment', topic: 'home', subject: 'the rental agreement', action: 'ask about the maintenance fees', detail: 'the total cost remains affordable' },
  { id: 'medium-feedback', title: 'Giving useful feedback', topic: 'work', subject: 'the latest presentation', action: 'focus on the clearest examples', detail: 'the speaker can improve the structure' },
  { id: 'medium-language', title: 'Practicing a language', topic: 'learning', subject: 'your speaking practice', action: 'use the new expressions in context', detail: 'regular conversations build confidence' },
  { id: 'medium-shopping', title: 'Comparing products', topic: 'shopping', subject: 'the two available models', action: 'read the customer reviews', detail: 'the cheaper option has a longer warranty' },
  { id: 'medium-event', title: 'Organizing an event', topic: 'community', subject: 'the community workshop', action: 'confirm the room booking', detail: 'the attendance estimate is accurate' },
  { id: 'medium-time', title: 'Managing time', topic: 'daily life', subject: 'your weekly routine', action: 'group similar tasks together', detail: 'the priorities are clearly defined' },
  { id: 'medium-team', title: 'Working with a team', topic: 'collaboration', subject: 'the team responsibilities', action: 'share the progress report', detail: 'each person understands their role' },
  { id: 'medium-complaint', title: 'Resolving a complaint', topic: 'communication', subject: 'the customer’s concern', action: 'listen before offering a solution', detail: 'the response is respectful and practical' },
  { id: 'medium-environment', title: 'Reducing waste', topic: 'environment', subject: 'the recycling plan', action: 'replace disposable items', detail: 'small changes influence daily habits' },
];

const hardConversationSeeds: ConversationSeed[] = [
  { id: 'hard-policy', title: 'Reviewing a policy', topic: 'society', subject: 'the proposed policy', action: 'evaluate the evidence independently', detail: 'the projected benefits outweigh the risks' },
  { id: 'hard-research', title: 'Assessing research', topic: 'science', subject: 'the preliminary findings', action: 'replicate the experiment', detail: 'the observed pattern is statistically meaningful' },
  { id: 'hard-leadership', title: 'Making a leadership decision', topic: 'leadership', subject: 'the organization’s priorities', action: 'consult the affected teams', detail: 'the decision remains transparent and accountable' },
  { id: 'hard-technology', title: 'Considering new technology', topic: 'technology', subject: 'the proposed automation', action: 'identify the unintended consequences', detail: 'the efficiency gains justify the transition costs' },
  { id: 'hard-environment', title: 'Responding to climate change', topic: 'environment', subject: 'the changing coastline', action: 'combine local observations with historical records', detail: 'long-term planning accounts for considerable uncertainty' },
  { id: 'hard-education', title: 'Reforming education', topic: 'education', subject: 'the assessment system', action: 'balance measurable outcomes with creativity', detail: 'students receive meaningful opportunities to improve' },
  { id: 'hard-economy', title: 'Discussing economic change', topic: 'economy', subject: 'the changing labor market', action: 'distinguish temporary effects from structural trends', detail: 'the available data supports a cautious conclusion' },
  { id: 'hard-ethics', title: 'Examining an ethical question', topic: 'ethics', subject: 'the ethical dilemma', action: 'consider the interests of every group', detail: 'no single principle resolves the conflict completely' },
  { id: 'hard-media', title: 'Evaluating information', topic: 'media', subject: 'the public statement', action: 'verify the original sources', detail: 'the headline does not accurately represent the underlying facts' },
  { id: 'hard-negotiation', title: 'Negotiating an agreement', topic: 'communication', subject: 'the proposed agreement', action: 'separate shared interests from fixed positions', detail: 'both parties can accept the revised terms' },
  { id: 'hard-urban', title: 'Designing a city', topic: 'society', subject: 'the urban development plan', action: 'include residents in the consultation', detail: 'the design responds to practical needs rather than appearances' },
  { id: 'hard-literature', title: 'Interpreting literature', topic: 'culture', subject: 'the novel’s central metaphor', action: 'compare several plausible interpretations', detail: 'the ambiguity is essential to the author’s purpose' },
  { id: 'hard-health', title: 'Discussing public health', topic: 'health', subject: 'the public health recommendation', action: 'communicate the limitations honestly', detail: 'public trust depends on consistent reasoning' },
  { id: 'hard-business', title: 'Assessing a business strategy', topic: 'business', subject: 'the long-term strategy', action: 'test the assumptions against multiple scenarios', detail: 'the projected growth depends on unstable conditions' },
  { id: 'hard-history', title: 'Learning from history', topic: 'history', subject: 'the historical comparison', action: 'acknowledge the differences between the periods', detail: 'the analogy is useful but cannot explain everything' },
  { id: 'hard-science', title: 'Explaining uncertainty', topic: 'science', subject: 'the scientific model', action: 'state what the model cannot predict', detail: 'uncertainty is a reason for caution rather than inaction' },
  { id: 'hard-conflict', title: 'Managing conflict', topic: 'communication', subject: 'the unresolved disagreement', action: 'reconstruct how the misunderstanding developed', detail: 'both perspectives contain part of the truth' },
  { id: 'hard-art', title: 'Discussing public art', topic: 'culture', subject: 'the controversial installation', action: 'consider its cultural context carefully', detail: 'discomfort can encourage a valuable public conversation' },
  { id: 'hard-future', title: 'Planning for the future', topic: 'planning', subject: 'the uncertain future', action: 'prepare several adaptable options', detail: 'the plan remains useful under changing conditions' },
  { id: 'hard-responsibility', title: 'Sharing responsibility', topic: 'leadership', subject: 'the final outcome', action: 'distinguish individual choices from institutional pressures', detail: 'accountability is shared without becoming meaningless' },
];

const conversationPassages = [
  ...createConversationPassages('easy', easyConversationSeeds),
  ...createConversationPassages('medium', mediumConversationSeeds),
  ...createConversationPassages('hard', hardConversationSeeds),
];

export const SENTENCE_BANK: SentenceBank = {
  'en-US': {
    easy: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].easy, 'easy', 'custom', 'core'), passagesByDifficulty('easy'), ...conversationPassages.filter(passage => passage.difficulty === 'easy').map(createPassageItems)),
    medium: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].medium, 'medium', 'custom', 'core'), passagesByDifficulty('medium'), ...conversationPassages.filter(passage => passage.difficulty === 'medium').map(createPassageItems)),
    hard: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].hard, 'hard', 'custom', 'core'), passagesByDifficulty('hard'), ...conversationPassages.filter(passage => passage.difficulty === 'hard').map(createPassageItems)),
  },
};

export const CONVERSATIONS = conversationPassages;

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
