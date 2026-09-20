/**
 * Text normalization and comparison utilities
 */

export const normalizeText = (text: string): string => {
  return text
    .trim()
    .toLowerCase()
    .replace(new RegExp("[.,/#!$%^&*;:{}=\\-_`~()]", "g"), "") // Remove punctuation
    .replace(/\s{2,}/g, " "); // Remove extra spaces
};

export interface CharFeedback {
  char: string;
  status: 'correct' | 'incorrect' | 'pending';
}

export interface AttemptAnalysis {
  accuracy: number;
  incorrectCharacters: number;
  missingCharacters: number;
  grammarTip: string;
  incorrectWords: Array<{ actual: string; expected: string }>;
  missingWords: string[];
  extraWords: string[];
}

const getWordAlignment = (targetWords: string[], inputWords: string[]) => {
  const targetCount = targetWords.length;
  const inputCount = inputWords.length;
  const table = Array.from({ length: targetCount + 1 }, () => Array<number>(inputCount + 1).fill(0));

  for (let targetIndex = targetCount - 1; targetIndex >= 0; targetIndex -= 1) {
    for (let inputIndex = inputCount - 1; inputIndex >= 0; inputIndex -= 1) {
      table[targetIndex][inputIndex] = targetWords[targetIndex] === inputWords[inputIndex]
        ? table[targetIndex + 1][inputIndex + 1] + 1
        : Math.max(table[targetIndex + 1][inputIndex], table[targetIndex][inputIndex + 1]);
    }
  }

  const missingWords: string[] = [];
  const extraWords: string[] = [];
  let targetIndex = 0;
  let inputIndex = 0;
  while (targetIndex < targetCount || inputIndex < inputCount) {
    if (targetIndex < targetCount && inputIndex < inputCount && targetWords[targetIndex] === inputWords[inputIndex]) {
      targetIndex += 1;
      inputIndex += 1;
    } else if (targetIndex < targetCount && (inputIndex >= inputCount || table[targetIndex + 1][inputIndex] >= table[targetIndex][inputIndex + 1])) {
      missingWords.push(targetWords[targetIndex]);
      targetIndex += 1;
    } else if (inputIndex < inputCount) {
      extraWords.push(inputWords[inputIndex]);
      inputIndex += 1;
    }
  }

  return { missingWords, extraWords };
};

export const getGrammarTip = (sentence: string): string => {
  const text = sentence.toLowerCase();
  if (/\bif\b.*\bwill\b/.test(text)) return 'First conditional: if + present, will + verb for a real future possibility.';
  if (/\bif\b.*\bwould\b/.test(text)) return 'Second conditional: if + past, would + verb for an imagined situation.';
  if (/\b(have|has)\b.*\b(already|since|for)\b/.test(text)) return 'Present perfect: have/has + past participle connects past actions with the present.';
  if (/\bwas\b.*\bing\b|\bwere\b.*\bing\b/.test(text)) return 'Past continuous: was/were + -ing describes an action in progress in the past.';
  if (/\b(had)\b.*\b(before|by the time)\b/.test(text)) return 'Past perfect: had + past participle shows which past action happened first.';
  if (/\bwho\b|\bwhich\b/.test(text)) return 'Relative clause: who/which adds information about a person or thing.';
  if (/\bthere (is|are)\b/.test(text)) return 'There is/are introduces the existence or location of something.';
  if (/\b(must|should|can|could|may|might)\b/.test(text)) return 'Modal verb: the modal is followed by the base form of the main verb.';
  if (/\bthan\b|\bmost\b/.test(text)) return 'Comparison: comparative or superlative forms compare people, things, or ideas.';
  if (/\balthough\b|\bdespite\b|\bunless\b/.test(text)) return 'Linking clause: this connector shows contrast or a condition between two ideas.';
  return 'Focus on word order, verb endings, and the small connecting words in this sentence.';
};

export const analyzeAttempt = (target: string, input: string): AttemptAnalysis => {
  const feedback = getFeedback(target, input);
  const incorrectCharacters = feedback.filter(item => item.status === 'incorrect').length;
  const missingCharacters = feedback.filter(item => item.status === 'pending').length;
  const correctCharacters = feedback.length - incorrectCharacters - missingCharacters;
  const targetWords = target.toLowerCase().match(/[a-z']+/g) || [];
  const inputWords = input.toLowerCase().match(/[a-z']+/g) || [];
  const incorrectWords = inputWords
    .map((word, index) => ({ actual: word, expected: targetWords[index] }))
    .filter(detail => detail.expected !== undefined && detail.expected !== detail.actual);
  const { missingWords, extraWords } = getWordAlignment(targetWords, inputWords);
  return {
    accuracy: Math.round((correctCharacters / Math.max(target.length, 1)) * 100),
    incorrectCharacters,
    missingCharacters,
    grammarTip: getGrammarTip(target),
    incorrectWords,
    missingWords,
    extraWords,
  };
};

export const getFeedback = (target: string, input: string): CharFeedback[] => {
  const feedback: CharFeedback[] = [];
  const targetChars = target.split('');
  const inputChars = input.split('');

  for (let i = 0; i < targetChars.length; i++) {
    const targetChar = targetChars[i];
    const inputChar = inputChars[i];

    if (inputChar === undefined) {
      feedback.push({ char: targetChar, status: 'pending' });
    } else if (inputChar.toLowerCase() === targetChar.toLowerCase()) {
      feedback.push({ char: targetChar, status: 'correct' });
    } else {
      feedback.push({ char: targetChar, status: 'incorrect' });
    }
  }

  return feedback;
};
