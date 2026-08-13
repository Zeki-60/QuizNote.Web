import type { ScopeStats } from '../types';

interface Props {
  stats: ScopeStats | null;
  open: boolean;
  scopeLabel: string;
  onClose: () => void;
}

/** Soru kartındaki 📊 ikonuna tıklanınca sağdan açılan istatistik paneli. */
export function StatsPanel({ stats, open, scopeLabel, onClose }: Props) {
  const maxLevelCount = stats ? Math.max(1, ...stats.levelCounts) : 1;

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
              <div className="stat-tiles">
                <div className="stat-tile">
                  <span className="stat-tile-icon" aria-hidden="true">
                    <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                      <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6.5 10h7M10 6.5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="stat-tile-value">{stats.totalQuestions}</span>
                  <span className="stat-tile-label">Toplam</span>
                </div>

                <div className="stat-tile stat-tile-fav">
                  <span className="stat-tile-icon" aria-hidden="true">
                    ♥
                  </span>
                  <span className="stat-tile-value">{stats.favoriteCount}</span>
                  <span className="stat-tile-label">Favori</span>
                </div>

                <div className="stat-tile stat-tile-inactive">
                  <span className="stat-tile-icon" aria-hidden="true">
                    <svg viewBox="0 0 20 20" width="17" height="17" fill="none">
                      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 15 15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="stat-tile-value">{stats.inactiveCount}</span>
                  <span className="stat-tile-label">Aktif olmayan</span>
                </div>
              </div>

              <div className="stats-section">
                <span className="stats-section-title">Seviyelere göre dağılım</span>
                <div className="level-bar-list">
                  {stats.levelCounts.map((count, level) => (
                    <div key={level} className="level-bar-row">
                      <span className="level-bar-label">Sv {level}</span>
                      <div className="level-bar-track">
                        <div
                          className={`level-bar-fill level-bar-fill-${level}`}
                          style={{ width: `${(count / maxLevelCount) * 100}%` }}
                        />
                      </div>
                      <span className="level-bar-value">{count}</span>
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
