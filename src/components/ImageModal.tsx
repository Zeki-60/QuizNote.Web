import { useEffect, useRef, useState } from 'react';
import { api, BASE_URL } from '../api';
import { Toast } from './Toast';
import type { QuestionImage } from '../types';

interface Props {
  /** Açıkken düzenlenen sorunun id'si, kapalıyken null. */
  questionId: string | null;
  /** Sorunun şu anki resim URL'i (varsa); modal açılışta bunu gösterir. */
  imageUrl: string | null;
  onClose: () => void;
  /** Resim bağlandığında/kaldırıldığında çağrılır; App.tsx ekrandaki soruyu günceller. */
  onImageChange: (imageUrl: string | null) => void;
}

type Tab = 'view' | 'upload' | 'search';

/**
 * Soru kartının dışındaki "Resim ekle" / "Resmi gör" butonuyla açılan pencere.
 * Sorunun mevcut resmi varsa gösterir; yoksa bilgisayardan yükleme veya havuzdaki
 * mevcut resimlerden isimle arayıp seçme sekmeleri sunar.
 */
export function ImageModal({ questionId, imageUrl, onClose, onImageChange }: Props) {
  const [tab, setTab] = useState<Tab>(imageUrl ? 'view' : 'upload');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<QuestionImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [applying, setApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal her açıldığında (farklı bir soru için de olsa) doğru sekmeden başlasın.
  useEffect(() => {
    if (questionId) setTab(imageUrl ? 'view' : 'upload');
    // yalnızca questionId değiştiğinde sıfırlanır; imageUrl güncellemesi (resim
    // eklendikten sonra) sekmeyi geri "view"a atmamalı, onu ayrı ele alıyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  // "Mevcut resimlerden seç" sekmesi açıldığında ve arama metni değiştiğinde ara.
  useEffect(() => {
    if (tab !== 'search') return;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchImages(search)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [tab, search]);

  if (!questionId) return null;

  async function handleFileSelected(file: File) {
    if (!questionId) return;
    setUploading(true);
    setError(null);
    try {
      const image = await api.uploadImage(file);
      await api.setQuestionImage(questionId, image.id);
      onImageChange(image.url);
      setTab('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resim yüklenemedi.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePickExisting(image: QuestionImage) {
    if (!questionId) return;
    setApplying(true);
    setError(null);
    try {
      await api.setQuestionImage(questionId, image.id);
      onImageChange(image.url);
      setTab('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resim bağlanamadı.');
    } finally {
      setApplying(false);
    }
  }

  async function handleRemove() {
    if (!questionId) return;
    setRemoving(true);
    setError(null);
    try {
      await api.removeQuestionImage(questionId);
      onImageChange(null);
      setTab('upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resim kaldırılamadı.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal image-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>Soru Resmi</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {imageUrl && (
            <div className="image-modal-tabs">
              <button
                type="button"
                className={tab === 'view' ? 'active' : ''}
                onClick={() => setTab('view')}
              >
                Mevcut resim
              </button>
              <button
                type="button"
                className={tab === 'upload' ? 'active' : ''}
                onClick={() => setTab('upload')}
              >
                Bilgisayardan değiştir
              </button>
              <button
                type="button"
                className={tab === 'search' ? 'active' : ''}
                onClick={() => setTab('search')}
              >
                Havuzdan seç
              </button>
            </div>
          )}

          {!imageUrl && (
            <div className="image-modal-tabs">
              <button
                type="button"
                className={tab === 'upload' ? 'active' : ''}
                onClick={() => setTab('upload')}
              >
                Bilgisayardan ekle
              </button>
              <button
                type="button"
                className={tab === 'search' ? 'active' : ''}
                onClick={() => setTab('search')}
              >
                Mevcut resimlerden seç
              </button>
            </div>
          )}

          {tab === 'view' && imageUrl && (
            <div className="image-modal-preview">
              <img src={`${BASE_URL}${imageUrl}`} alt="Soru resmi" />
              <button className="danger" disabled={removing} onClick={() => void handleRemove()}>
                {removing ? 'Kaldırılıyor…' : 'Resmi kaldır'}
              </button>
            </div>
          )}

          {tab === 'upload' && (
            <div className="image-modal-upload">
              <p className="muted" style={{ marginTop: 0 }}>
                Bilgisayarınızdan bir resim dosyası (JPG, PNG, GIF, WEBP) seçin.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelected(file);
                }}
              />
              {uploading && <p className="muted">Yükleniyor…</p>}
            </div>
          )}

          {tab === 'search' && (
            <div className="image-modal-search">
              <input
                type="text"
                placeholder="Resim adında ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />

              {searching && <p className="muted">Aranıyor…</p>}

              {!searching && results.length === 0 && (
                <p className="muted">
                  {search.trim() ? 'Bu isimde resim bulunamadı.' : 'Henüz yüklenmiş resim yok.'}
                </p>
              )}

              {!searching && results.length > 0 && (
                <div className="image-modal-grid">
                  {results.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      className="image-modal-grid-item"
                      disabled={applying}
                      onClick={() => void handlePickExisting(img)}
                      title={img.fileName}
                    >
                      <img src={`${BASE_URL}${img.url}`} alt={img.fileName} />
                      <span>{img.fileName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
