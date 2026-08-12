import type {
  AnswerResult,
  AuthResponse,
  Note,
  Question,
  ScopeStats,
  Topic,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5080';
const TOKEN_KEY = 'quiznote.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    // API hataları { message } döndürüyor; olmadığında durum kodunu göster.
    let message = `İstek başarısız (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* gövde JSON değilse varsayılan mesaj kalır */
    }
    throw new Error(message);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  register: (email: string, displayName: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, displayName, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getTopics: () => request<Topic[]>('/api/topics'),

  /**
   * Sonsuz akış: havuzdan tek soru çeker. topicId verilmezse tüm konular havuza girer.
   * recentIds son sorulanları dışlar.
   */
  getNextQuestion: (
    opts: {
      topicId?: string | null;
      prioritizeHard?: boolean;
      favoritesOnly?: boolean;
      inactiveOnly?: boolean;
      recentIds?: string[];
    } = {},
  ) => {
    const params = new URLSearchParams({
      prioritizeHard: String(opts.prioritizeHard ?? false),
      favoritesOnly: String(opts.favoritesOnly ?? false),
      inactiveOnly: String(opts.inactiveOnly ?? false),
    });
    if (opts.topicId) params.set('topicId', opts.topicId);
    if (opts.recentIds?.length) params.set('excludeIds', opts.recentIds.join(','));

    return request<Question>(`/api/next-question?${params}`);
  },

  toggleFavorite: (questionId: string) =>
    request<{ isFavorite: boolean }>(`/api/questions/${questionId}/favorite`, {
      method: 'POST',
    }),

  toggleInactive: (questionId: string) =>
    request<{ isInactive: boolean }>(`/api/questions/${questionId}/inactive`, {
      method: 'POST',
    }),

  summary: () =>
    request<{ totalQuestions: number; favoriteCount: number; inactiveCount: number }>(
      '/api/me/summary',
    ),

  /** Soru kartının yanındaki bilgi kartı için: aktif kapsamın seviye/favori/pasif istatistikleri. */
  getScopeStats: (opts: { scope: 'topic' | 'favorites' | 'inactive' | 'all'; topicId?: string | null }) => {
    const params = new URLSearchParams({ scope: opts.scope });
    if (opts.topicId) params.set('topicId', opts.topicId);
    return request<ScopeStats>(`/api/me/scope-stats?${params}`);
  },

  getQuestionNote: (questionId: string) =>
    request<Note>(`/api/questions/${questionId}/note`),

  submitAnswer: (payload: {
    questionId: string;
    selectedChoiceId?: string | null;
    pairs?: Record<string, string> | null;
    presentedChoiceIds?: string[] | null;
  }) =>
    request<AnswerResult>('/api/answers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
