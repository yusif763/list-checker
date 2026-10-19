import type { ValidationIssue } from "@/lib/types";

const FIN_PATTERN = /^[A-Z0-9]{7}$/;

export interface FieldValidation {
  /** Normallaşdırılmış dəyər (təhlükəsiz çevrilmələrdən sonra). */
  normalized: string | null;
  issues: ValidationIssue[];
}

/**
 * FİN kodu yoxlaması: 7 simvol, böyük hərf + rəqəm.
 * Kiçik hərfləri böyüdür, artıq boşluqları silir. Heç nə uydurmur.
 */
export function normalizeFin(raw: string | null | undefined): FieldValidation {
  const issues: ValidationIssue[] = [];
  const original = raw ?? "";
  const trimmed = original.trim();

  if (!trimmed) {
    return {
      normalized: null,
      issues: [
        {
          field: "finCode",
          code: "fin.empty",
          message: "FİN kodu boşdur.",
          severity: "error",
          originalValue: original || null,
          suggestion: null,
        },
      ],
    };
  }

  // Təhlükəsiz normallaşdırma: daxili boşluqları sil, böyüt.
  const normalized = trimmed.replace(/\s+/g, "").toUpperCase();

  if (normalized !== trimmed) {
    // Yalnız formatlaşma dəyişikliyi — təhlükəsiz düzəliş təklifi.
  }

  if (normalized.length !== 7) {
    issues.push({
      field: "finCode",
      code: "fin.invalid-length",
      message: `FİN kodu 7 simvol olmalıdır (indi ${normalized.length} simvol).`,
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
  } else if (!FIN_PATTERN.test(normalized)) {
    issues.push({
      field: "finCode",
      code: "fin.invalid-chars",
      message: "FİN kodu yalnız böyük latın hərfləri və rəqəmlərdən ibarət olmalıdır.",
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
  } else if (normalized !== trimmed) {
    issues.push({
      field: "finCode",
      code: "fin.normalizable",
      message: "FİN kodu böyük hərflərlə və boşluqsuz yazılmalıdır.",
      severity: "warning",
      originalValue: original,
      suggestion: normalized,
    });
  }

  return { normalized, issues };
}

export function isValidFin(value: string): boolean {
  return FIN_PATTERN.test(value.trim().toUpperCase());
}
