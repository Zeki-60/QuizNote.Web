import { useState } from 'react';
import { api } from '../api';
import { ErrorBanner } from './ErrorBanner';
import { Toast } from './Toast';
import type { Topic } from '../types';

interface Props {
  topic: Topic | null;
  onClose: () => void;
  onDeleted: (topicId: string) => void;
}

/** Konu kartındaki 🗑 ikonuyla açılan, silme onayı isteyen uyarı modalı. */
export function DeleteTopicModal({ topic, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!topic) return null;

  async function handleDelete() {
    if (!topic) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteTopic(topic.id);
      onDeleted(topic.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konu silinemedi.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <h3>Konuyu Sil</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p style={{ margin: 0 }}>
            <strong>"{topic.name}"</strong> konusunu silmek istiyor musunuz?
          </p>
          <ErrorBanner
            variant="warning"
            message={`Bu konu altındaki bütün sorular ve notlar da (toplam ${topic.questionCount} soru) kalıcı olarak silinecektir. Bu işlem geri alınamaz.`}
          />
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Vazgeç</button>
          <button className="danger" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Siliniyor…' : 'Evet, Sil'}
          </button>
        </div>
      </div>

      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
