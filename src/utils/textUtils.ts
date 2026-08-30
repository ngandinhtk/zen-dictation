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
