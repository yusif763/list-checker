import type { CanonicalField, PersonRecord, ValidationIssue } from "@/lib/types";
import { normalizeFin } from "./fin";
import { normalizePhone } from "./phone";
import { normalizeDate } from "./date";
import { validateEmail } from "./email";
import { normalizeName } from "./name";
import { normalizeGender } from "./gender";

export * from "./fin";
export * from "./phone";
export * from "./date";
export * from "./email";
export * from "./name";
export * from "./gender";
export * from "./name-parsing";

/**
 * Bir xam dəyər dəstini (kanonik sahə -> dəyər) normallaşdırır və yoxlayır.
 * Normallaşdırılmış dəyərləri və bütün problemləri qaytarır.
 */
export function validateFields(raw: Partial<Record<CanonicalField, string>>): {
  normalized: Partial<Record<CanonicalField, string>>;
  issues: ValidationIssue[];
} {
  const normalized: Partial<Record<CanonicalField, string>> = {};
  const issues: ValidationIssue[] = [];

  const apply = (field: CanonicalField, result: { normalized: string | null; issues: ValidationIssue[] }) => {
    if (result.normalized !== null) normalized[field] = result.normalized;
    issues.push(...result.issues);
  };

  if (raw.finCode !== undefined) apply("finCode", normalizeFin(raw.finCode));
  if (raw.phone !== undefined) apply("phone", normalizePhone(raw.phone));
  if (raw.dateOfBirth !== undefined) apply("dateOfBirth", normalizeDate(raw.dateOfBirth));
  if (raw.email !== undefined) apply("email", validateEmail(raw.email));
  if (raw.firstName !== undefined) apply("firstName", normalizeName(raw.firstName, "firstName"));
  if (raw.lastName !== undefined) apply("lastName", normalizeName(raw.lastName, "lastName"));
  if (raw.patronymic !== undefined) apply("patronymic", normalizeName(raw.patronymic, "patronymic"));
  if (raw.gender !== undefined) apply("gender", normalizeGender(raw.gender));
  if (raw.documentNumber !== undefined && raw.documentNumber.trim()) {
    normalized.documentNumber = raw.documentNumber.trim();
  }
  if (raw.fullName !== undefined && raw.fullName.trim()) {
    normalized.fullName = raw.fullName.trim().replace(/\s+/g, " ");
  }

  return { normalized, issues };
}

/** Hazır PersonRecord üçün yoxlama problemlərini yenidən hesablayır. */
export function validateRecord(record: PersonRecord): ValidationIssue[] {
  return validateFields(record.raw).issues;
}
