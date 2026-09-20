import { apiUrl } from './api';

export interface AccountUser {
  id: string;
  email: string;
  createdAt: string;
  isPremium: boolean;
}

export interface AccountPracticeSession {
  id: string;
  date: string;
  difficulty: string;
  wpm: number;
  accuracy: number;
}

export interface AccountLearningState {
  review_words: unknown[];
  points: number;
  daily_target: unknown | null;
  goal_wpm: number;
  updated_at?: string;
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const raw = await response.text();
  let result: { error?: string } & T;
  try {
    result = JSON.parse(raw) as { error?: string } & T;
  } catch {
    throw new Error(response.status === 404
      ? 'Account API route was not found. Please check that the backend is running and VITE_API_URL is correct.'
      : 'The account server returned an invalid response. Please try again.');
  }
  if (!response.ok) throw new Error(result.error || 'Something went wrong');
  return result;
};

const authenticate = async (path: string, email: string, password: string) => {
  const result = await request<{ user: AccountUser }>(path, { method: 'POST', body: JSON.stringify({ email, password }) });
  return result.user;
};

export const registerAccount = (email: string, password: string) => authenticate('/api/auth/register', email, password);
export const loginAccount = (email: string, password: string) => authenticate('/api/auth/login', email, password);
export const getCurrentAccount = async () => {
  try {
    return (await request<{ user: AccountUser }>('/api/auth/me')).user;
  } catch {
    return null;
  }
};
export const logoutAccount = async () => {
  await request('/api/auth/logout', { method: 'POST' });
};

export const getAccountSessions = async () => (await request<{ sessions: AccountPracticeSession[] }>('/api/sessions')).sessions;
export const saveAccountSession = async (session: Omit<AccountPracticeSession, 'id'>) => request<{ session: AccountPracticeSession }>('/api/sessions', { method: 'POST', body: JSON.stringify(session) });

const sessionKey = (session: Omit<AccountPracticeSession, 'id'> | AccountPracticeSession) => [session.date, session.difficulty, session.wpm, session.accuracy].join('|');

export const syncAccountSessions = async (localSessions: Array<Omit<AccountPracticeSession, 'id'>>) => {
  const remoteSessions = await getAccountSessions();
  const remoteKeys = new Set(remoteSessions.map(sessionKey));
  const missingSessions = localSessions.filter(session => !remoteKeys.has(sessionKey(session))).slice(0, 30);
  await Promise.all(missingSessions.map(session => saveAccountSession(session)));
  return getAccountSessions();
};

export const getAccountLearningState = async () => (await request<{ state: AccountLearningState | null }>('/api/learning-state')).state;
export const saveAccountLearningState = async (state: { reviewWords: unknown[]; points: number; dailyTarget: unknown | null; goalWpm: number }) => request<{ state: AccountLearningState }>('/api/learning-state', { method: 'PUT', body: JSON.stringify(state) });
