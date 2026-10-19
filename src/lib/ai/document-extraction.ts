import type { ExtractedIdentity, Gender } from "@/lib/types";
import { normalizeDate, normalizeFin, toGender } from "@/lib/validation";
import { getAIProvider } from "./index";

const FIN_REGEX = /\b([A-Z0-9]{7})\b/g;
const DATE_REGEX = /\b(\d{2}[.\/-]\d{2}[.\/-]\d{4})\b/g;

/**
 * AI olmadan mətndən deterministik (regex) çıxarış — uydurma yoxdur.
 * Nəticə həmişə manual yoxlama tələb edir, aşağı inamla.
 */
export function extractIdentityDeterministic(
  text: string,
  sourceFile: string,
  pageNumber: number | null,
): ExtractedIdentity {
  const fins = [...text.matchAll(FIN_REGEX)]
    .map((m) => m[1])
    .filter((f) => /[A-Z]/.test(f) && /[0-9]/.test(f)); // ən azı bir hərf+rəqəm
  const dates = [...text.matchAll(DATE_REGEX)].map((m) => normalizeDate(m[1]).normalized).filter(Boolean);

  const lower = text.toLocaleLowerCase("az");
  let gender: Gender | null = null;
  if (/\bkişi\b|\bmale\b/.test(lower)) gender = "MALE";
  else if (/\bqadın\b|\bfemale\b/.test(lower)) gender = "FEMALE";

  return {
    firstName: null,
    lastName: null,
    patronymic: null,
    dateOfBirth: dates[0] ?? null,
    finCode: fins[0] ? normalizeFin(fins[0]).normalized : null,
    gender,
    documentNumber: null,
    issueDate: null,
    expiryDate: null,
    issuingAuthority: null,
    confidence: fins.length ? 0.3 : 0.1,
    requiresManualReview: true,
    sourceFile,
    pageNumber,
    method: "text",
    model: null,
    rawText: text.slice(0, 2000),
  };
}

/**
 * Mətndən identifikasiya məlumatını çıxarır.
 * AI aktivdirsə onu istifadə edir (nəticəni normallaşdırır), əks halda
 * və ya xəta zamanı deterministik fallback-a keçir. Heç nə uydurulmur.
 */
export async function extractIdentity(
  text: string,
  sourceFile: string,
  pageNumber: number | null,
): Promise<ExtractedIdentity> {
  const provider = getAIProvider();

  if (!provider.isEnabled()) {
    return extractIdentityDeterministic(text, sourceFile, pageNumber);
  }

  try {
    const ai = await provider.extractIdentity(text);
    // AI dəyərlərini təhlükəsiz normallaşdır (tarix/FİN format).
    const normalizedDob = ai.dateOfBirth ? normalizeDate(ai.dateOfBirth).normalized : null;
    const normalizedFin = ai.finCode ? normalizeFin(ai.finCode).normalized : null;

    return {
      firstName: ai.firstName,
      lastName: ai.lastName,
      patronymic: ai.patronymic,
      dateOfBirth: normalizedDob ?? ai.dateOfBirth,
      finCode: normalizedFin ?? ai.finCode,
      gender: ai.gender ?? (text ? toGender(text) : null),
      documentNumber: ai.documentNumber,
      issueDate: ai.issueDate,
      expiryDate: ai.expiryDate,
      issuingAuthority: ai.issuingAuthority,
      confidence: ai.confidence,
      requiresManualReview: ai.requiresManualReview || ai.confidence < 0.7,
      sourceFile,
      pageNumber,
      method: "ai",
      model: provider.name,
      rawText: text.slice(0, 2000),
    };
  } catch {
    // AI xətası deterministik yoxlamanı dayandırmamalıdır.
    const fallback = extractIdentityDeterministic(text, sourceFile, pageNumber);
    fallback.requiresManualReview = true;
    return fallback;
  }
}
