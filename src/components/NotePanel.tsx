import { renderNoteBody } from '../markdownRender';
import type { Note } from '../types';

interface Props {
  note: Note | null;
  open: boolean;
  loading: boolean;
  onClose: () => void;
}

export function NotePanel({ note, open, loading, onClose }: Props) {
  return (
    <>
      {/* Panelin dışına tıklanınca kapatır; panel kapalıyken tıklamayı engellemesin diye DOM'dan kaldırılır. */}
      {open && (
        <div className="note-panel-backdrop" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={`note-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="note-panel-head">
          <div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              İlgili not
            </div>
            <h3>{loading ? 'Yükleniyor…' : (note?.title ?? '')}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Notu kapat">
            ✕
          </button>
        </div>

        <div className="note-panel-body">
          {loading && <p className="muted">Not getiriliyor…</p>}
          {!loading && note && <div className="note-body">{renderNoteBody(note.body)}</div>}
          {!loading && !note && <p className="muted">Not bulunamadı.</p>}
        </div>
      </aside>
    </>
  );
}
