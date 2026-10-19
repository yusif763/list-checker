// PDF-dən mətn çıxarışı (unpdf — serverless/Node üçün, worker tələb etmir).
// Qeyd: bu, mətnli PDF-lər üçündür. Skan edilmiş (şəkil) PDF-lər OCR tələb edir
// və bu versiyada boş mətn qaytarır (manual yoxlama üçün işarələnir).

export interface PdfExtractResult {
  pageCount: number;
  pages: string[];
  fullText: string;
  /** Heç bir səhifədə mətn tapılmadısa (ehtimal skan edilmişdir). */
  likelyScanned: boolean;
}

export async function extractPdfText(data: ArrayBuffer): Promise<PdfExtractResult> {
  const { getDocumentProxy, extractText } = await import("unpdf");

  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  const pages = (Array.isArray(text) ? text : [text]).map((p) =>
    (p ?? "").replace(/\s+/g, " ").trim(),
  );

  const fullText = pages.join("\n\n");
  const likelyScanned = pages.every((p) => p.length < 10);

  return { pageCount: totalPages, pages, fullText, likelyScanned };
}
