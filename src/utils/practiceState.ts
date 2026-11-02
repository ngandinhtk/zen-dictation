export const remainingSeconds = (deadline: number, now = Date.now()): number =>
  Math.max(0, Math.ceil((deadline - now) / 1000));

export const resolvePracticeSentence = (pool: string[], index: number, lesson: { texts: string[]; index: number } | null): string =>
  lesson ? lesson.texts[lesson.index] || '' : pool[index] || '';
