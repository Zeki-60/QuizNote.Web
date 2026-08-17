import { useCallback, useEffect, useState } from 'react';
import { api, setSessionExpiredHandler, tokenStore } from './api';
import { AddQuestionModal } from './components/AddQuestionModal';
import { AddTopicModal } from './components/AddTopicModal';
import { AuthForm } from './components/AuthForm';
import { DeleteTopicModal } from './components/DeleteTopicModal';
import { EditTopicModal } from './components/EditTopicModal';
import { NotePanel } from './components/NotePanel';
import { QuestionCard } from './components/QuestionCard';
import { QuestionEditModal } from './components/QuestionEditModal';
import { StatsPanel } from './components/StatsPanel';
import { Toast } from './components/Toast';
import type { AnswerResult, AuthResponse, Note, Question, ScopeStats, Topic } from './types';

type View = 'topics' | 'quiz';

const USER_KEY = 'quiznote.user';
const PRIORITIZE_KEY = 'quiznote.prioritizeHard';
const THEME_KEY = 'quiznote.theme';

type Theme = 'dark' | 'light';

/** Aynı soru üst üste gelmesin diye hatırlanan son soru sayısı. */
const RECENT_MEMORY = 3;

export default function App() {
  const [user, setUser] = useState<AuthResponse | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw && tokenStore.get() ? (JSON.parse(raw) as AuthResponse) : null;
  });

  /** 401 nedeniyle otomatik çıkış yapıldığında giriş ekranında gösterilecek uyarı. */
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const [view, setView] = useState<View>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [summary, setSummary] = useState({
    totalQuestions: 0,
    favoriteCount: 0,
    myQuestionsCount: 0,
  });
  const [topicsError, setTopicsError] = useState<string | null>(null);

  /** Seçili konu; null ise tüm konular havuza girer. */
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [myQuestionsOnly, setMyQuestionsOnly] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  /** Favori/pasif işlemlerinden sonra birkaç saniyeliğine gösterilen bilgi mesajı. */
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Son sorulan soruların id'leri; tekrarı önlemek için sunucuya gönderilir. */
  const [recentIds, setRecentIds] = useState<string[]>([]);
  /** Her yeni soru çekilişinde artar; QuestionCard'ı sıfırlamak için key olarak kullanılır. */
  const [questionSeq, setQuestionSeq] = useState(0);

  const [note, setNote] = useState<Note | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);

  /** İstatistikler paneli: aktif kapsamın seviye/favori/pasif dağılımı. */
  const [scopeStats, setScopeStats] = useState<ScopeStats | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  /** Soru düzenleme modalı: açıkken düzenlenen sorunun id'si, kapalıyken null. */
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);

  // "Zorlandıklarımı daha sık sor" tercihi; tarayıcıda saklanır.
  const [prioritizeHard, setPrioritizeHard] = useState(
    () => localStorage.getItem(PRIORITIZE_KEY) === 'true',
  );

  function togglePrioritizeHard(value: boolean) {
    setPrioritizeHard(value);
    localStorage.setItem(PRIORITIZE_KEY, String(value));
  }

  // Tema tercihi: kayıtlı değer yoksa işletim sistemi ayarına uyulur.
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const loadTopics = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        api.getTopics(),
        api
          .summary()
          .catch(() => ({ totalQuestions: 0, favoriteCount: 0, myQuestionsCount: 0 })),
      ]);
      setTopics(list);
      setSummary(sum);
      setTopicsError(null);
    } catch (err) {
      setTopicsError(err instanceof Error ? err.message : 'Konular yüklenemedi.');
    }
  }, []);

  useEffect(() => {
    if (user) void loadTopics();
  }, [user, loadTopics]);

  // Tarayıcının geri tuşu quiz'den çıkıp konulara dönsün, siteden çıkmasın.
  useEffect(() => {
    if (view === 'topics') return;

    if (!window.history.state?.quizView) {
      window.history.pushState({ quizView: true }, '');
    }

    const onPopState = () => backToTopics();

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // backToTopics her render'da yeniden oluştuğu için bağımlılığa eklenmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function handleAuthenticated(auth: AuthResponse) {
    tokenStore.set(auth.token);
    localStorage.setItem(USER_KEY, JSON.stringify(auth));
    setUser(auth);
    setSessionExpiredMessage(null);
  }

  function handleLogout() {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
    resetQuiz();
    setView('topics');
  }

  // Sunucu 401 döndürdüğünde (token süresi dolmuş) kullanıcıyı otomatik çıkışa
  // düşür ve giriş ekranında bunu belirten bir mesaj göster.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      tokenStore.clear();
      localStorage.removeItem(USER_KEY);
      setUser(null);
      resetQuiz();
      setView('topics');
      setSessionExpiredMessage('Oturumunuz sona erdi; lütfen tekrar giriş yapın.');
    });
    return () => setSessionExpiredHandler(null);
    // resetQuiz her render'da yeniden oluştuğu için bağımlılığa eklenmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Soru çözme ekranındaki aktif kapsamı (refreshScopeStats ile aynı öncelik sırasıyla) belirler. */
  function currentExportScope(): { scope: 'topic' | 'favorites' | 'myQuestions' | 'all'; topicId?: string | null } {
    if (favoritesOnly) return { scope: 'favorites' };
    if (myQuestionsOnly) return { scope: 'myQuestions' };
    if (activeTopic) return { scope: 'topic', topicId: activeTopic.id };
    return { scope: 'all' };
  }

  async function handleDownloadQuestions() {
    try {
      await api.downloadQuestionsExport(currentExportScope());
    } catch (err) {
      // Sessiz geçilebilir bir işlem; hata olursa kısa bir uyarı yeterli.
      window.alert(err instanceof Error ? err.message : 'İndirme başarısız oldu.');
    }
  }

  function resetQuiz() {
    setActiveTopic(null);
    setFavoritesOnly(false);
    setMyQuestionsOnly(false);
    setQuestion(null);
    setResult(null);
    setRecentIds([]);
    setQuizError(null);
    setNoteOpen(false);
    setNote(null);
    setScopeStats(null);
    setStatsOpen(false);
  }

  function backToTopics() {
    resetQuiz();
    setView('topics');
    void loadTopics();
  }

  /// Butonla dönüşte quiz için eklenen geçmiş kaydı da geri alınır.
  function leaveQuiz() {
    if (window.history.state?.quizView) window.history.back();
    else backToTopics();
  }

  /// Havuzdan sonraki soruyu çeker. Sonsuz akış: bitiş yok.
  /// topic null ise tüm konular havuza girer. orderIndex verilirse rastgelelik
  /// devre dışı kalır; yalnızca o sıra numaralı soru istenir.
  async function loadNextQuestion(
    topic: Topic | null,
    opts: { favoritesOnly: boolean; myQuestionsOnly: boolean; recent: string[]; orderIndex?: number | null },
  ) {
    setLoadingQuestion(true);
    setQuizError(null);

    try {
      const q = await api.getNextQuestion({
        topicId: topic?.id ?? null,
        prioritizeHard,
        favoritesOnly: opts.favoritesOnly,
        myQuestionsOnly: opts.myQuestionsOnly,
        recentIds: opts.recent,
        orderIndex: opts.orderIndex,
      });

      setQuestion(q);
      setResult(null);
      setNote(null);
      setNoteOpen(false);
      setRecentIds((prev) => [q.id, ...prev].slice(0, RECENT_MEMORY));
      // Aynı soru tekrar gelse bile kart sıfırdan kurulsun (seçim temizlensin).
      setQuestionSeq((n) => n + 1);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Soru yüklenemedi.');
      setQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  }

  /** Aktif kapsamın (konu/favoriler/kendi sorularım/tümü) bilgi kartını tazeler. */
  async function refreshScopeStats(
    topic: Topic | null,
    opts: { favoritesOnly: boolean; myQuestionsOnly: boolean },
  ) {
    const scope = opts.favoritesOnly
      ? 'favorites'
      : opts.myQuestionsOnly
        ? 'myQuestions'
        : topic
          ? 'topic'
          : 'all';
    try {
      setScopeStats(await api.getScopeStats({ scope, topicId: topic?.id ?? null }));
    } catch {
      setScopeStats(null);
    }
  }

  /// topic null ise tüm konulardan sorulur. mode: 'all' | 'favorites' | 'myQuestions'.
  async function startTopic(
    topic: Topic | null,
    mode: 'all' | 'favorites' | 'myQuestions' = 'all',
  ) {
    const onlyFavorites = mode === 'favorites';
    const onlyMyQuestions = mode === 'myQuestions';
    setActiveTopic(topic);
    setFavoritesOnly(onlyFavorites);
    setMyQuestionsOnly(onlyMyQuestions);
    setRecentIds([]);
    setView('quiz');
    const opts = { favoritesOnly: onlyFavorites, myQuestionsOnly: onlyMyQuestions };
    await Promise.all([
      loadNextQuestion(topic, { ...opts, recent: [] }),
      refreshScopeStats(topic, opts),
    ]);
  }

  async function submitAnswer(payload: {
    selectedChoiceId?: string;
    pairs?: Record<string, string>;
  }) {
    if (!question) return;
    setSubmitting(true);

    try {
      const res = await api.submitAnswer({
        questionId: question.id,
        selectedChoiceId: payload.selectedChoiceId ?? null,
        pairs: payload.pairs ?? null,
        // Şıklar havuzdan rastgele geldiği için ekranda hangileri vardı, sunucuya bildirilir.
        presentedChoiceIds: question.choices.map((c) => c.id),
      });

      setResult(res);
      // Cevap yanıtı notu zaten taşıyor; panel açılırsa ek istek gerekmez.
      setNote(res.note);
      // Seviye değişmiş olabilir; bilgi kartındaki dağılım güncellensin.
      void refreshScopeStats(activeTopic, { favoritesOnly, myQuestionsOnly });
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Cevap gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function nextQuestion() {
    // Favori modunda son favori de çıkarılmışsa havuz boşalır; kullanıcıyı boş
    // ekranda bırakmamak için normal akışa düşülür.
    if (favoritesOnly && summary.favoriteCount === 0) {
      setFavoritesOnly(false);
      await loadNextQuestion(activeTopic, {
        favoritesOnly: false,
        myQuestionsOnly,
        recent: recentIds,
      });
      return;
    }

    // Kendi sorularım modunda son soru da silinmişse havuz boşalır; aynı fallback uygulanır.
    if (myQuestionsOnly && summary.myQuestionsCount === 0) {
      setMyQuestionsOnly(false);
      await loadNextQuestion(activeTopic, {
        favoritesOnly,
        myQuestionsOnly: false,
        recent: recentIds,
      });
      return;
    }

    await loadNextQuestion(activeTopic, { favoritesOnly, myQuestionsOnly, recent: recentIds });
  }

  /**
   * Belirli bir sıra numarasındaki soruya atlar. Yalnızca belirli bir konu içindeyken
   * (Tümü/Favorilerim/Kendi Sorularım'da değilken) kullanılabilir; QuestionCard bu
   * şartı zaten kontrol edip alanı yalnızca o durumda gösterir.
   */
  async function jumpToOrderIndex(orderIndex: number) {
    await loadNextQuestion(activeTopic, {
      favoritesOnly: false,
      myQuestionsOnly: false,
      recent: recentIds,
      orderIndex,
    });
  }

  /** Düzenleme modalından kaydedince ekrandaki soru metnini ve (açıksa) notu günceller. */
  async function refreshEditedQuestion() {
    if (!question) return;
    try {
      const edited = await api.getQuestionForEdit(question.id);
      setQuestion((q) => (q ? { ...q, text: edited.text, noteTitle: edited.noteTitle } : q));
      if (note && note.id === edited.noteId) {
        setNote({ ...note, title: edited.noteTitle, body: edited.noteBody });
      }
    } catch {
      // Sessizce geç; kullanıcı isterse "Sonraki soru" ile zaten güncel veriyi görür.
    }
  }

  async function toggleFavorite() {
    if (!question) return;

    try {
      const { isFavorite } = await api.toggleFavorite(question.id);
      setQuestion((q) => (q ? { ...q, isFavorite } : q));
      // Konular ekranındaki "Favorilerim" kartı bu sayıya bakıyor; anında güncellenir
      // ki quiz'den dönünce kart doğru durumda olsun.
      setSummary((s) => ({
        ...s,
        favoriteCount: Math.max(0, s.favoriteCount + (isFavorite ? 1 : -1)),
      }));
      void refreshScopeStats(activeTopic, { favoritesOnly, myQuestionsOnly });
      setActionToast(isFavorite ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.');
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Favori güncellenemedi.');
    }
  }

  /** Sorunun seviyesini doğrudan maksimuma ayarlar. */
  async function setMaxLevel() {
    if (!question) return;

    try {
      const { level } = await api.setMaxLevel(question.id);
      setQuestion((q) => (q ? { ...q, level } : q));

       // Soru zaten cevaplanmışsa LevelStars result.level'ı gösterir; o da güncellensin.
      setResult((r) => (r ? { ...r, level } : r));


      // Puan (scorePercent) seviyeye bağlı; bilgi kartı ve rozet güncellensin.
      void refreshScopeStats(activeTopic, { favoritesOnly, myQuestionsOnly });
      setActionToast('Seviye maksimuma çıkarıldı.');
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Seviye güncellenemedi.');
    }
  }

  /** Soruyu kalıcı olarak siler; onay QuestionCard içinde alınır. */
  async function deleteQuestion() {
    if (!question) return;

    try {
      await api.deleteQuestion(question.id);
      setSummary((s) => ({
        ...s,
        totalQuestions: Math.max(0, s.totalQuestions - 1),
        favoriteCount: question.isFavorite ? Math.max(0, s.favoriteCount - 1) : s.favoriteCount,
        // Sorunun kendi sahipliği ekrana taşınmıyor; "Kendi Sorularım" kapsamındaysak
        // gösterilen soru zaten kullanıcıya ait demektir.
        myQuestionsCount: myQuestionsOnly ? Math.max(0, s.myQuestionsCount - 1) : s.myQuestionsCount,
      }));
      setActionToast('Soru silindi.');
      // Silinen sorunun yerine sonraki soru yüklenir; havuz boşalmışsa nextQuestion
      // ilgili fallback'i (favoritesOnly/myQuestionsOnly kapatma) zaten uyguluyor.
      await nextQuestion();
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Soru silinemedi.');
    }
  }

  /** Not panelini açar; zaten açıksa kapatır. */
  async function showNote() {
    if (noteOpen) {
      setNoteOpen(false);
      return;
    }

    // Aynı anda iki panel açık olmasın: notu açarken istatistikleri kapat.
    setStatsOpen(false);
    setNoteOpen(true);
    if (note || !question) return;

    setNoteLoading(true);
    try {
      setNote(await api.getQuestionNote(question.id));
    } catch {
      setNote(null);
    } finally {
      setNoteLoading(false);
    }
  }

  /// Koyu/açık tema anahtarı; topbar'da kullanılır.
  const themeSwitch = (
    <label
      className="theme-switch"
      title={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
    >
      <input
        type="checkbox"
        checked={theme === 'light'}
        onChange={(e) => setTheme(e.target.checked ? 'light' : 'dark')}
        aria-label="Açık tema"
      />
      {/* İkon, hareketli topun içinde taşınır. */}
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb">
          <span className="theme-icon">{theme === 'light' ? '☀' : '☾'}</span>
        </span>
      </span>
    </label>
  );

  if (!user) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            Quiz<span>Note</span>
          </div>
          <div className="topbar-right">{themeSwitch}</div>
        </header>
        <main className="content">
          {sessionExpiredMessage && <p className="error">{sessionExpiredMessage}</p>}
          <AuthForm onAuthenticated={handleAuthenticated} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Quiz<span>Note</span>
        </div>
        <div className="topbar-right">
          <span>{user.displayName}</span>
          {view === 'quiz' && (
            <button
              className="icon-btn download-btn"
              onClick={() => void handleDownloadQuestions()}
              title="Bu kapsamdaki soruları indir (.txt)"
              aria-label="Bu kapsamdaki soruları indir"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                <path
                  d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 15.5h12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          {themeSwitch}
          <button onClick={handleLogout}>Çıkış</button>
        </div>
      </header>

      <main className="content">
        {view === 'topics' && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h1 style={{ margin: 0 }}>Konular</h1>
              <div className="row" style={{ gap: '0.6rem' }}>
                <button className="fab-action fab-action--ghost" onClick={() => setAddQuestionOpen(true)}>
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                    <path
                      d="M6 5h8a1 1 0 0 1 1 1v9.2a.8.8 0 0 1-1.24.67L10 14l-3.76 1.87A.8.8 0 0 1 5 15.2V6a1 1 0 0 1 1-1Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M8 8.2h4M8 10.4h2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="15" cy="6" r="3.4" className="fab-action-badge" />
                    <path d="M15 4.6v2.8M13.6 6h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Soru ekle
                </button>
                <button className="fab-action" onClick={() => setAddTopicOpen(true)}>
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                    <path
                      d="M4 5.5A1.5 1.5 0 0 1 5.5 4h3.1a1.5 1.5 0 0 1 1.06.44l1.4 1.4A1.5 1.5 0 0 0 12.12 6H14.5A1.5 1.5 0 0 1 16 7.5v7A1.5 1.5 0 0 1 14.5 16h-9A1.5 1.5 0 0 1 4 14.5v-9Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M10 9.2v4M8 11.2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Konu ekle
                </button>
              </div>
            </div>

            {topicsError && <p className="error">{topicsError}</p>}

            {topics.length === 0 && !topicsError && (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                  Henüz konu eklenmemiş. Sorular veritabanına eklendiğinde burada listelenecek.
                </p>
              </div>
            )}

            <div className="topic-grid">
              {/* Sıra sabit: 1) Tümü, 2) Favorilerim, 3) Kendi Sorularım, sonra konular. */}
              <button
                className="card topic-card all-card"
                disabled={summary.totalQuestions === 0}
                title="Tüm konulardan karışık sor"
                onClick={() => void startTopic(null)}
              >
                <strong>Tümü</strong>
              </button>

              <button
                className="card topic-card fav-card"
                disabled={summary.favoriteCount === 0}
                title={
                  summary.favoriteCount === 0
                    ? 'Henüz favori sorunuz yok'
                    : 'Sadece favori soruları çalış'
                }
                onClick={() => void startTopic(null, 'favorites')}
              >
                <strong>♥ Favorilerim</strong>
              </button>

              <button
                className="card topic-card my-questions-card"
                disabled={summary.myQuestionsCount === 0}
                title={
                  summary.myQuestionsCount === 0
                    ? 'Henüz kendi eklediğiniz bir soru yok'
                    : 'Sadece kendi eklediğiniz soruları çalış'
                }
                onClick={() => void startTopic(null, 'myQuestions')}
              >
                <strong>📝 Kendi Sorularım</strong>
              </button>

              {topics.map((topic) => (
                <div key={topic.id} className="card topic-card topic-card-editable">
                  <button
                    type="button"
                    className="topic-card-main"
                    onClick={() => void startTopic(topic)}
                  >
                    <strong>{topic.name}</strong>
                  </button>

                  <div className="topic-card-actions">
                    <button
                      type="button"
                      className="topic-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTopic(topic);
                      }}
                      title="Konuyu düzenle"
                      aria-label="Konuyu düzenle"
                    >
                      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                        <path
                          d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="topic-action-btn topic-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingTopic(topic);
                      }}
                      title="Konuyu sil"
                      aria-label="Konuyu sil"
                    >
                      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                        <path
                          d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.6a1.5 1.5 0 0 1-1.5 1.4H8.1a1.5 1.5 0 0 1-1.5-1.4L6 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'quiz' && (
          <>
            {quizError && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <p className="error" style={{ margin: 0 }}>{quizError}</p>
                <div className="actions">
                  <button onClick={leaveQuiz}>← Konulara dön</button>
                </div>
              </div>
            )}

            {question && (
              <QuestionCard
                // Yalnızca yeni soru çekilişinde artar; cevap verildiğinde sabit
                // kalması gerekir, aksi halde seçilen şık kırmızı işaretlenemez.
                key={questionSeq}
                question={question}
                result={result}
                submitting={submitting}
                loadingNext={loadingQuestion}
                scopeLabel={
                  favoritesOnly
                    ? '♥ Favorilerim'
                    : myQuestionsOnly
                      ? '📝 Kendi Sorularım'
                      : (activeTopic?.name ?? 'Tümü')
                }
                totalQuestions={
                  favoritesOnly
                    ? summary.favoriteCount
                    : myQuestionsOnly
                      ? summary.myQuestionsCount
                      : (activeTopic?.questionCount ?? summary.totalQuestions)
                }
                scorePercent={scopeStats?.scorePercent ?? null}
                // Sıra numarasıyla arama yalnızca belirli bir konu içindeyken anlamlı;
                // Tümü/Favorilerim/Kendi Sorularım'da gösterilmez.
                onJumpToOrderIndex={
                  activeTopic && !favoritesOnly && !myQuestionsOnly
                    ? (orderIndex) => void jumpToOrderIndex(orderIndex)
                    : null
                }
                onSubmit={submitAnswer}
                onNext={() => void nextQuestion()}
                onShowNote={() => void showNote()}
                onBack={leaveQuiz}
                onToggleFavorite={() => void toggleFavorite()}
                onSetMaxLevel={() => void setMaxLevel()}
                onDelete={() => void deleteQuestion()}
                onToggleStats={() => {
                  // Aynı anda iki panel açık olmasın: istatistikleri açarken notu kapat.
                  setNoteOpen(false);
                  setStatsOpen((v) => !v);
                }}
                statsOpen={statsOpen}
                onEdit={() => setEditingQuestionId(question.id)}
                prioritizeHard={prioritizeHard}
                onPrioritizeHardChange={togglePrioritizeHard}
              />
            )}

            {!question && !quizError && (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>Soru yükleniyor…</p>
              </div>
            )}
          </>
        )}
      </main>

      <NotePanel
        note={note}
        open={noteOpen}
        loading={noteLoading}
        onClose={() => setNoteOpen(false)}
      />

      <StatsPanel
        stats={scopeStats}
        open={statsOpen}
        scopeLabel={
          favoritesOnly
            ? '♥ Favorilerim'
            : myQuestionsOnly
              ? '📝 Kendi Sorularım'
              : (activeTopic?.name ?? 'Tümü')
        }
        onClose={() => setStatsOpen(false)}
      />

      <QuestionEditModal
        questionId={editingQuestionId}
        onClose={() => setEditingQuestionId(null)}
        onSaved={() => void refreshEditedQuestion()}
      />

      <AddTopicModal
        open={addTopicOpen}
        onClose={() => setAddTopicOpen(false)}
        onCreated={(topic) => setTopics((prev) => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))}
      />

      <AddQuestionModal
        open={addQuestionOpen}
        topics={topics}
        onClose={() => setAddQuestionOpen(false)}
        onCreated={() => void loadTopics()}
      />

      <EditTopicModal
        topic={editingTopic}
        onClose={() => setEditingTopic(null)}
        onUpdated={(updated) =>
          setTopics((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name)),
          )
        }
      />

      <DeleteTopicModal
        topic={deletingTopic}
        onClose={() => setDeletingTopic(null)}
        onDeleted={(topicId) => setTopics((prev) => prev.filter((t) => t.id !== topicId))}
      />

      <Toast message={actionToast} onDone={() => setActionToast(null)} />
    </div>
  );
}
