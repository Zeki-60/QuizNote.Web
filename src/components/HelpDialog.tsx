import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/// Quiz ekranındaki simgelerin ne işe yaradığını anlatan yardım penceresi.
export function HelpDialog({ open, onClose }: Props) {
  // Escape ile kapanabilsin.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="help-overlay" onClick={onClose} role="presentation">
      {/* İçeriğe tıklamak pencereyi kapatmasın. */}
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-head">
          <h3 id="help-title">Bu ekrandaki simgeler</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="help-body">
          <div className="help-item">
            <span className="help-icon">
              <span className="help-switch" aria-hidden="true">
                <span className="help-switch-thumb" />
              </span>
            </span>
            <div>
              <strong>Zorlandıklarımı sık sor</strong>
              <p>
                Açıkken yıldız sayısı düşük olan sorular daha sık karşınıza gelir, iyi
                bildikleriniz seyrekleşir. Kapalıyken tüm sorular eşit şansla gelir.
                Seviye her durumda kaydedilir; bu anahtar yalnızca soruların gelme
                sıklığını etkiler.
              </p>
            </div>
          </div>

          <div className="help-item">
            <span className="help-icon heart" aria-hidden="true">
              ♥
            </span>
            <div>
              <strong>Favoriler</strong>
              <p>
                Kalbe dokunduğunuzda soru favorilerinize eklenir. Konular ekranındaki
                <strong> ♥ Favorilerim</strong> kartından yalnızca bu soruları çalışabilirsiniz.
                Tekrar dokunmak favorilerden çıkarır.
              </p>
            </div>
          </div>

          <div className="help-item">
            <span className="help-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                <path
                  d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.6a1.5 1.5 0 0 1-1.5 1.4H8.1a1.5 1.5 0 0 1-1.5-1.4L6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <strong>Sil</strong>
              <p>
                Bu simgeye dokununca, onayınız alındıktan sonra soru ve bağlı şıklar kalıcı
                olarak silinir. Bu işlem geri alınamaz.
              </p>
            </div>
          </div>

          <div className="help-item">
            <span className="help-icon" aria-hidden="true">
              📊
            </span>
            <div>
              <strong>İstatistikler</strong>
              <p>
                İçinde bulunduğunuz konu/liste hakkında toplam soru sayısı, favori ve pasif soru
                sayıları ile seviye dağılımınızı gösteren bir panel açar.
              </p>
            </div>
          </div>

          <div className="help-item">
            <span className="help-icon" aria-hidden="true">
              ✎
            </span>
            <div>
              <strong>Düzenle</strong>
              <p>
                Sorunun metnini ve şıklarını (ekleyip çıkararak, doğru/yanlış işaretleyerek)
                değiştirebileceğiniz düzenleme ekranını açar.
              </p>
            </div>
          </div>

          <div className="help-item">
            <span className="help-icon" aria-hidden="true">
              <span className="star filled">★</span>
              <span className="star filled">★</span>
              <span className="star">☆</span>
            </span>
            <div>
              <strong>Yıldızlar (seviye)</strong>
              <p>
                Her sorudaki ustalık seviyenizi gösterir; 0 ile 5 yıldız arasında değişir.
                Doğru cevap 1 yıldız kazandırır, yanlış cevap 2 yıldız kaybettirir.
                Cevapladıktan sonra yanında görünen <strong>+1</strong> veya{' '}
                <strong>-2</strong> o soruda ne kadar değiştiğinizi belirtir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
