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

const readPracticeNotes = () => {
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
