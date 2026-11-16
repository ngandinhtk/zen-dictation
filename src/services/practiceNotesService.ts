export interface PracticeNote {
  sentence: string;
  note: string;
  createdAt: string;
}

const NOTES_KEY = 'zen-dictation-practice-notes';
const isPracticeNote = (value: unknown): value is PracticeNote => {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<PracticeNote>;
  return typeof note.sentence === 'string' && typeof note.note === 'string' && typeof note.createdAt === 'string';
};

export const readPracticeNotes = () => {
  try {
    const value = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isPracticeNote) : [];
  } catch {
    return [];
  }
};

export const getPracticeNotesForSentence = (sentence: string) =>
  readPracticeNotes().filter(note => note.sentence === sentence);

export const savePracticeNoteForSentence = (sentence: string, value: string) => {
  const cleanSentence = sentence.trim();
  const cleanNote = value.trim();
  if (!cleanSentence || !cleanNote) return getPracticeNotesForSentence(cleanSentence);

  const notes = [...readPracticeNotes(), {
    sentence: cleanSentence,
    note: cleanNote,
    createdAt: new Date().toISOString(),
  }].slice(-200);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  return notes.filter(note => note.sentence === cleanSentence);
};

export const mergePracticeNotes = (local: unknown, remote: unknown): PracticeNote[] => {
  const toNotes = (value: unknown) => Array.isArray(value) ? value.filter(isPracticeNote) : [];
  const notesByKey = new Map<string, PracticeNote>();
  for (const note of [...toNotes(local), ...toNotes(remote)]) {
    notesByKey.set(JSON.stringify([note.sentence.trim().toLowerCase(), note.createdAt]), note);
  }
  return [...notesByKey.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(-200);
};

export const replacePracticeNotes = (notes: unknown): boolean => {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(mergePracticeNotes([], notes)));
    return true;
  } catch (error) {
    console.error('Unable to save practice notes:', error);
    return false;
  }
};

export const clearPracticeNotes = () => {
  try {
    localStorage.removeItem(NOTES_KEY);
  } catch (error) {
    console.error('Unable to clear practice notes:', error);
  }
};
