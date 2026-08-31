export interface PracticeSession {
  id: string;
  date: string;
  difficulty: string;
  wpm: number;
  accuracy: number;
}

const HISTORY_KEY = 'zen-dictation-premium-history';
const GOAL_KEY = 'zen-dictation-premium-goal-wpm';

const readHistory = (): PracticeSession[] => {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const getPracticeHistory = () => readHistory();

export const savePracticeSession = (session: Omit<PracticeSession, 'id'>) => {
  const next = [{ ...session, id: `${Date.now()}-${Math.random()}` }, ...readHistory()].slice(0, 30);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
};

export const getGoalWpm = () => {
  const value = Number(localStorage.getItem(GOAL_KEY));
  return Number.isFinite(value) && value > 0 ? value : 40;
};

export const saveGoalWpm = (value: number) => {
  const goal = Math.min(Math.max(Math.round(value), 10), 200);
  localStorage.setItem(GOAL_KEY, String(goal));
  return goal;
};

export const getPracticeStreak = (history: PracticeSession[]) => {
  const practicedDates = new Set(history.map(session => new Date(session.date).toLocaleDateString()));
  const cursor = new Date();
  if (!practicedDates.has(cursor.toLocaleDateString())) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (practicedDates.has(cursor.toLocaleDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};
