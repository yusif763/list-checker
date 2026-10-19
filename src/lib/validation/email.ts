import type { ValidationIssue } from "@/lib/types";
import type { FieldValidation } from "./fin";

// Sadə, praktik e-poçt sintaksisi yoxlaması (RFC-nin tam deyil).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E-poçt sintaksisini yoxlayır. Qeyd: sintaksis düzgündürsə belə,
 * ünvanın real mövcudluğunu təsdiq ETMİR.
 */
export function validateEmail(raw: string | null | undefined): FieldValidation {
  const issues: ValidationIssue[] = [];
  const original = raw ?? "";
  const trimmed = original.trim();

  if (!trimmed) {
    return {
      normalized: null,
      issues: [
        {
          field: "email",
          code: "email.empty",
          message: "E-poçt boşdur.",
          severity: "warning",
          originalValue: original || null,
          suggestion: null,
        },
      ],
    };
  }

  const normalized = trimmed.toLowerCase();
  const atCount = (normalized.match(/@/g) || []).length;

  if (atCount === 0) {
    issues.push({
      field: "email",
      code: "email.no-at",
      message: "E-poçt ünvanında '@' simvolu yoxdur.",
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
  } else if (atCount > 1) {
    issues.push({
      field: "email",
      code: "email.multiple-at",
      message: "E-poçt ünvanında birdən çox '@' simvolu var.",
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
  } else if (/\s/.test(trimmed)) {
    issues.push({
      field: "email",
      code: "email.whitespace",
      message: "E-poçt ünvanında boşluq var.",
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
  } else if (!EMAIL_PATTERN.test(normalized)) {
    issues.push({
      field: "email",
      code: "email.invalid-syntax",
      message: "E-poçt sintaksisi düzgün deyil.",
      severity: "error",
      originalValue: original,
      suggestion: null,
    });
  } else if (normalized !== trimmed) {
    issues.push({
      field: "email",
      code: "email.normalizable",
      message: "E-poçt kiçik hərflərlə yazıla bilər.",
      severity: "info",
      originalValue: original,
      suggestion: normalized,
    });
  }

  return { normalized: EMAIL_PATTERN.test(normalized) ? normalized : null, issues };
}
