import { useRef, useState } from 'react';
import { api } from '../api';
import { RichNoteEditor, type ActiveFormats, type RichNoteEditorHandle } from './RichNoteEditor';
import { Toast } from './Toast';
import type { NewChoiceInput, Topic } from '../types';

interface Props {
  open: boolean;
  topics: Topic[];
  /** Modal bir konu ekranından açıldıysa o konu önceden seçili gelir. */
  defaultTopicId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

let choiceKeySeq = 0;
interface DraftChoice extends NewChoiceInput {
  key: number;
}

function emptyChoices(): DraftChoice[] {
  return [
    { key: choiceKeySeq++, text: '', isCorrect: true },
    { key: choiceKeySeq++, text: '', isCorrect: false },
  ];
}

/** "+ Soru ekle" ile açılan, sıfırdan yeni bir soru (ve yeni not) oluşturmayı sağlayan modal. */
export function AddQuestionModal({ open, topics, defaultTopicId, onClose, onCreated }: Props) {
  const [topicId, setTopicId] = useState(defaultTopicId ?? '');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<DraftChoice[]>(emptyChoices());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({ bold: false });
  const noteEditorRef = useRef<RichNoteEditorHandle>(null);

  if (!open) return null;

  function reset() {
    setTopicId(defaultTopicId ?? '');
    setNoteTitle('');
    setNoteBody('');
    setText('');
    setChoices(emptyChoices());
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function updateChoice(key: number, patch: Partial<DraftChoice>) {
    if (patch.isCorrect !== undefined) {
      const target = choices.find((c) => c.key === key);
      if (target && target.isCorrect !== patch.isCorrect) {
        const correctCount = choices.filter((c) => c.isCorrect).length;
        const wrongCount = choices.filter((c) => !c.isCorrect).length;
        if (target.isCorrect && correctCount <= 1) {
          setError('Son doğru şık yanlış olarak işaretlenemez; en az bir doğru şık kalmalıdır.');
          return;
        }
        if (!target.isCorrect && wrongCount <= 1) {
          setError('Son yanlış şık doğru olarak işaretlenemez; en az bir yanlış şık kalmalıdır.');
          return;
        }
      }
    }
    setChoices((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function removeChoice(key: number) {
    setChoices((prev) => prev.filter((c) => c.key !== key));
  }

  function addChoice() {
    setChoices((prev) => [...prev, { key: choiceKeySeq++, text: '', isCorrect: false }]);
  }

  async function handleCreate() {
    if (!topicId) {
      setError('Bir konu seçmelisiniz.');
      return;
    }
    if (!text.trim()) {
      setError('Soru metni boş olamaz.');
      return;
    }
    const filled = choices.filter((c) => c.text.trim());
    if (filled.length < 2) {
      setError('En az iki şık girilmelidir.');
      return;
    }
    if (!filled.some((c) => c.isCorrect)) {
      setError('En az bir doğru şık işaretlenmelidir.');
      return;
    }
    if (!filled.some((c) => !c.isCorrect)) {
      setError('En az bir yanlış şık işaretlenmelidir.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createUserQuestion({
        topicId,
        noteTitle: noteTitle.trim() || null,
        noteBody: noteBody.trim() || null,
        text: text.trim(),
        choices: filled.map((c) => ({ text: c.text.trim(), isCorrect: c.isCorrect })),
      });
      onCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Soru eklenemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal edit-modal">
        <div className="modal-head">
          <h3>Yeni Soru Ekle</h3>
          <button className="icon-btn" onClick={handleClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">Konu</span>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">Konu seçin…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Soru metni</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </label>

          <label className="field">
            <span className="field-label">Not başlığı (isteğe bağlı)</span>
            <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Boş bırakılabilir" />
          </label>

          <div className="field">
            <span className="field-label">Not içeriği (isteğe bağlı)</span>
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
              id="add-question-note-body"
              value={noteBody}
              onChange={setNoteBody}
              onActiveFormatsChange={setActiveFormats}
              rows={4}
            />
          </div>

          <div className="field">
            <span className="field-label">Şıklar</span>
            <div className="edit-choice-list">
              {choices.map((choice) => (
                <div
                  key={choice.key}
                  className={`edit-choice-row${choice.isCorrect ? ' is-correct' : ' is-wrong'}`}
                >
                  <label className="edit-choice-correct" title="Doğru şık">
                    <input
                      type="checkbox"
                      checked={choice.isCorrect}
                      onChange={(e) => updateChoice(choice.key, { isCorrect: e.target.checked })}
                    />
                    <span>{choice.isCorrect ? 'Doğru cevap' : 'Yanlış cevap'}</span>
                  </label>

                  <input
                    className="edit-choice-text"
                    value={choice.text}
                    onChange={(e) => updateChoice(choice.key, { text: e.target.value })}
                    placeholder="Şık metni…"
                  />

                  <button
                    type="button"
                    className="delete-choice-btn"
                    onClick={() => removeChoice(choice.key)}
                    title="Şıkkı kaldır"
                    aria-label="Şıkkı kaldır"
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
                </div>
              ))}
            </div>

            <button type="button" className="add-choice-text-btn" onClick={addChoice}>
              + Şık ekle
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={handleClose}>Vazgeç</button>
          <button className="primary" disabled={saving} onClick={handleCreate}>
            {saving ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>
      </div>

      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
