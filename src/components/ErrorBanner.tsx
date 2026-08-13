interface Props {
  message: string;
  /** "error" (kırmızı, form hatası) veya "warning" (sarı, geri dönüşü olmayan işlem uyarısı). */
  variant?: 'error' | 'warning';
}

/** Modallardaki form hatalarını/uyarılarını göstermek için kullanılan ikonlu bant. */
export function ErrorBanner({ message, variant = 'error' }: Props) {
  return (
    <div className={`error-banner error-banner-${variant}`} role="alert">
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.5v4M10 13.2v.05" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
