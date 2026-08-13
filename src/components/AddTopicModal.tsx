import { useState } from 'react';
import { api } from '../api';
import { Toast } from './Toast';
import type { Topic } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (topic: Topic) => void;
}

/** "+ Konu ekle" ile açılan, yeni bir Topic oluşturmayı sağlayan basit modal. */
export function AddTopicModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) {
      setError('Konu adı boş olamaz.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const topic = await api.createTopic({ name: name.trim(), description: description.trim() || null });
      onCreated(topic);
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konu oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <h3>Yeni Konu Ekle</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">Konu adı</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Mısır Uygarlığı" />
          </label>

          <label className="field">
            <span className="field-label">Açıklama (isteğe bağlı)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Vazgeç</button>
          <button className="primary" disabled={saving} onClick={handleCreate}>
            {saving ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>
      </div>

      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
