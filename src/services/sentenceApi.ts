import { apiUrl } from './api';
import type { Difficulty } from '../utils/sentenceTranslations';

export interface DatabaseSentence {
  id: string;
  text: string;
  difficulty: Difficulty;
  topic: string;
  source: string;
  license?: string | null;
  sort_order: number;
  pack_id: string;
  pack_name: string;
  is_premium: boolean;
}

const sentenceMemoryCache = new Map<string, { cachedAt: number; sentences: DatabaseSentence[] }>();
const sentenceRequests = new Map<string, Promise<DatabaseSentence[]>>();
const browserCachePrefix = 'zen-dictation-sentence-pack:';
const CACHE_TTL_MS = 5 * 60 * 1000;

const readBrowserCache = (key: string): DatabaseSentence[] | null => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(browserCachePrefix + key) || 'null') as { cachedAt?: number; sentences?: DatabaseSentence[] } | null;
    if (!cached || typeof cached.cachedAt !== 'number' || !Number.isFinite(cached.cachedAt) || Date.now() - cached.cachedAt >= CACHE_TTL_MS) return null;
    return Array.isArray(cached.sentences) && cached.sentences.length > 0 ? cached.sentences : null;
  } catch {
    return null;
  }
};

export const fetchSentencePack = async (pack: string, difficulty?: Difficulty): Promise<DatabaseSentence[]> => {
  const key = `${pack}:${difficulty || 'all'}`;
  const memoryCached = sentenceMemoryCache.get(key);
  if (memoryCached && Date.now() - memoryCached.cachedAt < CACHE_TTL_MS) return memoryCached.sentences;
  const browserCached = readBrowserCache(key);
  if (browserCached) {
    sentenceMemoryCache.set(key, { cachedAt: Date.now(), sentences: browserCached });
    return browserCached;
  }
  const pendingRequest = sentenceRequests.get(key);
  if (pendingRequest) return pendingRequest;

  const difficultyQuery = difficulty ? `&difficulty=${encodeURIComponent(difficulty)}` : '';
  const request = fetch(apiUrl(`/api/sentences?pack=${encodeURIComponent(pack)}${difficultyQuery}`), { credentials: 'include' })
    .then(async response => {
      if (!response.ok) throw new Error('Sentence pack unavailable');
      const payload = await response.json() as { sentences?: DatabaseSentence[] };
      const sentences = payload.sentences || [];
      const cached = { cachedAt: Date.now(), sentences };
      sentenceMemoryCache.set(key, cached);
      try { sessionStorage.setItem(browserCachePrefix + key, JSON.stringify(cached)); } catch { /* Storage can be unavailable in private browsing. */ }
      return sentences;
    })
    .finally(() => sentenceRequests.delete(key));
  sentenceRequests.set(key, request);
  return request;
};
