import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface RichNoteEditorHandle {
  applyBold: () => void;
}

/** İmlecin/seçimin bulunduğu konumda kalın biçiminin aktif olup olmadığını bildirir (buton vurgusu için). */
export interface ActiveFormats {
  bold: boolean;
}

interface Props {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  /** İmleç/seçim değiştikçe, o noktada kalının aktif olup olmadığını bildirir. */
  onActiveFormatsChange?: (formats: ActiveFormats) => void;
}

/** contentEditable içindeki tek bir düğümü kalın/kod/liste sözdizimine çevirir. */
function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(serializeNode).join('');

  switch (el.tagName) {
    case 'STRONG':
    case 'B':
      return inner.trim() ? `**${inner}**` : inner;
    case 'CODE':
      return `\`${inner}\``;
    case 'DIV':
    case 'P':
      return `${inner}\n\n`;
    case 'UL':
      return Array.from(el.children).map((li) => `- ${serializeNode(li)}`).join('\n') + '\n\n';
    case 'LI':
      return inner;
    case 'BR':
      return '\n';
    case 'H4':
      return `## ${inner}\n\n`;
    default:
      return inner;
  }
}

/** contentEditable kökünün tüm çocuklarını sözdizimine çevirir, fazla boş satırları sadeleştirir. */
function serializeRoot(root: HTMLElement): string {
  const raw = Array.from(root.childNodes).map(serializeNode).join('');
  return raw.replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unescapeHtml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function inlineToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const parts = escaped.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return `<strong>${inlineToHtml(unescapeHtml(part.slice(2, -2)))}</strong>`;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return `<code>${part.slice(1, -1)}</code>`;
      }
      return part;
    })
    .join('');
}

/** Sözdizimi metnini (**kalın**, listeler, başlıklar) contentEditable HTML'ine çevirir. */
function valueToHtml(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n{2,}/).filter((b) => b.trim());

  if (blocks.length === 0) return '<p><br></p>';

  return blocks
    .map((block) => {
      const trimmed = block.trim();

      if (trimmed.startsWith('### ')) return `<h4>${inlineToHtml(trimmed.slice(4))}</h4>`;
      if (trimmed.startsWith('## ')) return `<h4>${inlineToHtml(trimmed.slice(3))}</h4>`;

      const lines = trimmed.split('\n').map((l) => l.trim());
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        const items = lines.map((l) => `<li>${inlineToHtml(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }

      return `<p>${inlineToHtml(trimmed)}</p>`;
    })
    .join('');
}

/** commonAncestorContainer'dan yukarı doğru, editör kökünü aşmadan en yakın STRONG atasını bulur. */
function findBoldAncestor(root: HTMLElement, start: Node): HTMLElement | null {
  let node: Node | null = start.nodeType === Node.ELEMENT_NODE ? start : start.parentElement;

  while (node && node !== root) {
    const el = node as HTMLElement;
    if (el.tagName === 'STRONG') return el;
    node = el.parentElement;
  }
  return null;
}

/**
 * Not içeriği için zengin metin editörü: kalın uygulandığında kullanıcı ham
 * **işaretleri** görmez, gerçek kalın metni görür. Dışa doğru `value`/`onChange`
 * hâlâ düz sözdizimi metnidir (backend'e bu haliyle kaydedilir). Kalın butonu
 * dışarıdan (modal düzeyinde) ref üzerinden tetiklenir.
 */
export const RichNoteEditor = forwardRef<RichNoteEditorHandle, Props>(function RichNoteEditor(
  { id, value, onChange, rows = 6, onActiveFormatsChange },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null);
  // Son dışarı bildirilen değer; prop value ile kendi input'umuz çakışıp
  // imleci sıçratmasın diye karşılaştırma için tutulur.
  const lastValueRef = useRef<string | null>(null);

  // İmleç/seçim editör içindeyken hareket ettikçe kalının aktif olup olmadığını
  // bildirir; kalın butonu bunu "basılı" göstermek için kullanır.
  useEffect(() => {
    if (!onActiveFormatsChange) return;

    function handleSelectionChange() {
      const el = elRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        onActiveFormatsChange!({ bold: false });
        return;
      }

      const range = sel.getRangeAt(0);
      const anchor = range.collapsed ? sel.anchorNode! : range.commonAncestorContainer;
      onActiveFormatsChange!({ bold: findBoldAncestor(el, anchor) != null });
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [onActiveFormatsChange]);

  // Yalnızca dışarıdan value, bizim ürettiğimizden farklı bir şeye değiştiyse
  // (örn. soru ilk yüklendiğinde veya dışarıdan sıfırlandığında) yeniden çizilir.
  useEffect(() => {
    if (!elRef.current) return;
    if (value === lastValueRef.current) return;

    lastValueRef.current = value;
    elRef.current.innerHTML = valueToHtml(value);
  }, [value]);

  function handleInput() {
    if (!elRef.current) return;
    const next = serializeRoot(elRef.current);
    lastValueRef.current = next;
    onChange(next);
  }

  /** Seçili aralıkla kesişen TÜM STRONG elemanlarını bulur (yalnızca seçimi birebir kapsayanı değil). */
  function findIntersecting(root: HTMLElement, selRange: Range): HTMLElement[] {
    const matches: HTMLElement[] = [];
    const candidates = root.querySelectorAll<HTMLElement>('strong');

    for (const el of candidates) {
      const elRange = document.createRange();
      elRange.selectNodeContents(el);

      const intersects =
        selRange.compareBoundaryPoints(Range.END_TO_START, elRange) < 0 &&
        selRange.compareBoundaryPoints(Range.START_TO_END, elRange) > 0;

      if (intersects) matches.push(el);
    }

    return matches;
  }

  /** Bir elemanı, çocuklarını yerine bırakarak kaldırır (unwrap). */
  function unwrap(el: HTMLElement) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  /**
   * İmleç bir metin düğümünün içindeyse ve o düğüm kalın değilse, imlecin
   * bulunduğu "kelimeyi" (boşluk ile ayrılan en yakın bloğu) kapsayan bir Range
   * döner. Böylece kullanıcı hiçbir şey seçmeden butona bastığında da makul bir
   * aralık kalınlaştırılır (çoğu editördeki "imleçteyken Kalın" davranışı).
   */
  function wordRangeAtCaret(startContainer: Node, offset: number): Range | null {
    if (startContainer.nodeType !== Node.TEXT_NODE) return null;
    const text = startContainer.textContent ?? '';
    if (!text.trim()) return null;

    const isBoundary = (ch: string) => /\s/.test(ch);

    let start = offset;
    while (start > 0 && !isBoundary(text[start - 1])) start--;
    let end = offset;
    while (end < text.length && !isBoundary(text[end])) end++;

    if (start === end) return null;

    const range = document.createRange();
    range.setStart(startContainer, start);
    range.setEnd(startContainer, end);
    return range;
  }

  /**
   * Seçili metni STRONG ile sarar. Seçim, kalın bir parçayla en az kesişiyorsa
   * (baştan/sondan taşarak seçilmiş olsa bile) kesişen TÜM parçalar tamamen
   * kaldırılır — kısmi seçimde de kalınlık komple temizlenir. Seçimde hiç
   * kesişim yoksa yeni kalınlık uygulanır.
   *
   * Seçim yokken (imleç sadece bir noktadaysa): imleç kalın metnin içindeyse
   * hiçbir metin seçmeye gerek kalmadan kalınlığın tamamı kaldırılır; imleç
   * düz bir yerdeyse imlecin bulunduğu kelime otomatik seçilip kalınlaştırılır.
   */
  function applyBold() {
    const root = elRef.current;
    if (!root) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    if (sel.isCollapsed) {
      const wrapperEl = findBoldAncestor(root, range.startContainer);
      if (wrapperEl) {
        unwrap(wrapperEl);
        root.normalize();
        handleInput();
        return;
      }

      const wordRange = wordRangeAtCaret(range.startContainer, range.startOffset);
      if (!wordRange) return;
      range = wordRange;
    }

    const intersecting = findIntersecting(root, range);

    if (intersecting.length > 0) {
      // Seçim kalın bir parçaya değiyorsa, o parçaların tamamı kaldırılır.
      intersecting.forEach(unwrap);
      root.normalize();
    } else {
      const wrapper = document.createElement('strong');
      try {
        range.surroundContents(wrapper);
      } catch {
        // Seçim birden fazla elemanı kısmen kapsıyorsa surroundContents başarısız
        // olabilir; bu durumda seçili düğümler çıkarılıp wrapper'a taşınır.
        const extracted = range.extractContents();
        wrapper.appendChild(extracted);
        range.insertNode(wrapper);
      }
    }

    handleInput();
  }

  useImperativeHandle(ref, () => ({ applyBold }));

  return (
    <div
      id={id}
      ref={elRef}
      className="rich-note-editor"
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      style={{ minHeight: `${rows * 1.6}em` }}
    />
  );
});
