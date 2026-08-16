import { useState } from 'react';
import type { CSSProperties } from 'react';
import { QuestionType } from '../types';
import type { AnswerResult, Question } from '../types';
import { HelpDialog } from './HelpDialog';
import { LevelStars } from './LevelStars';

interface Props {
  question: Question;
  result: AnswerResult | null;
  submitting: boolean;
  loadingNext: boolean;
  /** Üst satırda gösterilen kapsam adı: konu adı, "Tümü", "♥ Favorilerim" veya "📝 Kendi Sorularım". */
  scopeLabel: string;
  totalQuestions: number;
  /** Aktif kapsamdaki 0-100 arası başarı puanı; giriş yapılmamışsa veya henüz yüklenmemişse null. */
  scorePercent: number | null;
  /**
   * Sıra numarasıyla belirli bir soruya atlama. Yalnızca belirli bir konu içindeyken
   * (Tümü/Favorilerim/Kendi Sorularım'da değilken) dolu gelir; null ise arama
   * kutusu hiç gösterilmez.
   */
  onJumpToOrderIndex: ((orderIndex: number) => void) | null;
  onSubmit: (payload: {
    selectedChoiceId?: string;
    pairs?: Record<string, string>;
  }) => void;
  onNext: () => void;
  onShowNote: () => void;
  onBack: () => void;
  onToggleFavorite: () => void;
  /** Soruyu kalıcı olarak siler; kullanıcı onayı bu bileşen içinde alınır. */
  onDelete: () => void;
  onToggleStats: () => void;
  statsOpen: boolean;
  onEdit: () => void;
  prioritizeHard: boolean;
  onPrioritizeHardChange: (value: boolean) => void;
}

export function QuestionCard({
  question,
  result,
  submitting,
  loadingNext,
  scopeLabel,
  totalQuestions,
  scorePercent,
  onJumpToOrderIndex,
  onSubmit,
  onNext,
  onShowNote,
  onBack,
  onToggleFavorite,
  onDelete,
  onToggleStats,
  statsOpen,
  onEdit,
  prioritizeHard,
  onPrioritizeHardChange,
}: Props) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  // leftId -> rightId eşleşmeleri
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // App.tsx bu bileşeni her yeni soruda questionSeq key'iyle yeniden mount ettiği için,
  // başlangıç değeri o an ekrandaki sorunun sıra numarasını otomatik gösterir.
  const [orderIndexInput, setOrderIndexInput] = useState(
    question.orderIndex > 0 ? String(question.orderIndex) : '',
  );

  const answered = result !== null;
  const isMatching = question.type === QuestionType.Matching;

  /** Sıra numarası kutusunda Enter'a basılınca veya "Git" tıklanınca tetiklenir. */
  function handleJumpToOrderIndex() {
    const parsed = Number(orderIndexInput);
    if (!onJumpToOrderIndex || !orderIndexInput.trim() || !Number.isInteger(parsed) || parsed < 1) return;
    onJumpToOrderIndex(parsed);
    setOrderIndexInput('');
  }

  /** Eşleştirmede son çift seçilince otomatik gönderir. */
  function handlePairChange(leftId: string, rightId: string) {
    if (answered || submitting) return;

    const next = { ...pairs, [leftId]: rightId };
    setPairs(next);

    if (Object.keys(next).length === question.matchLefts.length) {
      onSubmit({ pairs: next });
    }
  }

  /** Çoktan seçmelide şıkka tıklanınca hemen gönderir; ayrı bir onay adımı yok. */
  function handleChoiceClick(choiceId: string) {
    if (answered || submitting) return;

    setSelectedChoiceId(choiceId);
    onSubmit({ selectedChoiceId: choiceId });
  }

  function choiceClass(choiceId: string) {
    if (!answered) return `choice${selectedChoiceId === choiceId ? ' selected' : ''}`;
    if (choiceId === result.correctChoiceId) return 'choice correct';
    if (choiceId === selectedChoiceId) return 'choice wrong';
    return 'choice';
  }

  function matchRowClass(leftId: string) {
    if (!answered || !result.correctPairs) return 'match-row';
    return pairs[leftId] === result.correctPairs[leftId] ? 'match-row correct' : 'match-row wrong';
  }

  return (
    <div>
      <div className="row quiz-head">
        <span className="muted">
          <strong className="scope-label">{scopeLabel}</strong>
          {` · Toplam soru: ${totalQuestions}`}
        </span>

        {onJumpToOrderIndex && (
          <div className="order-index-jump">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="Soru no"
              value={orderIndexInput}
              onChange={(e) => setOrderIndexInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJumpToOrderIndex();
              }}
              aria-label="Soru sıra numarasına git"
              title="Bu konudaki bir sorunun sıra numarasını girip Enter'a basın"
            />
            <button type="button" onClick={handleJumpToOrderIndex} disabled={!orderIndexInput.trim()}>
              Git
            </button>
          </div>
        )}

        <span className="muted">{isMatching ? 'Eşleştirme' : 'Çoktan seçmeli'}</span>
      </div>

      <div className="question-block">
        <div className="card">
          {/* Kartın içinde üst satır: solda geri, sağda "zorlananları sık sor" */}
          <div className="card-toolbar">
            <button className="back-btn" onClick={onBack}>
              ← Konulara dön
            </button>

            {scorePercent !== null && (
              <span
                className={`scope-score scope-score--${scoreTier(scorePercent)}`}
                title="Bu kapsamdaki ortalama başarı puanınız"
                style={{ '--score-percent': `${scorePercent}%` } as CSSProperties}
              >
                <span className="scope-score-ring" aria-hidden="true" />
                <span className="scope-score-value">{scorePercent}</span>
                <span className="scope-score-max">/100</span>
              </span>
            )}

            <div className="toolbar-right">
              <label className="switch-row" title="Bir sonraki soruda geçerli olur">
                <input
                  type="checkbox"
                  checked={prioritizeHard}
                  onChange={(e) => onPrioritizeHardChange(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label">Zorlandıklarımı sık sor</span>
              </label>

              <button
                className="help-btn"
                onClick={() => setHelpOpen(true)}
                title="Simgeler ne anlama geliyor?"
                aria-label="Yardım"
              >
                ?
              </button>
            </div>
          </div>

          <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

          {confirmDeleteOpen && (
            <div className="modal-backdrop" onClick={() => setConfirmDeleteOpen(false)} role="presentation">
              <div
                className="modal"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <h3>Soruyu Sil</h3>
                  <button className="icon-btn" onClick={() => setConfirmDeleteOpen(false)} aria-label="Kapat">
                    ✕
                  </button>
                </div>

                <div className="modal-body">
                  <p style={{ margin: 0 }}>Bu soruyu silmek istediğinize emin misiniz?</p>
                  <p className="muted" style={{ marginTop: '0.5rem' }}>
                    Soru ve bağlı şıklar kalıcı olarak silinir; bu işlem geri alınamaz.
                  </p>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setConfirmDeleteOpen(false)}>Vazgeç</button>
                  <button
                    className="danger"
                    onClick={() => {
                      setConfirmDeleteOpen(false);
                      onDelete();
                    }}
                  >
                    Evet, Sil
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="question-head">
            <h2 className="question-text">{question.text}</h2>

            <div className="question-meta">
              <button
                className={`fav-btn${question.isFavorite ? ' active' : ''}`}
                onClick={onToggleFavorite}
                title={question.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                aria-label={question.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                aria-pressed={question.isFavorite}
              >
                {question.isFavorite ? '♥' : '♡'}
              </button>

              <button
                className="delete-question-btn"
                onClick={() => setConfirmDeleteOpen(true)}
                title="Soruyu sil"
                aria-label="Soruyu sil"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                  <path
                    d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.6a1.5 1.5 0 0 1-1.5 1.4H8.1a1.5 1.5 0 0 1-1.5-1.4L6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                className={`stats-btn${statsOpen ? ' active' : ''}`}
                onClick={onToggleStats}
                title="İstatistikleri göster"
                aria-label="İstatistikleri göster"
                aria-pressed={statsOpen}
              >
                📊
              </button>

              <button
                className="edit-btn"
                onClick={onEdit}
                title="Soruyu düzenle"
                aria-label="Soruyu düzenle"
              >
                ✎
              </button>

              {/* Cevaptan sonra güncel seviye, öncesinde sorunun mevcut seviyesi gösterilir. */}
              <LevelStars
                level={answered && result.level != null ? result.level : question.level}
                maxLevel={question.maxLevel}
                previousLevel={answered ? result.previousLevel : null}
              />
            </div>
          </div>

          {isMatching ? (
            <div className="match-grid">
              {question.matchLefts.map((left) => (
                <div key={left.id} className={matchRowClass(left.id)}>
                  <div className="match-left">{left.leftText}</div>
                  <span className="match-arrow muted">→</span>
                  <select
                    value={pairs[left.id] ?? ''}
                    disabled={answered}
                    onChange={(e) => handlePairChange(left.id, e.target.value)}
                  >
                    <option value="">Seçin…</option>
                    {question.matchRights.map((right) => (
                      <option key={right.id} value={right.id}>
                        {right.rightText}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <div className="choices">
              {question.choices.map((choice) => (
                <button
                  key={choice.id}
                  className={choiceClass(choice.id)}
                  disabled={answered || submitting}
                  onClick={() => handleChoiceClick(choice.id)}
                >
                  <span>{choice.text}</span>
                  {answered && choice.id === result.correctChoiceId && (
                    <span className="choice-mark">✓</span>
                  )}
                  {answered &&
                    choice.id === selectedChoiceId &&
                    choice.id !== result.correctChoiceId && <span className="choice-mark">✕</span>}
                </button>
              ))}
            </div>
          )}

          <div className="actions">
            {/* Notu her zaman açabilmeli — cevaptan önce de takılınca bakılabilsin. */}
            <button onClick={onShowNote}>📄 İlgili notu göster</button>

            {/*
              Sonraki soru her zaman görünür: soru cevaplanmadan da tıklanabilir,
              bu durumda mevcut soru için herhangi bir işlem yapılmadan bir sonrakine geçilir.
            */}
            <button className="primary next-btn" disabled={loadingNext} onClick={onNext}>
              {loadingNext ? 'Yükleniyor…' : 'Sonraki soru →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Puan rozetinin rengini belirleyen eşik: düşük/orta/yüksek başarı. */
function scoreTier(percent: number): 'low' | 'mid' | 'high' {
  if (percent < 40) return 'low';
  if (percent < 75) return 'mid';
  return 'high';
}
