import { useEffect, useState } from 'react';
import { api } from '../api';
import { Toast } from './Toast';
import type { Topic } from '../types';

interface Props {
  topic: Topic | null;
  onClose: () => void;
  onUpdated: (topic: Topic) => void;
}

/** Konu kartındaki ✎ ikonuyla açılan, konu adı/açıklamasını güncelleyen modal. */
export function EditTopicModal({ topic, onClose, onUpdated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (topic) {
      setName(topic.name);
      setDescription(topic.description ?? '');
      setError(null);
    }
  }, [topic]);

  if (!topic) return null;

  async function handleSave() {
    if (!topic) return;
    if (!name.trim()) {
      setError('Konu adı boş olamaz.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateTopic(topic.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konu güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <h3>Konuyu Düzenle</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">Konu adı</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Açıklama (isteğe bağlı)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Vazgeç</button>
          <button className="primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
