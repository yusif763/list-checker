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
  /** Sərbəst mətndən identifikasiya məlumatını çıxarır (JSON qaytarır). */
  extractIdentity(text: string): Promise<AIExtractedIdentity>;
}

export class AIDisabledError extends Error {
  constructor(message = "AI provayderi konfiqurasiya olunmayıb.") {
    super(message);
    this.name = "AIDisabledError";
  }
}
