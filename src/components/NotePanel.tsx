import type { Note } from '../types';

interface Props {
  note: Note | null;
  open: boolean;
  loading: boolean;
  onClose: () => void;
}

/// Notun gövdesini basit markdown olarak render eder (başlık, liste, kalın, kod).
function renderBody(body: string) {
  // Backend'den CRLF (\r\n) gelebilir; \n'e normalize edilmeden regex satır
  // sonlarını yakalayamaz ve tüm not tek paragrafa düşer.
  const normalized = body.replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n{2,}/);

  return blocks.map((block, i) => {
    const trimmed = block.trim();

    if (trimmed.startsWith('### ')) {
      return <h4 key={i}>{inline(trimmed.slice(4))}</h4>;
    }
    if (trimmed.startsWith('## ')) {
      return <h4 key={i}>{inline(trimmed.slice(3))}</h4>;
    }

    const lines = trimmed.split('\n').map((l) => l.trim());
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }

    return <p key={i}>{inline(trimmed)}</p>;
  });
}

/// **kalın** ve `kod` işaretlemelerini işler.
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
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
          {!loading && note && <div className="note-body">{renderBody(note.body)}</div>}
          {!loading && !note && <p className="muted">Not bulunamadı.</p>}
        </div>
      </aside>
    </>
  );
}
