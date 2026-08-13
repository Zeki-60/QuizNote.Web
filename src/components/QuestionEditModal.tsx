import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { RichNoteEditor, type ActiveFormats, type RichNoteEditorHandle } from './RichNoteEditor';
import { Toast } from './Toast';
import type { ChoiceEdit, QuestionEdit } from '../types';

interface Props {
  questionId: string | null;
  onClose: () => void;
  /** Kaydetme sonrası çağrılır; App.tsx aktif soruyu tazelemek için kullanabilir. */
  onSaved: () => void;
}

/** Yerel taslak: sunucudan gelen QuestionEdit + kaydedilmemiş metin alanları. */
type Draft = QuestionEdit;

export function QuestionEditModal({ questionId, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newChoiceText, setNewChoiceText] = useState('');
  const [newChoiceCorrect, setNewChoiceCorrect] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({ bold: false });
  const noteEditorRef = useRef<RichNoteEditorHandle>(null);

  useEffect(() => {
    if (!questionId) {
      setDraft(null);
      return;
    }

    setLoading(true);
    setError(null);
    api
      .getQuestionForEdit(questionId)
      .then(setDraft)
      .catch((err) => setError(err instanceof Error ? err.message : 'Soru yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [questionId]);

  if (!questionId) return null;

  const correctCount = draft?.choices.filter((c) => c.isCorrect).length ?? 0;
  const wrongCount = draft?.choices.filter((c) => !c.isCorrect).length ?? 0;

  async function saveQuestion() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        api.updateQuestion(draft.id, {
          text: draft.text,
          isNegative: draft.isNegative,
          explanation: draft.explanation,
        }),
        api.updateNote(draft.noteId, { title: draft.noteTitle, body: draft.noteBody }),
      ]);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddChoice() {
    if (!draft || !newChoiceText.trim()) return;
    try {
      const created = await api.addChoice(draft.id, {
        text: newChoiceText.trim(),
        isCorrect: newChoiceCorrect,
      });
      setDraft({ ...draft, choices: [...draft.choices, created] });
      setNewChoiceText('');
      setNewChoiceCorrect(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şık eklenemedi.');
    }
  }

  async function handleUpdateChoice(choice: ChoiceEdit) {
    if (!draft) return;

    const original = draft.choices.find((c) => c.id === choice.id);
    if (original && original.isCorrect !== choice.isCorrect) {
      if (original.isCorrect && correctCount <= 1) {
        setError('Son doğru şık yanlış olarak işaretlenemez; en az bir doğru şık kalmalıdır.');
        return;
      }
      if (!original.isCorrect && wrongCount <= 1) {
        setError('Son yanlış şık doğru olarak işaretlenemez; en az bir yanlış şık kalmalıdır.');
        return;
      }
    }

    try {
      await api.updateChoice(choice.id, { text: choice.text, isCorrect: choice.isCorrect });
      setDraft({
        ...draft,
        choices: draft.choices.map((c) => (c.id === choice.id ? choice : c)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şık güncellenemedi.');
      // Sunucu reddettiyse (örn. son doğru şık) listeyi tazeleyip gerçek durumu göster.
      if (draft) {
        api.getQuestionForEdit(draft.id).then(setDraft).catch(() => {});
      }
    }
  }

  async function handleDeleteChoice(choiceId: string) {
    if (!draft) return;

    const target = draft.choices.find((c) => c.id === choiceId);
    if (target?.isCorrect && correctCount <= 1) {
      setError('Son doğru şık silinemez; en az bir doğru şık kalmalıdır.');
      setConfirmDeleteId(null);
      return;
    }
    if (target && !target.isCorrect && wrongCount <= 1) {
      setError('Son yanlış şık silinemez; en az bir yanlış şık kalmalıdır.');
      setConfirmDeleteId(null);
      return;
    }

    try {
      await api.deleteChoice(choiceId);
      setDraft({ ...draft, choices: draft.choices.filter((c) => c.id !== choiceId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şık silinemedi.');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal edit-modal">
        <div className="modal-head">
          <h3>Soruyu Düzenle</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="muted">Yükleniyor…</p>}

          {draft && !loading && (
            <>
              <label className="field">
                <span className="field-label">Soru metni</span>
                <textarea
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                  rows={3}
                />
              </label>

              <div className="field">
                <span className="field-label">İlgili not</span>
                <input
                  className="note-title-input"
                  value={draft.noteTitle}
                  onChange={(e) => setDraft({ ...draft, noteTitle: e.target.value })}
                  placeholder="Not başlığı"
                />
                <div className="format-btn-group">
                  <button
                    type="button"
                    className={`bold-btn${activeFormats.bold ? ' active' : ''}`}
                    onClick={() => noteEditorRef.current?.applyBold()}
                    title="Seçili metni kalınlaştır"
                  >
                    <strong>B</strong> Kalın
                  </button>
                </div>
                <RichNoteEditor
                  ref={noteEditorRef}
                  id="edit-note-body"
                  value={draft.noteBody}
                  onChange={(text) => setDraft({ ...draft, noteBody: text })}
                  onActiveFormatsChange={setActiveFormats}
                  rows={8}
                />
              </div>

              <div className="field">
                <span className="field-label">Şıklar</span>
                <div className="edit-choice-list">
                  {draft.choices.map((choice) => (
                    <div
                      key={choice.id}
                      className={`edit-choice-row${choice.isCorrect ? ' is-correct' : ' is-wrong'}`}
                    >
                      <label className="edit-choice-correct" title="Doğru şık">
                        <input
                          type="checkbox"
                          checked={choice.isCorrect}
                          onChange={(e) =>
                            handleUpdateChoice({ ...choice, isCorrect: e.target.checked })
                          }
                        />
                        <span>{choice.isCorrect ? 'Doğru cevap' : 'Yanlış cevap'}</span>
                      </label>

                      <input
                        className="edit-choice-text"
                        value={choice.text}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            choices: draft.choices.map((c) =>
                              c.id === choice.id ? { ...c, text: e.target.value } : c,
                            ),
                          })
                        }
                        onBlur={() => handleUpdateChoice(choice)}
                      />

                      {confirmDeleteId === choice.id ? (
                        <span className="confirm-delete">
                          Silinsin mi?
                          <button type="button" onClick={() => handleDeleteChoice(choice.id)}>
                            Evet
                          </button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)}>
                            Vazgeç
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="delete-choice-btn"
                          onClick={() => setConfirmDeleteId(choice.id)}
                          title="Şıkkı sil"
                          aria-label="Şıkkı sil"
                        >
                          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
                            <path
                              d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.6a1.5 1.5 0 0 1-1.5 1.4H8.1a1.5 1.5 0 0 1-1.5-1.4L6 6"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="edit-choice-row add-choice-row">
                  <label className="edit-choice-correct" title="Doğru şık">
                    <input
                      type="checkbox"
                      checked={newChoiceCorrect}
                      onChange={(e) => setNewChoiceCorrect(e.target.checked)}
                    />
                    <span>{newChoiceCorrect ? 'Doğru cevap' : 'Yanlış cevap'}</span>
                  </label>

                  <input
                    className="edit-choice-text"
                    placeholder="Yeni şık metni…"
                    value={newChoiceText}
                    onChange={(e) => setNewChoiceText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddChoice();
                    }}
                  />
                  <button
                    type="button"
                    className="add-choice-btn"
                    onClick={handleAddChoice}
                    disabled={!newChoiceText.trim()}
                    title="Şık ekle"
                    aria-label="Şık ekle"
                  >
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                      <path
                        d="M10 4v12M4 10h12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Vazgeç</button>
          <button className="primary" disabled={saving || !draft} onClick={saveQuestion}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
