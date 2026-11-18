import { SENTENCE_BANK, VOCABULARY_SENTENCE_BANK } from '../../data/sentenceBank';

export type Skill = 'listening' | 'speaking' | 'writing';

export const skills: Skill[] = ['listening', 'speaking', 'writing'];

export interface Question {
  skill: Skill;
  prompt: string;
  audio?: string;
  choices?: string[];
  answers: string[];
}

export const questions: Question[] = [
  {
    skill: 'listening',
    audio: 'The library closes at six on weekdays, but on Friday it stays open until eight.',
    prompt: 'When does the library close on Friday?',
    choices: ['At six', 'At seven', 'At eight'],
    answers: ['At eight'],
  },
  {
    skill: 'listening',
    audio: 'I was going to take the bus, but it was running late, so I borrowed my sister’s bike.',
    prompt: 'How did the speaker travel?',
    choices: ['By bike', 'By bus', 'By car'],
    answers: ['By bike'],
  },
  {
    skill: 'listening',
    audio: 'Even though the hotel was cheaper, we picked the apartment because it had a kitchen and was closer to the station.',
    prompt: 'Why did they choose the apartment?',
    choices: ['It cost less', 'It included breakfast', 'It had a kitchen and was closer to the station'],
    answers: ['It had a kitchen and was closer to the station'],
  },
  {
    skill: 'listening',
    audio: 'The train to Oxford leaves platform three at nine twenty. Passengers should arrive at least ten minutes before departure.',
    prompt: 'By what time should passengers arrive?',
    choices: ['By 9:10', 'By 9:20', 'By 9:30'],
    answers: ['By 9:10'],
  },
  {
    skill: 'listening',
    audio: 'Nina planned to visit the museum on Monday, but it is closed then, so she will go on Tuesday instead.',
    prompt: 'When will Nina visit the museum?',
    choices: ['On Monday', 'On Tuesday', 'On Wednesday'],
    answers: ['On Tuesday'],
  },
  {
    skill: 'speaking',
    prompt: 'Could you open the window, please?',
    answers: ['Could you open the window, please?'],
  },
  {
    skill: 'speaking',
    prompt: 'We were waiting outside when it started to rain.',
    answers: ['We were waiting outside when it started to rain.'],
  },
  {
    skill: 'speaking',
    prompt: 'Although the meeting was postponed, everyone received the updated schedule.',
    answers: ['Although the meeting was postponed, everyone received the updated schedule.'],
  },
  {
    skill: 'speaking',
    prompt: 'Could you tell me how to get to the nearest pharmacy?',
    answers: ['Could you tell me how to get to the nearest pharmacy?'],
  },
  {
    skill: 'speaking',
    prompt: 'If I had known about the traffic, I would have left earlier.',
    answers: ['If I had known about the traffic, I would have left earlier.'],
  },
  {
    skill: 'writing',
    prompt: 'Write a complete question using: where / your brother / work',
    answers: ['Where does your brother work?'],
  },
  {
    skill: 'writing',
    prompt: 'Combine these ideas into one sentence using “because”: Maya stayed home. She felt sick.',
    answers: ['Maya stayed home because she felt sick.', 'Because she felt sick, Maya stayed home.'],
  },
  {
    skill: 'writing',
    prompt: 'Rewrite in the second conditional: I do not have more time, so I cannot learn another language. Start with “If I had more time”.',
    answers: ['If I had more time, I could learn another language.', 'If I had more time, I would be able to learn another language.'],
  },
  {
    skill: 'writing',
    prompt: 'Rewrite in the passive voice: People speak English in many countries.',
    answers: ['English is spoken in many countries.'],
  },
  {
    skill: 'writing',
    prompt: 'Rewrite using the present perfect continuous: I started learning English three years ago and I still study it.',
    answers: ['I have been learning English for three years.'],
  },
];

const shuffle = <T,>(items: T[], random: () => number): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
};

const normalizeSentence = (text: string) => text.replace(/[.!?]+$/, '').trim();

export const createPlacementQuestions = (learnedTexts: string[] = [], random: () => number = Math.random): Question[] => {
  const bankPool = [
    ...Object.values(SENTENCE_BANK['en-US']).flat().map(item => item.text),
    ...Object.values(VOCABULARY_SENTENCE_BANK['en-US']).flat().map(item => item.text),
  ];
  const uniqueLearned = [...new Set(learnedTexts.map(normalizeSentence).filter(Boolean))];
  const learnedSet = new Set(uniqueLearned);
  const freshBank = bankPool.map(normalizeSentence).filter(text => text && !learnedSet.has(text));
  const pool = [...new Set([...uniqueLearned, ...freshBank])];

  if (pool.length === 0) return questions;

  const bankListening = shuffle(pool, random).slice(0, 3).map(text => {
    const alternatives = shuffle(pool.filter(item => item !== text), random).slice(0, 2);
    return {
      skill: 'listening' as const,
      audio: text,
      prompt: 'Listen, then choose the answer',
      choices: shuffle([text, ...alternatives], random),
      answers: [text],
    };
  });
  const staticListening = shuffle(questions.filter(question => question.skill === 'listening'), random).slice(0, 2);
  const listening = shuffle([...bankListening, ...staticListening], random);

  const selectedSpeaking = shuffle(pool, random).slice(0, 3);
  const bankSpeaking = selectedSpeaking.map(text => ({
    skill: 'speaking' as const,
    prompt: text,
    answers: [text],
  }));
  const staticSpeaking = shuffle(questions.filter(question => question.skill === 'speaking'), random).slice(0, 2);
  const speaking = shuffle([...bankSpeaking, ...staticSpeaking], random);

  const writing = shuffle(questions.filter(question => question.skill === 'writing'), random);

  return [...listening, ...speaking, ...writing];
};
