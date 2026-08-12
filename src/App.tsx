import { useCallback, useEffect, useState } from 'react';
import { api, tokenStore } from './api';
import { AuthForm } from './components/AuthForm';
import { NotePanel } from './components/NotePanel';
import { QuestionCard } from './components/QuestionCard';
import { StatsPanel } from './components/StatsPanel';
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

  const [view, setView] = useState<View>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [summary, setSummary] = useState({ totalQuestions: 0, favoriteCount: 0, inactiveCount: 0 });
  const [topicsError, setTopicsError] = useState<string | null>(null);

  /** Seçili konu; null ise tüm konular havuza girer. */
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
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
        api.summary().catch(() => ({ totalQuestions: 0, favoriteCount: 0, inactiveCount: 0 })),
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
  }

  function handleLogout() {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
    resetQuiz();
    setView('topics');
  }

  function resetQuiz() {
    setActiveTopic(null);
    setFavoritesOnly(false);
    setInactiveOnly(false);
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
  /// topic null ise tüm konular havuza girer.
  async function loadNextQuestion(
    topic: Topic | null,
    opts: { favoritesOnly: boolean; inactiveOnly: boolean; recent: string[] },
  ) {
    setLoadingQuestion(true);
    setQuizError(null);

    try {
      const q = await api.getNextQuestion({
        topicId: topic?.id ?? null,
        prioritizeHard,
        favoritesOnly: opts.favoritesOnly,
        inactiveOnly: opts.inactiveOnly,
        recentIds: opts.recent,
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

  /** Aktif kapsamın (konu/favoriler/aktif olmayanlar/tümü) bilgi kartını tazeler. */
  async function refreshScopeStats(
    topic: Topic | null,
    opts: { favoritesOnly: boolean; inactiveOnly: boolean },
  ) {
    const scope = opts.inactiveOnly ? 'inactive' : opts.favoritesOnly ? 'favorites' : topic ? 'topic' : 'all';
    try {
      setScopeStats(await api.getScopeStats({ scope, topicId: topic?.id ?? null }));
    } catch {
      setScopeStats(null);
    }
  }

  /// topic null ise tüm konulardan sorulur. mode: 'all' | 'favorites' | 'inactive'.
  async function startTopic(topic: Topic | null, mode: 'all' | 'favorites' | 'inactive' = 'all') {
    const onlyFavorites = mode === 'favorites';
    const onlyInactive = mode === 'inactive';
    setActiveTopic(topic);
    setFavoritesOnly(onlyFavorites);
    setInactiveOnly(onlyInactive);
    setRecentIds([]);
    setView('quiz');
    await Promise.all([
      loadNextQuestion(topic, { favoritesOnly: onlyFavorites, inactiveOnly: onlyInactive, recent: [] }),
      refreshScopeStats(topic, { favoritesOnly: onlyFavorites, inactiveOnly: onlyInactive }),
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
      void refreshScopeStats(activeTopic, { favoritesOnly, inactiveOnly });
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
      await loadNextQuestion(activeTopic, { favoritesOnly: false, inactiveOnly, recent: recentIds });
      return;
    }

    // Aktif olmayanlar modunda son pasif soru da aktif edilmişse havuz boşalır;
    // aynı şekilde normal akışa düşülür.
    if (inactiveOnly && summary.inactiveCount === 0) {
      setInactiveOnly(false);
      await loadNextQuestion(activeTopic, { favoritesOnly, inactiveOnly: false, recent: recentIds });
      return;
    }

    await loadNextQuestion(activeTopic, { favoritesOnly, inactiveOnly, recent: recentIds });
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
      void refreshScopeStats(activeTopic, { favoritesOnly, inactiveOnly });
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Favori güncellenemedi.');
    }
  }

  async function toggleInactive() {
    if (!question) return;

    try {
      const { isInactive } = await api.toggleInactive(question.id);
      setQuestion((q) => (q ? { ...q, isInactive } : q));
      // "Aktif Olmayanlar" kartı bu sayıya bakıyor; anında güncellenir ki quiz'den
      // dönünce kart doğru durumda olsun.
      setSummary((s) => ({
        ...s,
        inactiveCount: Math.max(0, s.inactiveCount + (isInactive ? 1 : -1)),
      }));
      void refreshScopeStats(activeTopic, { favoritesOnly, inactiveOnly });
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Durum güncellenemedi.');
    }
  }

  async function showNote() {
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
          {themeSwitch}
          <button onClick={handleLogout}>Çıkış</button>
        </div>
      </header>

      <main className="content">
        {view === 'topics' && (
          <>
            <h1 style={{ marginTop: 0 }}>Konular</h1>

            {topicsError && <p className="error">{topicsError}</p>}

            {topics.length === 0 && !topicsError && (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                  Henüz konu eklenmemiş. Sorular veritabanına eklendiğinde burada listelenecek.
                </p>
              </div>
            )}

            <div className="topic-grid">
              {/* Sıra sabit: 1) Tümü, 2) Favorilerim, 3) Aktif Olmayanlar, sonra konular. */}
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
                className="card topic-card inactive-card"
                disabled={summary.inactiveCount === 0}
                title={
                  summary.inactiveCount === 0
                    ? 'Henüz aktif olmayan sorunuz yok'
                    : 'Sadece aktif olmayan soruları çalış'
                }
                onClick={() => void startTopic(null, 'inactive')}
              >
                <strong>🚫 Aktif Olmayanlar</strong>
              </button>

              {topics.map((topic) => (
                <button
                  key={topic.id}
                  className="card topic-card"
                  onClick={() => void startTopic(topic)}
                >
                  <strong>{topic.name}</strong>
                </button>
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
                  inactiveOnly
                    ? '🚫 Aktif Olmayanlar'
                    : favoritesOnly
                      ? '♥ Favorilerim'
                      : (activeTopic?.name ?? 'Tümü')
                }
                totalQuestions={
                  inactiveOnly
                    ? summary.inactiveCount
                    : favoritesOnly
                      ? summary.favoriteCount
                      : (activeTopic?.questionCount ?? summary.totalQuestions)
                }
                onSubmit={submitAnswer}
                onNext={() => void nextQuestion()}
                onShowNote={() => void showNote()}
                onBack={leaveQuiz}
                onToggleFavorite={() => void toggleFavorite()}
                onToggleInactive={() => void toggleInactive()}
                onToggleStats={() => {
                  // Aynı anda iki panel açık olmasın: istatistikleri açarken notu kapat.
                  setNoteOpen(false);
                  setStatsOpen((v) => !v);
                }}
                statsOpen={statsOpen}
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
          inactiveOnly
            ? '🚫 Aktif Olmayanlar'
            : favoritesOnly
              ? '♥ Favorilerim'
              : (activeTopic?.name ?? 'Tümü')
        }
        onClose={() => setStatsOpen(false)}
      />
    </div>
  );
}
