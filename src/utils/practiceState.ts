export const remainingSeconds = (deadline: number, now = Date.now()): number =>
  Math.max(0, Math.ceil((deadline - now) / 1000));

export const getTypingSpeed = (correctChars: number, startedAt: number, now: number, isDisabled: boolean): number | null => {
  if (isDisabled) return null;
  const elapsedMinutes = Math.max((now - startedAt) / 60_000, 1 / 60);
  return correctChars > 0 ? (correctChars / 5) / elapsedMinutes : 0;
};

export const isNextButtonDisabled = (isTimeUp: boolean, focusSessionComplete: boolean, deadline: number | null, now = Date.now()): boolean =>
  isTimeUp || focusSessionComplete || (deadline !== null && remainingSeconds(deadline, now) === 0);

export const resolvePracticeSentence = (pool: string[], index: number, lesson: { texts: string[]; index: number } | null): string =>
  lesson ? lesson.texts[lesson.index] || '' : pool[index] || '';
