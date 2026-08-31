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

const TOKEN_KEY = 'zen-dictation-account-token';

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong');
  return result;
};

const authenticate = async (path: string, email: string, password: string) => {
  const result = await request<{ user: AccountUser; token: string }>(path, { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
};

export const registerAccount = (email: string, password: string) => authenticate('/api/auth/register', email, password);
export const loginAccount = (email: string, password: string) => authenticate('/api/auth/login', email, password);
export const getCurrentAccount = async () => {
  try {
    return (await request<{ user: AccountUser }>('/api/auth/me')).user;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
};
export const logoutAccount = async () => {
  try { await request('/api/auth/logout', { method: 'POST' }); } finally { localStorage.removeItem(TOKEN_KEY); }
};

export const getAccountSessions = async () => (await request<{ sessions: AccountPracticeSession[] }>('/api/sessions')).sessions;
export const saveAccountSession = async (session: Omit<AccountPracticeSession, 'id'>) => request<{ session: AccountPracticeSession }>('/api/sessions', { method: 'POST', body: JSON.stringify(session) });
