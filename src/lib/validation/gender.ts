import type { Gender, ValidationIssue } from "@/lib/types";
import type { FieldValidation } from "./fin";

const MALE = new Set(["kişi", "kisi", "male", "m", "k", "киши", "муж", "мужской"]);
const FEMALE = new Set(["qadın", "qadin", "female", "f", "q", "гадын", "жен", "женский"]);

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Kişi",
  FEMALE: "Qadın",
  UNKNOWN: "Naməlum",
};

/** Mətni kanonik cinsə normallaşdırır (müqayisə üçün). */
export function toGender(raw: string | null | undefined): Gender {
  const v = (raw ?? "").trim().toLocaleLowerCase("az");
  if (!v) return "UNKNOWN";
  if (MALE.has(v)) return "MALE";
  if (FEMALE.has(v)) return "FEMALE";
  return "UNKNOWN";
}

export function normalizeGender(raw: string | null | undefined): FieldValidation {
  const issues: ValidationIssue[] = [];
  const original = raw ?? "";
  const trimmed = original.trim();

  if (!trimmed) {
    return {
      normalized: null,
      issues: [
        {
          field: "gender",
          code: "gender.empty",
          message: "Cins sahəsi boşdur.",
          severity: "info",
          originalValue: original || null,
          suggestion: null,
        },
      ],
    };
  }

  const gender = toGender(trimmed);
  if (gender === "UNKNOWN") {
    issues.push({
      field: "gender",
      code: "gender.unrecognized",
      message: `Cins dəyəri tanınmır: ${original}.`,
      severity: "warning",
      originalValue: original,
      suggestion: null,
    });
    return { normalized: null, issues };
  }

  const label = GENDER_LABELS[gender];
  if (label !== trimmed) {
    issues.push({
      field: "gender",
      code: "gender.normalizable",
      message: `Cins standart dəyərə gətirilə bilər: ${label}.`,
      severity: "info",
      originalValue: original,
      suggestion: label,
    });
  }

  return { normalized: label, issues };
}
