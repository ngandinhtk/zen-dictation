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

const removeSentencePunctuation = (text: string) => text
  .replace(/([\p{L}\p{N}])['’]([\p{L}\p{N}])/gu, '$1$2')
  .replace(/\p{P}+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const createSentenceItems = (sentences: string[], difficulty: Difficulty, source: SentenceSource, collection: string): SentenceItem[] =>
  sentences.map((text, index) => ({
    id: `${collection}-${difficulty}-${index + 1}`,
    text: removeSentencePunctuation(text),
    difficulty,
    topic: getTopic(source),
    source,
    ...(source === 'custom' ? {} : { license: source === 'public-domain' ? 'Public domain' : 'CC BY' }),
  }));

const createPassageItems = (passage: ConnectedPassage): SentenceItem[] => passage.sentences.map((text, index) => ({
  id: `${passage.id}-${index + 1}`,
  text: removeSentencePunctuation(text),
  difficulty: passage.difficulty,
  topic: passage.topic,
  passageId: passage.id,
  sequence: index + 1,
  source: passage.source,
  ...(passage.license ? { license: passage.license } : {}),
}));

export const CONNECTED_PASSAGES: ConnectedPassage[] = ([
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
 ] satisfies ConnectedPassage[]).map(passage => ({
  ...passage,
  sentences: passage.sentences.map(removeSentencePunctuation),
}));

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
  seeds.map((seed, index) => {
    const choose = <T,>(options: T[]) => options[index % options.length];
    const sentences = difficulty === 'easy'
      ? [
        choose([
          `Hello, can I ask about ${seed.subject}?`,
          `Could you tell me about ${seed.subject}?`,
          `I have a question about ${seed.subject}.`,
          `Do you know anything about ${seed.subject}?`,
          `I would like some information about ${seed.subject}.`,
          `Can you help me understand ${seed.subject}?`,
          `I am looking for details about ${seed.subject}.`,
          `Would you mind explaining ${seed.subject}?`,
        ]),
        choose([
          'Of course. What would you like to know?',
          'Sure. How can I help you?',
          'Yes, I can help with that.',
          'Certainly. What is your question?',
          'I would be happy to explain.',
          'Let me see what information I can find.',
          'Ask me anything you need to know.',
          'I can certainly help you with that.',
        ]),
        choose([
          `When can I ${seed.action}?`,
          `Is there a good time to ${seed.action}?`,
          `Would it be possible to ${seed.action}?`,
          `Could I ${seed.action} today?`,
          `How soon can I ${seed.action}?`,
          `Do you think I can ${seed.action} now?`,
          `Should I ${seed.action} before I leave?`,
          `What time would be best to ${seed.action}?`,
        ]),
        choose([
          `You can do it ${seed.detail}.`,
          `That should be possible ${seed.detail}.`,
          `The timing works well ${seed.detail}.`,
          `You should have time to do that ${seed.detail}.`,
          `It is convenient to do that ${seed.detail}.`,
          `You will be able to do that ${seed.detail}.`,
          `That timing should work for you ${seed.detail}.`,
          `There should be enough time ${seed.detail}.`,
        ]),
        choose([
          'Thank you for your help.',
          'Thanks. That is very helpful.',
          'Great, I appreciate your advice.',
          'Thanks for explaining that to me.',
          'I appreciate you taking the time to help.',
          'That answers my question. Thank you.',
          'Thanks. I know what to do now.',
          'You have been very helpful.',
        ]),
      ]
      : difficulty === 'medium'
        ? [
          choose([
            `I am planning to ${seed.action}, but I need some advice about ${seed.subject}.`,
            `Before I ${seed.action}, I would like to discuss ${seed.subject}.`,
            `Could we review ${seed.subject} before I ${seed.action}?`,
            `I have considered ${seed.subject}, but I am unsure how to proceed.`,
            `One issue I would like to clarify is ${seed.subject}.`,
            `I need to make a decision about ${seed.subject} soon.`,
            `There are a few details about ${seed.subject} that I would like to review.`,
            `My next step depends on whether ${seed.subject} is ready.`,
            `I would appreciate another perspective on ${seed.subject}.`,
          ]),
          choose([
            'That sounds sensible. What part would you like to discuss first?',
            'Let us start with the main issue and consider the alternatives.',
            'We can work through the details before making a decision.',
            'A little more information should make the options clearer.',
            'It may help to identify the most important concern first.',
            'Let us consider what needs attention before discussing possible solutions.',
            'We should compare the available options before choosing one.',
            'A careful review can show us where further information is needed.',
          ]),
          choose([
            `I am mainly concerned about whether ${seed.detail} will be practical.`,
            `The main question is whether ${seed.detail}.`,
            `I would like to confirm that ${seed.detail}.`,
            `We should establish whether ${seed.detail} before moving ahead.`,
            `One point still needs clarification because ${seed.detail}.`,
            `The decision will be easier once we know whether ${seed.detail}.`,
            `My main concern is how we can ensure that ${seed.detail}.`,
            `It would be useful to check whether ${seed.detail}.`,
          ]),
          choose([
            `It should work well if you ${seed.action} and check the details carefully.`,
            `You could ${seed.action}, provided that you confirm the important details.`,
            `A practical next step would be to ${seed.action} before making a commitment.`,
            `If you ${seed.action}, you will have a better basis for deciding.`,
            `I suggest that you ${seed.action} before considering other options.`,
            `You may want to ${seed.action} and then review the outcome.`,
            `It would be reasonable to ${seed.action} once the remaining details are clear.`,
            `You can reduce uncertainty by taking time to ${seed.action}.`,
          ]),
          choose([
            'That gives me a much clearer plan. Thanks for explaining it.',
            'I can see the advantages more clearly now.',
            'This discussion has helped me decide what to do next.',
            'I will review these points before moving forward.',
            'I will consider the alternatives before making a final choice.',
            'Your suggestions have helped me focus on the key issue.',
            'I have a better idea of how to approach the decision.',
            'That seems like a sensible way to proceed.',
          ]),
        ]
        : [
          choose([
            `Before we decide, we should examine how ${seed.subject} might affect the wider project.`,
            `Any recommendation should account for the wider effects of ${seed.subject}.`,
            `We need to consider the consequences of ${seed.subject} beyond the immediate project.`,
            `A sound decision depends on understanding how ${seed.subject} affects other priorities.`,
            `The implications of ${seed.subject} deserve careful consideration before we proceed.`,
            `Our assessment should include the wider impact of ${seed.subject}.`,
            `It is important to evaluate how ${seed.subject} could influence the final outcome.`,
            `We should not assess ${seed.subject} without considering its broader context.`,
          ]),
          choose([
            'I agree, although the available evidence is not completely conclusive yet.',
            'That is a reasonable concern, but further evidence may change our assessment.',
            'The argument is persuasive, even if some important questions remain unresolved.',
            'We should acknowledge that the current evidence has several limitations.',
            'The available findings are useful, but they do not settle every question.',
            'That interpretation is plausible, although alternative explanations remain possible.',
            'We should distinguish what has been demonstrated from what is still uncertain.',
            'Some important assumptions should be tested before we accept that conclusion.',
          ]),
          choose([
            `The central question is whether ${seed.detail} justifies the additional effort.`,
            `We must determine whether ${seed.detail} before committing further resources.`,
            `It remains unclear whether ${seed.detail} under the current conditions.`,
            `Our assessment should establish whether ${seed.detail} in the long term.`,
            `The recommendation depends on whether ${seed.detail}.`,
            `We need stronger evidence to establish whether ${seed.detail}.`,
            `Whether ${seed.detail} remains a matter for further investigation.`,
            `The available data does not yet confirm whether ${seed.detail}.`,
          ]),
          choose([
            `It may, provided that we ${seed.action} and remain open to revising our assumptions.`,
            `That conclusion would be stronger if we ${seed.action} and test our assumptions.`,
            `We could reach a more reliable judgment if we ${seed.action} first.`,
            `The proposal deserves consideration once we ${seed.action} and assess the consequences.`,
            `A more cautious approach would be to ${seed.action} before drawing a conclusion.`,
            `We should ${seed.action} while also considering the possible unintended effects.`,
            `The next stage should allow us to ${seed.action} without overstating the evidence.`,
            `We can address this concern by taking time to ${seed.action}.`,
          ]),
          choose([
            'Then let us record the risks before we make a final recommendation.',
            'We should document the remaining uncertainties before reaching a conclusion.',
            'A final recommendation should explain both the evidence and its limitations.',
            'Let us summarize the evidence and identify what still needs investigation.',
            'Our report should make clear which findings remain provisional.',
            'The final decision should reflect both the potential benefits and the risks.',
            'We can proceed once the evidence and its limitations are clearly documented.',
            'That gives us a more defensible basis for a recommendation.',
          ]),
        ];

    return {
      id: seed.id,
      title: seed.title,
      difficulty,
      topic: seed.topic,
      sentences: sentences.map(removeSentencePunctuation),
      source: 'custom',
    };
  });

const easyConversationSeeds: ConversationSeed[] = [
  { id: 'easy-cafe', title: 'At the cafe', topic: 'daily life', subject: 'the menu', action: 'order a sandwich', detail: 'after lunch' },
  { id: 'easy-bus', title: 'Taking the bus', topic: 'travel', subject: 'the bus stop', action: 'catch the number five bus', detail: 'in ten minutes' },
  { id: 'easy-library', title: 'At the library', topic: 'learning', subject: 'a library card', action: 'borrow this book', detail: 'for three weeks' },
  { id: 'easy-weather', title: 'Talking about weather', topic: 'daily life', subject: 'tomorrow’s weather', action: 'go for a walk', detail: 'in the afternoon' },
  { id: 'easy-shopping', title: 'Buying a shirt', topic: 'shopping', subject: 'this blue shirt', action: 'try on this shirt', detail: 'in the changing room' },
  { id: 'easy-doctor', title: 'At the clinic', topic: 'health', subject: 'your appointment', action: 'see the doctor', detail: 'at two o’clock' },
  { id: 'easy-homework', title: 'Doing homework', topic: 'learning', subject: 'the English exercise', action: 'finish the homework', detail: 'before dinner' },
  { id: 'easy-garden', title: 'In the garden', topic: 'home', subject: 'these flowers', action: 'water the plants', detail: 'every morning' },
  { id: 'easy-birthday', title: 'A birthday party', topic: 'friends', subject: 'the birthday cake', action: 'bring some plates', detail: 'before the guests arrive' },
  { id: 'easy-phone', title: 'A phone call', topic: 'communication', subject: 'your new phone', action: 'call you', detail: 'after work' },
  { id: 'easy-school', title: 'At school', topic: 'learning', subject: 'the new classroom', action: 'meet the teacher', detail: 'on Monday' },
  { id: 'easy-breakfast', title: 'Making breakfast', topic: 'food', subject: 'some fresh eggs', action: 'make breakfast', detail: 'in the kitchen' },
  { id: 'easy-pet', title: 'Looking after a pet', topic: 'home', subject: 'your dog', action: 'take the dog outside', detail: 'before breakfast' },
  { id: 'easy-movie', title: 'Choosing a movie', topic: 'entertainment', subject: 'the new movie', action: 'watch the movie', detail: 'with your family' },
  { id: 'easy-room', title: 'Cleaning a room', topic: 'home', subject: 'the living room', action: 'open the window', detail: 'for some fresh air' },
  { id: 'easy-park', title: 'Meeting at the park', topic: 'friends', subject: 'the park entrance', action: 'meet at the park', detail: 'at four o’clock' },
  { id: 'easy-train', title: 'Catching a train', topic: 'travel', subject: 'the morning train', action: 'buy a ticket', detail: 'at the station' },
  { id: 'easy-lunch', title: 'Making lunch plans', topic: 'food', subject: 'our lunch', action: 'meet for lunch', detail: 'near the office' },
  { id: 'easy-clothes', title: 'Getting dressed', topic: 'daily life', subject: 'these new shoes', action: 'wear these shoes', detail: 'with your jacket' },
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

const curatedLevelSentences: Record<Difficulty, string[]> = {
  easy: [
    'The baker opens the shop before the first bus arrives.',
    'Maya waters the herbs on her balcony every morning.',
    'Could you leave the parcel beside the front door?',
    'We missed the bus, so Dad drove us to school.',
    'Our library lends board games as well as books.',
    'The soup needs a little more salt.',
    'A red kite landed in the tall tree.',
    'Please bring your notebook to the music room.',
    'The market closes early on Sunday afternoon.',
    'My cousins are staying with us for two nights.',
    'I wore my boots because the path was muddy.',
    'The nurse showed Ben how to use the new inhaler.',
    'The dentist moved my appointment to Thursday morning.',
    'Please put the frozen peas beside the bread.',
    'Our class is making a poster about local birds.',
    'I left my scarf on the chair near the door.',
    'The shop sells fresh oranges from a nearby farm.',
    'Nina feeds the cat before she leaves for work.',
    'We can borrow two bikes from the hotel.',
    'A yellow leaf landed inside my open book.',
    'The train stops here every twenty minutes.',
    'Dad is fixing the loose handle on the cupboard.',
    'I packed my lunch before the school bus arrived.',
    'The little dog waited patiently beside the gate.',
  ],
  medium: [
    'The museum extended its opening hours after visitors requested more evening events.',
    'Since the roadworks began, commuters have been using a quieter route through the village.',
    'The applicant described how she had resolved a disagreement between two departments.',
    'Unless the weather improves by noon, the organizers will move the concert indoors.',
    'The report compares household energy use before and after the new insulation was installed.',
    'Although the first plan was affordable, it did not meet the community’s long-term needs.',
    'Several residents volunteered to repair the playground rather than wait for a contractor.',
    'The course provides practical feedback that students can apply to their next assignment.',
    'When the parcel arrived, I noticed that one of the labels had been damaged.',
    'The restaurant introduced a smaller menu so that its kitchen could reduce food waste.',
    'Our team postponed the launch while the technicians investigated an unexpected fault.',
    'People who share reliable information can help their neighbors make better decisions.',
    'After the library changed its booking system, more students found a quiet place to study.',
    'The community garden gives nearby families a chance to grow vegetables together.',
    'Although the instructions seemed clear, several participants asked for another demonstration.',
    'The council added a cycle lane to make the journey safer for commuters.',
    'A short break helped the volunteers return to the task with renewed energy.',
    'The local clinic now offers appointments in the evening for people who work during the day.',
    'Before choosing a supplier, the shop compared prices, delivery times, and customer reviews.',
    'Her presentation explained how small changes could make the office more welcoming.',
  ],
  hard: [
    'Had the committee examined the regional data earlier, it might have identified the pattern before approving the proposal.',
    'The findings, while consistent with earlier observations, remain inconclusive without a larger and more diverse sample.',
    'Not until the funding was secured did the researchers begin the second phase of the study.',
    'The policy is unlikely to achieve its stated goals unless its implementation is evaluated independently.',
    'What appears to be a temporary disruption may expose weaknesses that have accumulated over several years.',
    'Although the model accounts for seasonal variation, it cannot explain why the results diverge across neighboring regions.',
    'The board rejected the recommendation, not because the evidence was insufficient, but because its implications had been underestimated.',
    'Were the proposed safeguards applied consistently, the system would be less vulnerable to conflicts of interest.',
    'Rather than treating public consultation as a procedural formality, planners should demonstrate how feedback shapes their decisions.',
    'The experiment was repeated under controlled conditions so that the influence of external factors could be assessed.',
    'Only by distinguishing correlation from causation can researchers avoid overstating what the available data demonstrates.',
    'The agreement, which had been revised several times, allocated responsibility without resolving the underlying dispute.',
    'The proposal was approved only after its authors clarified how the costs would be shared.',
    'Even when predictions are persuasive, decision makers should examine the assumptions behind them carefully.',
    'The archive contains letters that reveal how the policy changed during the negotiations over several years.',
    'Had the warning been circulated sooner, nearby residents could have prepared for the outage.',
    'The study distinguishes measurable improvements from benefits that participants merely expected during the follow-up interviews.',
    'Although the route was shorter, poor visibility made it unsuitable for heavy vehicles at night.',
    'The panel withheld its recommendation until independent reviewers had checked the figures before publication.',
    'What appears to be a minor delay can become costly when several departments depend on the same delivery.',
    'The revised schedule gives field researchers enough time to verify unusual observations during the next survey.',
    'Rather than dismissing the criticism, the authors explained which evidence had informed their conclusion.',
    'If the sample excludes older residents, the results may not represent the entire community.',
    'The agreement sets clear limits on data sharing without preventing legitimate research across all projects.',
  ],
};

export const CURATED_LEVEL_SENTENCES = curatedLevelSentences;

export const SENTENCE_BANK: SentenceBank = {
  'en-US': {
    easy: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].easy, 'easy', 'custom', 'core'), passagesByDifficulty('easy'), ...conversationPassages.filter(passage => passage.difficulty === 'easy').map(createPassageItems), createSentenceItems(curatedLevelSentences.easy, 'easy', 'custom', 'core-curated')),
    medium: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].medium, 'medium', 'custom', 'core'), passagesByDifficulty('medium'), ...conversationPassages.filter(passage => passage.difficulty === 'medium').map(createPassageItems), createSentenceItems(curatedLevelSentences.medium, 'medium', 'custom', 'core-curated')),
    hard: mergeUniqueSentences(createSentenceItems(legacySentences['en-US'].hard, 'hard', 'custom', 'core'), passagesByDifficulty('hard'), ...conversationPassages.filter(passage => passage.difficulty === 'hard').map(createPassageItems), createSentenceItems(curatedLevelSentences.hard, 'hard', 'custom', 'core-curated')),
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
