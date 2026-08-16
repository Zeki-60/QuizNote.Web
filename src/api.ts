import type {
  AnswerResult,
  AuthResponse,
  ChoiceEdit,
  NewChoiceInput,
  Note,
  Question,
  QuestionEdit,
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

/**
 * Sunucu 401 döndürdüğünde (token süresi dolmuş/geçersiz) çağrılır. App.tsx bunu
 * kullanıcıyı otomatik çıkışa düşürüp giriş ekranına yönlendirmek için dinler.
 * İstek gönderirken zaten token yoksa (misafir kullanıcı) tetiklenmez.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    if (res.status === 401 && token) {
      onSessionExpired?.();
      throw new Error('Oturumunuz sona erdi; lütfen tekrar giriş yapın.');
    }

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

  createTopic: (payload: { name: string; description?: string | null }) =>
    request<Topic>('/api/topics', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTopic: (topicId: string, payload: { name: string; description?: string | null }) =>
    request<Topic>(`/api/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** Konuyu ve altındaki tüm not/soru/şıkları siler (cascade). */
  deleteTopic: (topicId: string) =>
    request<void>(`/api/topics/${topicId}`, {
      method: 'DELETE',
    }),

  /**
   * Sonsuz akış: havuzdan tek soru çeker. topicId verilmezse tüm konular havuza girer.
   * recentIds son sorulanları dışlar. orderIndex verilirse rastgelelik devre dışı
   * kalır; yalnızca o sıra numarasına sahip soru döner (yalnızca bir konu içindeyken
   * ve favoritesOnly/myQuestionsOnly kapalıyken kullanılabilir).
   */
  getNextQuestion: (
    opts: {
      topicId?: string | null;
      prioritizeHard?: boolean;
      favoritesOnly?: boolean;
      myQuestionsOnly?: boolean;
      recentIds?: string[];
      orderIndex?: number | null;
    } = {},
  ) => {
    const params = new URLSearchParams({
      prioritizeHard: String(opts.prioritizeHard ?? false),
      favoritesOnly: String(opts.favoritesOnly ?? false),
      myQuestionsOnly: String(opts.myQuestionsOnly ?? false),
    });
    if (opts.topicId) params.set('topicId', opts.topicId);
    if (opts.recentIds?.length) params.set('excludeIds', opts.recentIds.join(','));
    if (opts.orderIndex != null) params.set('orderIndex', String(opts.orderIndex));

    return request<Question>(`/api/next-question?${params}`);
  },

  toggleFavorite: (questionId: string) =>
    request<{ isFavorite: boolean }>(`/api/questions/${questionId}/favorite`, {
      method: 'POST',
    }),

  /** Kullanıcının bu sorudaki seviyesini doğrudan maksimuma (5) ayarlar. */
  setMaxLevel: (questionId: string) =>
    request<{ level: number; maxLevel: number }>(`/api/questions/${questionId}/max-level`, {
      method: 'POST',
    }),

  /** Bir soruyu (ve bağlı şıklarını) kalıcı olarak siler; bağlı not silinmez. */
  deleteQuestion: (questionId: string) =>
    request<void>(`/api/questions/${questionId}`, {
      method: 'DELETE',
    }),

  summary: () =>
    request<{
      totalQuestions: number;
      favoriteCount: number;
      myQuestionsCount: number;
    }>('/api/me/summary'),

  /** Soru kartının yanındaki bilgi kartı için: aktif kapsamın seviye/favori istatistikleri. */
  getScopeStats: (opts: {
    scope: 'topic' | 'favorites' | 'myQuestions' | 'all';
    topicId?: string | null;
  }) => {
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

  // --- Soru/Not düzenleme ---

  /** Düzenleme ekranı için soruyu TÜM şıklarıyla (doğru/yanlış dahil) getirir. */
  getQuestionForEdit: (questionId: string) =>
    request<QuestionEdit>(`/api/questions/${questionId}/edit`),

  updateQuestion: (questionId: string, payload: { text: string; isNegative: boolean; explanation: string | null }) =>
    request<void>(`/api/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateNote: (noteId: string, payload: { title: string; body: string }) =>
    request<void>(`/api/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  addChoice: (questionId: string, payload: { text: string; isCorrect: boolean }) =>
    request<ChoiceEdit>(`/api/questions/${questionId}/choices`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateChoice: (choiceId: string, payload: { text: string; isCorrect: boolean }) =>
    request<void>(`/api/choices/${choiceId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteChoice: (choiceId: string) =>
    request<void>(`/api/choices/${choiceId}`, {
      method: 'DELETE',
    }),

  /** Kullanıcının arayüzden yeni soru eklemesi; not her zaman yeni oluşturulur. */
  createUserQuestion: (payload: {
    topicId: string;
    noteTitle?: string | null;
    noteBody?: string | null;
    text: string;
    explanation?: string | null;
    choices: NewChoiceInput[];
  }) =>
    request<{ id: string }>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /**
   * Soru çözme ekranındaki aktif kapsama göre soruları/notları DbSeeder formatında
   * .txt olarak indirir. JSON değil düz metin döndüğü için genel request() yardımcısı
   * kullanılmaz; dosya doğrudan tarayıcıda indirilir.
   */
  downloadQuestionsExport: async (opts: {
    scope: 'topic' | 'favorites' | 'myQuestions' | 'all';
    topicId?: string | null;
  }) => {
    const token = tokenStore.get();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const params = new URLSearchParams({ scope: opts.scope });
    if (opts.topicId) params.set('topicId', opts.topicId);

    const res = await fetch(`${BASE_URL}/api/questions/export?${params}`, { headers });
    if (!res.ok) throw new Error(`İndirme başarısız (${res.status})`);

    const fileNames: Record<typeof opts.scope, string> = {
      topic: 'konu-sorulari.txt',
      favorites: 'favori-sorularim.txt',
      myQuestions: 'kendi-sorularim.txt',
      all: 'tum-sorular.txt',
    };

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNames[opts.scope];
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
