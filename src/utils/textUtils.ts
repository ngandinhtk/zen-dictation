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
}

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
  return {
    accuracy: Math.round((correctCharacters / Math.max(target.length, 1)) * 100),
    incorrectCharacters,
    missingCharacters,
    grammarTip: getGrammarTip(target),
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
