import type {
  CanonicalField,
  ExtractedIdentity,
  FieldComparison,
  PersonRecord,
} from "@/lib/types";
import { normalizeForCompare, nameSimilarity } from "@/lib/matching/string-similarity";

function recVal(record: PersonRecord, field: CanonicalField): string | null {
  return record.normalized[field] ?? record.raw[field] ?? null;
}

const IDENTITY_FIELDS: Array<{ field: CanonicalField; getId: (id: ExtractedIdentity) => string | null; fuzzy: boolean }> = [
  { field: "firstName", getId: (i) => i.firstName, fuzzy: true },
  { field: "lastName", getId: (i) => i.lastName, fuzzy: true },
  { field: "patronymic", getId: (i) => i.patronymic, fuzzy: true },
  { field: "dateOfBirth", getId: (i) => i.dateOfBirth, fuzzy: false },
  { field: "finCode", getId: (i) => i.finCode, fuzzy: false },
  { field: "gender", getId: (i) => i.gender, fuzzy: false },
  { field: "documentNumber", getId: (i) => i.documentNumber, fuzzy: false },
];

/** Yekun Siyahı qeydini şəxsiyyət vəsiqəsi ilə sahə-sahə müqayisə edir. */
export function compareIdentityToRecord(
  record: PersonRecord,
  identity: ExtractedIdentity,
): { comparisons: FieldComparison[]; hasMismatch: boolean } {
  const comparisons: FieldComparison[] = [];

  for (const def of IDENTITY_FIELDS) {
    const finalValue = recVal(record, def.field);
    const idValue = def.getId(identity);
    if (finalValue === null && idValue === null) continue;

    let status: FieldComparison["status"];
    if (finalValue === null || idValue === null) {
      status = "missing";
    } else {
      const equal = def.fuzzy
        ? nameSimilarity(finalValue, idValue) >= 0.95
        : normalizeForCompare(finalValue) === normalizeForCompare(idValue);
      status = equal ? "match" : "mismatch";
    }
    comparisons.push({ field: def.field, finalValue, referenceValue: idValue, status });
  }

  return { comparisons, hasMismatch: comparisons.some((c) => c.status === "mismatch") };
}

/**
 * Bir şəxsiyyət vəsiqəsini ən uyğun Yekun Siyahı qeydinə bağlayır.
 * Əvvəlcə FİN üzrə, sonra ad oxşarlığı + doğum tarixi üzrə.
 */
export function matchIdentityToRecords(
  identity: ExtractedIdentity,
  records: PersonRecord[],
): { record: PersonRecord; score: number } | null {
  if (records.length === 0) return null;

  // 1) FİN-dəqiq.
  if (identity.finCode) {
    const finNorm = normalizeForCompare(identity.finCode);
    const finMatch = records.find((r) => normalizeForCompare(recVal(r, "finCode")) === finNorm && finNorm);
    if (finMatch) return { record: finMatch, score: 0.99 };
  }

  // 2) Ad + doğum tarixi oxşarlığı.
  let best: { record: PersonRecord; score: number } | null = null;
  for (const r of records) {
    const last = recVal(r, "lastName");
    const first = recVal(r, "firstName");
    if (!last || !first || !identity.lastName || !identity.firstName) continue;
    let score = (nameSimilarity(last, identity.lastName) + nameSimilarity(first, identity.firstName)) / 2;
    const dob = recVal(r, "dateOfBirth");
    if (dob && identity.dateOfBirth) {
      score += normalizeForCompare(dob) === normalizeForCompare(identity.dateOfBirth) ? 0.05 : -0.2;
    }
    if (!best || score > best.score) best = { record: r, score: Math.max(0, Math.min(1, score)) };
  }

  return best && best.score >= 0.85 ? best : null;
}
