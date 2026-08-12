import { useState } from 'react';
import { QuestionType } from '../types';
import type { AnswerResult, Question } from '../types';
import { HelpDialog } from './HelpDialog';
import { LevelStars } from './LevelStars';

interface Props {
  question: Question;
  result: AnswerResult | null;
  submitting: boolean;
  loadingNext: boolean;
  /** Üst satırda gösterilen kapsam adı: konu adı, "Tümü", "♥ Favorilerim" veya "🚫 Aktif Olmayanlar". */
  scopeLabel: string;
  totalQuestions: number;
  onSubmit: (payload: {
    selectedChoiceId?: string;
    pairs?: Record<string, string>;
  }) => void;
  onNext: () => void;
  onShowNote: () => void;
  onBack: () => void;
  onToggleFavorite: () => void;
  onToggleInactive: () => void;
  onToggleStats: () => void;
  statsOpen: boolean;
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
  onSubmit,
  onNext,
  onShowNote,
  onBack,
  onToggleFavorite,
  onToggleInactive,
  onToggleStats,
  statsOpen,
  prioritizeHard,
  onPrioritizeHardChange,
}: Props) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  // leftId -> rightId eşleşmeleri
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState(false);

  const answered = result !== null;
  const isMatching = question.type === QuestionType.Matching;

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
        <span className="muted">{isMatching ? 'Eşleştirme' : 'Çoktan seçmeli'}</span>
      </div>

      <div className="question-block">
        <div className="card">
          {/* Kartın içinde üst satır: solda geri, sağda "zorlananları sık sor" */}
          <div className="card-toolbar">
            <button className="back-btn" onClick={onBack}>
              ← Konulara dön
            </button>

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
                className={`inactive-btn${question.isInactive ? ' active' : ''}`}
                onClick={onToggleInactive}
                title={question.isInactive ? 'Aktif hale getir' : 'Pasifleştir'}
                aria-label={question.isInactive ? 'Aktif hale getir' : 'Pasifleştir'}
                aria-pressed={question.isInactive}
              >
                {question.isInactive ? '🚫' : '○'}
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

          <div className="muted" style={{ marginTop: '0.7rem', fontSize: '0.85rem' }}>
            Not: {question.noteTitle}
          </div>
        </div>
      </div>
    </div>
  );
}
