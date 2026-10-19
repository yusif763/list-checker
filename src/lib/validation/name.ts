import type { CanonicalField, ValidationIssue } from "@/lib/types";
import type { FieldValidation } from "./fin";

// Azərbaycan hərfləri daxil olmaqla ad simvolları: hərflər, boşluq, defis, apostrof.
const NAME_ALLOWED = /^[\p{L}\s'’\-.]+$/u;

/** Azərbaycan dilinə uyğun baş hərf böyütmə (İ/ı davranışı üçün 'az' locale). */
export function toTitleCaseAz(value: string): string {
  return value
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          if (!part) return part;
          const first = part.slice(0, 1).toLocaleUpperCase("az");
          const rest = part.slice(1).toLocaleLowerCase("az");
          return first + rest;
        })
        .join("-"),
    )
    .join(" ");
}

/**
 * Ad sahəsini yoxlayır və təhlükəsiz normallaşdırır (boşluqlar, baş hərf).
 * Azərbaycan hərflərini latın qarşılığı ilə ƏVƏZ ETMİR.
 */
export function normalizeName(
  raw: string | null | undefined,
  field: CanonicalField = "firstName",
): FieldValidation {
  const issues: ValidationIssue[] = [];
  const original = raw ?? "";
  const trimmed = original.trim();

  if (!trimmed) {
    return {
      normalized: null,
      issues: [
        {
          field,
          code: "name.empty",
          message: "Ad sahəsi boşdur.",
          severity: "error",
          originalValue: original || null,
          suggestion: null,
        },
      ],
    };
  }

  if (/\d/.test(trimmed)) {
    issues.push({
      field,
      code: "name.has-digits",
      message: "Ad sahəsində rəqəm var.",
      severity: "warning",
      originalValue: original,
      suggestion: null,
    });
  }

  if (!NAME_ALLOWED.test(trimmed)) {
    issues.push({
      field,
      code: "name.invalid-chars",
      message: "Ad sahəsində gözlənilməz simvollar var.",
      severity: "warning",
      originalValue: original,
      suggestion: null,
    });
  }

  // Təhlükəsiz normallaşdırma: artıq boşluqları sil, baş hərfləri böyüt.
  const collapsed = trimmed.replace(/\s+/g, " ");
  const titled = toTitleCaseAz(collapsed);

  if (titled !== trimmed) {
    issues.push({
      field,
      code: "name.normalizable",
      message: "Ad standart yazılışa (baş hərf böyük, artıq boşluqsuz) gətirilə bilər.",
      severity: "info",
      originalValue: original,
      suggestion: titled,
    });
  }

  return { normalized: titled, issues };
}
