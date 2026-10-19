import type { ValidationIssue } from "@/lib/types";
import type { FieldValidation } from "./fin";

// Azərbaycan mobil operator prefiksləri.
const VALID_PREFIXES = new Set(["050", "051", "055", "070", "077", "099", "010", "060"]);

/** Yalnız rəqəmləri saxla. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Tələb olunan format: (0XX) XXX XX XX
 * 0503006677 -> (050) 300 66 77. Natamam/qeyri-müəyyən nömrələr səhv kimi işarələnir.
 */
export function normalizePhone(raw: string | null | undefined): FieldValidation {
  const issues: ValidationIssue[] = [];
  const original = raw ?? "";
  const trimmed = original.trim();

  if (!trimmed) {
    return {
      normalized: null,
      issues: [
        {
          field: "phone",
          code: "phone.empty",
          message: "Telefon nömrəsi boşdur.",
          severity: "warning",
          originalValue: original || null,
          suggestion: null,
        },
      ],
    };
  }

  let digits = digitsOnly(trimmed);

  // Ölkə kodu +994 və ya 994 varsa, çıxar.
  if (digits.startsWith("994")) {
    digits = "0" + digits.slice(3);
  }
  // Başında 0 yoxdursa və 9 rəqəmdirsə (prefiks 0-sız), əlavə et.
  if (digits.length === 9 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }

  if (digits.length !== 10) {
    issues.push({
      field: "phone",
      code: "phone.invalid-length",
      message: `Telefon nömrəsi 10 rəqəm olmalıdır (indi ${digits.length} rəqəm). Format: (0XX) XXX XX XX.`,
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
    return { normalized: null, issues };
  }

  const prefix = digits.slice(0, 3);
  if (!VALID_PREFIXES.has(prefix)) {
    issues.push({
      field: "phone",
      code: "phone.invalid-prefix",
      message: `Operator prefiksi tanınmır: ${prefix}.`,
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
    return { normalized: null, issues };
  }

  const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;

  if (formatted !== trimmed) {
    issues.push({
      field: "phone",
      code: "phone.normalizable",
      message: "Telefon nömrəsi standart formata gətirilə bilər.",
      severity: "warning",
      originalValue: original,
      suggestion: formatted,
    });
  }

  return { normalized: formatted, issues };
}
