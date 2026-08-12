import type { ScopeStats } from '../types';

interface Props {
  stats: ScopeStats | null;
  open: boolean;
  scopeLabel: string;
  onClose: () => void;
}

/** Soru kartındaki 📊 ikonuna tıklanınca sağdan açılan istatistik paneli. */
export function StatsPanel({ stats, open, scopeLabel, onClose }: Props) {
  return (
    <>
      {/* Panelin dışına tıklanınca kapatır; panel kapalıyken tıklamayı engellemesin diye DOM'dan kaldırılır. */}
      {open && (
        <div className="note-panel-backdrop" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={`stats-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="stats-panel-head">
          <div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              İstatistikler
            </div>
            <h3>{scopeLabel}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="İstatistikleri kapat">
            ✕
          </button>
        </div>

        <div className="stats-panel-body">
          {!stats && <p className="muted">Yükleniyor…</p>}

          {stats && (
            <>
              <div className="scope-stats-row">
                <span className="muted">Toplam soru</span>
                <span>{stats.totalQuestions}</span>
              </div>
              <div className="scope-stats-row">
                <span className="muted">♥ Favori</span>
                <span>{stats.favoriteCount}</span>
              </div>
              <div className="scope-stats-row">
                <span className="muted">🚫 Aktif olmayan</span>
                <span>{stats.inactiveCount}</span>
              </div>

              <div className="scope-stats-levels">
                <span className="muted">Seviyelere göre soru sayısı</span>
                <div className="scope-stats-level-list">
                  {stats.levelCounts.map((count, level) => (
                    <div key={level} className="scope-stats-row">
                      <span className="muted">Seviye {level}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
