import type {
  DuplicateGroup,
  ExtractedIdentity,
  PersonRecord,
  ValidationIssue,
  VerificationRow,
} from "@/lib/types";
import { validateRecord } from "@/lib/validation";
import { matchRecord } from "@/lib/matching/engine";
import { detectDuplicates, duplicateMap } from "@/lib/matching/duplicates";
import { compareIdentityToRecord, matchIdentityToRecords } from "./identity-verify";

export * from "./identity-verify";

export interface VerificationInput {
  finalRecords: PersonRecord[];
  mainRecords: PersonRecord[];
  identities: ExtractedIdentity[];
}

export interface VerificationOutput {
  rows: VerificationRow[];
  duplicates: DuplicateGroup[];
  metrics: DashboardMetrics;
}

export interface DashboardMetrics {
  totalRecords: number;
  validRecords: number;
  recordsWithErrors: number;
  foundInMainList: number;
  notFoundInMainList: number;
  identitiesMatched: number;
  identitiesMissing: number;
  identityMismatches: number;
  duplicateRecords: number;
  invalidPhones: number;
  invalidFins: number;
  invalidEmails: number;
  invalidDates: number;
}

function countIssues(issues: ValidationIssue[]): number {
  return issues.filter((i) => i.severity === "error" || i.severity === "warning").length;
}

/**
 * Yekun Siyahı mərkəzli yoxlama qurur: HƏR Yekun qeydi üçün bir sətir.
 * İstiqamət həmişə Yekun -> İstinad. Əsas Siyahıdakı əlavə şəxslər
 * normal sətir kimi görünmür.
 */
export function buildVerification(input: VerificationInput): VerificationOutput {
  const { finalRecords, mainRecords, identities } = input;

  // Təkrarlar bütün Yekun qeydləri üzrə (bir və ya bir neçə siyahı).
  const duplicates = detectDuplicates(finalRecords);
  const dupMap = duplicateMap(duplicates);

  // Hər şəxsiyyət vəsiqəsini ən uyğun Yekun qeydinə bağla.
  const identityByRecord = new Map<string, ExtractedIdentity>();
  for (const identity of identities) {
    const match = matchIdentityToRecords(identity, finalRecords);
    if (match && !identityByRecord.has(match.record.id)) {
      identityByRecord.set(match.record.id, identity);
    }
  }

  const rows: VerificationRow[] = finalRecords.map((record) => {
    const validationIssues = validateRecord(record);
    const mainListMatch = mainRecords.length > 0 ? matchRecord(record, mainRecords) : null;

    const identity = identityByRecord.get(record.id) ?? null;
    const identityMatch = identity
      ? { identity, ...compareIdentityToRecord(record, identity) }
      : null;

    return {
      record,
      validationIssues,
      mainListMatch,
      identityMatch,
      duplicateOf: dupMap.get(record.id) ?? [],
      issueCount: countIssues(validationIssues),
    };
  });

  return { rows, duplicates, metrics: computeMetrics(rows, duplicates) };
}

export function computeMetrics(rows: VerificationRow[], duplicates: DuplicateGroup[]): DashboardMetrics {
  const hasErrorCode = (row: VerificationRow, prefix: string) =>
    row.validationIssues.some((i) => i.code.startsWith(prefix) && i.severity === "error");

  const duplicateRecordIds = new Set<string>();
  duplicates.forEach((g) => g.recordIds.forEach((id) => duplicateRecordIds.add(id)));

  return {
    totalRecords: rows.length,
    validRecords: rows.filter((r) => r.issueCount === 0).length,
    recordsWithErrors: rows.filter((r) => r.validationIssues.some((i) => i.severity === "error")).length,
    foundInMainList: rows.filter(
      (r) => r.mainListMatch && (r.mainListMatch.status === "found" || r.mainListMatch.status === "found_mismatch"),
    ).length,
    notFoundInMainList: rows.filter((r) => r.mainListMatch && r.mainListMatch.status === "not_found").length,
    identitiesMatched: rows.filter((r) => r.identityMatch).length,
    identitiesMissing: rows.filter((r) => !r.identityMatch).length,
    identityMismatches: rows.filter((r) => r.identityMatch?.hasMismatch).length,
    duplicateRecords: duplicateRecordIds.size,
    invalidPhones: rows.filter((r) => hasErrorCode(r, "phone.")).length,
    invalidFins: rows.filter((r) => hasErrorCode(r, "fin.")).length,
    invalidEmails: rows.filter((r) => hasErrorCode(r, "email.")).length,
    invalidDates: rows.filter((r) => hasErrorCode(r, "date.")).length,
  };
}
