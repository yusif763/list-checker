import type { ExtractedIdentity, Gender } from "@/lib/types";
import { normalizeDate, normalizeFin, toGender } from "@/lib/validation";
import { getAIProvider } from "./index";
import { ExtractedIdentitySchema } from "./types";

const FIN_REGEX = /\b([A-Z0-9]{7})\b/g;
const DATE_REGEX = /\b(\d{2}[.\/-]\d{2}[.\/-]\d{4})\b/g;

const IDENTITY_SYSTEM_PROMPT = `Sən Azərbaycan şəxsiyyət vəsiqələrindən məlumat çıxaran dəqiq köməkçisən.
Verilən mətndən yalnız AÇIQ-AŞKAR görünən sahələri çıxar. Heç bir məlumatı UYDURMA.
Tapılmayan və ya oxunmayan sahələr üçün null qaytar.
Tarixləri GG.AA.İİİİ formatında ver. Cins: MALE, FEMALE və ya UNKNOWN.
Yalnız aşağıdakı JSON sxemi ilə cavab ver:
{
  "firstName": string|null,
  "lastName": string|null,
  "patronymic": string|null,
  "dateOfBirth": string|null,
  "finCode": string|null,
  "gender": "MALE"|"FEMALE"|"UNKNOWN"|null,
  "documentNumber": string|null,
  "issueDate": string|null,
  "expiryDate": string|null,
  "issuingAuthority": string|null,
  "confidence": number (0..1),
  "requiresManualReview": boolean
}`;

const IDENTITY_VISION_PROMPT = `Sən Azərbaycan şəxsiyyət vəsiqələrini (foto/skan) oxuyan dəqiq OCR köməkçisisən.
Şəkildəki şəxsiyyət vəsiqəsindən YALNIZ açıq görünən məlumatları oxu. Heç nə UYDURMA.
Vəsiqənin ön və arxa tərəfi, latın və kiril hərfləri ola bilər — hamısını nəzərə al.
Oxunmayan sahələr üçün null qaytar. Tarixləri GG.AA.İİİİ formatında ver.
Cins: kişi→MALE, qadın→FEMALE, bilinmirsə UNKNOWN.
Yalnız bu JSON sxemi ilə cavab ver:
{
  "firstName": string|null, "lastName": string|null, "patronymic": string|null,
  "dateOfBirth": string|null, "finCode": string|null,
  "gender": "MALE"|"FEMALE"|"UNKNOWN"|null, "documentNumber": string|null,
  "issueDate": string|null, "expiryDate": string|null, "issuingAuthority": string|null,
  "confidence": number(0..1), "requiresManualReview": boolean
}`;

function mapAiIdentity(
  ai: ReturnType<typeof ExtractedIdentitySchema.parse>,
  sourceFile: string,
  pageNumber: number | null,
  method: ExtractedIdentity["method"],
  model: string | null,
  rawText?: string,
): ExtractedIdentity {
  const normalizedDob = ai.dateOfBirth ? normalizeDate(ai.dateOfBirth).normalized : null;
  const normalizedFin = ai.finCode ? normalizeFin(ai.finCode).normalized : null;
  return {
    firstName: ai.firstName,
    lastName: ai.lastName,
    patronymic: ai.patronymic,
    dateOfBirth: normalizedDob ?? ai.dateOfBirth,
    finCode: normalizedFin ?? ai.finCode,
    gender: ai.gender,
    documentNumber: ai.documentNumber,
    issueDate: ai.issueDate,
    expiryDate: ai.expiryDate,
    issuingAuthority: ai.issuingAuthority,
    confidence: ai.confidence,
    requiresManualReview: ai.requiresManualReview || ai.confidence < 0.6,
    sourceFile,
    pageNumber,
    method,
    model,
    rawText,
  };
}

/**
 * Şəkildən (ID kartı foto/skan) vision OCR ilə identifikasiya çıxarır.
 * AI deaktiv/vision yoxdursa xəta atır (çağıran manual review placeholder qoyur).
 */
export async function extractIdentityFromImage(
  imageDataUrls: string[],
  sourceFile: string,
  pageNumber: number | null,
): Promise<ExtractedIdentity> {
  const provider = getAIProvider();
  if (!provider.isEnabled() || !provider.supportsVision()) {
    throw new Error("Vision AI əlçatan deyil.");
  }
  const raw = await provider.chatVisionJson(
    IDENTITY_VISION_PROMPT,
    "Bu şəkildəki şəxsiyyət vəsiqəsini oxu və JSON qaytar.",
    imageDataUrls,
  );
  const ai = ExtractedIdentitySchema.parse(raw);
  return mapAiIdentity(ai, sourceFile, pageNumber, "ai", `${provider.name}-vision`);
}

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
    .filter((f) => /[A-Z]/.test(f) && /[0-9]/.test(f));
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
 * AI aktivdirsə onu istifadə edir (nəticəni Zod ilə yoxlayır və normallaşdırır),
 * əks halda və ya xəta zamanı deterministik fallback-a keçir. Heç nə uydurulmur.
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
    const raw = await provider.chatJson(
      IDENTITY_SYSTEM_PROMPT,
      `Şəxsiyyət vəsiqəsi mətni:\n\n${text.slice(0, 6000)}`,
    );
    const ai = ExtractedIdentitySchema.parse(raw);

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
