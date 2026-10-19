// Sadə sənəd seqmentasiyası: bir sənəddə/səhifədə çoxlu şəxsiyyət vəsiqəsi
// ola biləcəyini nəzərə alır. FİN kodlarının mövqeyinə görə mətni bölür.
// "Bir səhifə = bir vəsiqə" fərziyyəsi edilmir.

export interface DocumentSegment {
  text: string;
  pageNumber: number | null;
}

const FIN_IN_TEXT = /\b([A-Z0-9]{7})\b/g;

function finCount(text: string): number {
  const matches = [...text.matchAll(FIN_IN_TEXT)].filter(
    (m) => /[A-Z]/.test(m[1]) && /[0-9]/.test(m[1]),
  );
  return matches.length;
}

/** Bir səhifənin mətnini FİN pəncərələrinə görə bölür. */
function splitPageByFin(text: string, pageNumber: number): DocumentSegment[] {
  const matches = [...text.matchAll(FIN_IN_TEXT)].filter(
    (m) => /[A-Z]/.test(m[1]) && /[0-9]/.test(m[1]),
  );
  if (matches.length <= 1) return [{ text, pageNumber }];

  const segments: DocumentSegment[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = i === 0 ? 0 : (matches[i].index ?? 0) - 120;
    const end = i === matches.length - 1 ? text.length : (matches[i + 1].index ?? text.length) - 120;
    segments.push({ text: text.slice(Math.max(0, start), Math.max(0, end)).trim(), pageNumber });
  }
  return segments;
}

/**
 * Səhifə mətnlərini ayrı-ayrı şəxsiyyət sənədi seqmentlərinə bölür.
 * Bir səhifədə bir neçə FİN varsa, həmin səhifə bölünür.
 */
export function segmentDocument(pages: string[]): DocumentSegment[] {
  const segments: DocumentSegment[] = [];
  pages.forEach((pageText, idx) => {
    const text = pageText.trim();
    if (text.length < 10) return; // boş/skan səhifə
    if (finCount(text) > 1) {
      segments.push(...splitPageByFin(text, idx + 1));
    } else {
      segments.push({ text, pageNumber: idx + 1 });
    }
  });
  // Heç bir seqment yoxdursa (tamamilə skan), tək boş seqment qaytar.
  return segments;
}
