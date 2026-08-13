import type { ReactNode } from 'react';

/**
 * Not gövdesini basit markdown olarak React node'larına çevirir
 * (başlık, liste, kalın, kod, {{renk:...}}). NotePanel (salt okunur görüntüleme)
 * ve RichNoteEditor (düzenlenebilir önizleme) aynı kuralları paylaşır.
 */
export function renderNoteBody(body: string): ReactNode[] {
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
    if (trimmed.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l))) {
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

/// **kalın**, `kod` ve {{renk:metin}} işaretlemelerini işler.
export function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\{\{(?:red|blue|green):[^}]+\}\})/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // İçerik tekrar inline()'a beslenir ki kalın+renk bir arada kullanılabilsin.
      return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const colorMatch = /^\{\{(red|blue|green):([^}]+)\}\}$/.exec(part);
    if (colorMatch) {
      // İçerik tekrar inline()'a beslenir ki renk+kalın bir arada kullanılabilsin
      // (örn. {{red:**önemli**}} hem kırmızı hem kalın gösterilebilsin).
      return (
        <span key={i} className={`note-color-${colorMatch[1]}`}>
          {inline(colorMatch[2])}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
