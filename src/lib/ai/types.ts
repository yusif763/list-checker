import { z } from "zod";

/** AI-nin çıxardığı identifikasiya sahələri (sxemlə yoxlanılır). */
export const ExtractedIdentitySchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  patronymic: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  finCode: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).nullable(),
  documentNumber: z.string().nullable(),
  issueDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  issuingAuthority: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  requiresManualReview: z.boolean(),
});

export type AIExtractedIdentity = z.infer<typeof ExtractedIdentitySchema>;

/** Provayderdən asılı olmayan AI interfeysi. */
export interface AIProvider {
  readonly name: string;
  /** Açar konfiqurasiya olunub və AI aktivdir? */
  isEnabled(): boolean;
  /**
   * Sistem + istifadəçi promptu göndərir və JSON cavabı (parse edilmiş) qaytarır.
   * Çağıran tərəf nəticəni Zod ilə yoxlamalıdır — AI çıxışına güvənilmir.
   */
  chatJson(systemPrompt: string, userPrompt: string): Promise<unknown>;
  /** Provayder şəkil (vision) girişini dəstəkləyirmi? */
  supportsVision(): boolean;
  /**
   * Şəkil(lər) + mətn promptu göndərir və JSON cavabı qaytarır (vision OCR).
   * images: data URL-lər (data:image/jpeg;base64,...).
   */
  chatVisionJson(systemPrompt: string, userText: string, imageDataUrls: string[]): Promise<unknown>;
}

export class AIDisabledError extends Error {
  constructor(message = "AI provayderi konfiqurasiya olunmayıb.") {
    super(message);
    this.name = "AIDisabledError";
  }
}
