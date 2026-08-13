import { useEffect } from 'react';

interface Props {
  message: string | null;
  onDone: () => void;
  /** Milisaniye cinsinden görünme süresi. */
  duration?: number;
}

/**
 * Form hatalarını viewport'un tam ortasında, modalın üzerinde kısa süreliğine
 * gösterip kendiliğinden kapanan bir bildirim. `message` null olduğunda hiçbir
 * şey render etmez; her yeni mesajda süre sıfırdan başlar.
 */
export function Toast({ message, onDone, duration = 3000 }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
    // onDone her render'da yeniden oluşabilir; sadece message/duration değişince
    // zamanlayıcı sıfırlanmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, duration]);

  if (!message) return null;

  return (
    <div className="toast-overlay" role="alert">
      <div className="toast-box">
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6.5v4M10 13.2v.05" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}
