interface Props {
  level: number;
  maxLevel: number;
  /** Cevap sonrası seviye değişimini göstermek için önceki seviye. */
  previousLevel?: number | null;
}

/// Sorunun kullanıcıya özel seviyesini yıldızlarla gösterir.
export function LevelStars({ level, maxLevel, previousLevel }: Props) {
  const stars = Array.from({ length: maxLevel }, (_, i) => i < level);
  const delta = previousLevel == null ? 0 : level - previousLevel;

  return (
    <span
      className="level-stars"
      title={`Seviye ${level} / ${maxLevel}`}
      aria-label={`Seviye ${level} / ${maxLevel}`}
    >
      {stars.map((filled, i) => (
        <span key={i} className={filled ? 'star filled' : 'star'}>
          {filled ? '★' : '☆'}
        </span>
      ))}
      {/* Alan her zaman ayrılır; değer gelince yıldızlar ve soru metni kaymaz. */}
      <span
        className={`level-delta${delta > 0 ? ' up' : delta < 0 ? ' down' : ''}`}
        aria-hidden={delta === 0}
      >
        {delta > 0 ? `+${delta}` : delta < 0 ? delta : ''}
      </span>
    </span>
  );
}
