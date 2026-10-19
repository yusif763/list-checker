import * as XLSX from "xlsx";
import {
  CANONICAL_FIELD_LABELS,
  DUPLICATE_TYPE_LABELS,
  MATCH_STATUS_LABELS,
  type CanonicalField,
  type DuplicateGroup,
  type VerificationRow,
} from "@/lib/types";

export type CorrectionsMap = Record<string, Partial<Record<CanonicalField, string>>>;

const PERSON_FIELDS: CanonicalField[] = [
  "lastName",
  "firstName",
  "patronymic",
  "finCode",
  "dateOfBirth",
  "gender",
  "phone",
  "email",
  "documentNumber",
];

function effectiveValue(
  row: VerificationRow,
  field: CanonicalField,
  corrections: CorrectionsMap,
): string {
  const corrected = corrections[row.record.id]?.[field];
  if (corrected !== undefined) return corrected;
  return row.record.normalized[field] ?? row.record.raw[field] ?? "";
}

/** 14.1 — Düzəldilmiş Yekun Siyahı vərəqi. */
function correctedSheet(rows: VerificationRow[], corrections: CorrectionsMap): XLSX.WorkSheet {
  const header = ["Mənbə fayl", "Vərəq", "Sətir", ...PERSON_FIELDS.map((f) => CANONICAL_FIELD_LABELS[f])];
  const data = rows.map((row) => [
    row.record.sourceFile,
    row.record.sheetName,
    row.record.rowNumber,
    ...PERSON_FIELDS.map((f) => effectiveValue(row, f, corrections)),
  ]);
  return XLSX.utils.aoa_to_sheet([header, ...data]);
}

/** 14.2 — Tam yoxlama hesabatı. */
function fullReportSheet(rows: VerificationRow[], corrections: CorrectionsMap): XLSX.WorkSheet {
  const header = [
    "Şəxs",
    "FİN",
    "Əsas Siyahı",
    "Vəsiqə",
    "Vəsiqə uyğunsuzluğu",
    "Problem sayı",
    "Təkrar",
  ];
  const data = rows.map((row) => {
    const name = [
      effectiveValue(row, "lastName", corrections),
      effectiveValue(row, "firstName", corrections),
      effectiveValue(row, "patronymic", corrections),
    ]
      .filter(Boolean)
      .join(" ");
    return [
      name,
      effectiveValue(row, "finCode", corrections),
      row.mainListMatch ? MATCH_STATUS_LABELS[row.mainListMatch.status] : "—",
      row.identityMatch ? "Tapıldı" : "Yoxdur",
      row.identityMatch?.hasMismatch ? "Bəli" : "Xeyr",
      row.issueCount,
      row.duplicateOf.length ? "Bəli" : "Xeyr",
    ];
  });
  return XLSX.utils.aoa_to_sheet([header, ...data]);
}

/** 14.3 — Səhvlər hesabatı (hər problem bir sətir). */
function errorsSheet(rows: VerificationRow[]): XLSX.WorkSheet {
  const header = ["Mənbə fayl", "Sətir", "Sahə", "Problem", "Ciddilik", "Orijinal dəyər", "Təklif"];
  const data: (string | number)[][] = [];
  for (const row of rows) {
    for (const issue of row.validationIssues) {
      if (issue.severity === "info") continue;
      data.push([
        row.record.sourceFile,
        row.record.rowNumber,
        CANONICAL_FIELD_LABELS[issue.field],
        issue.message,
        issue.severity === "error" ? "Səhv" : "Xəbərdarlıq",
        issue.originalValue ?? "",
        issue.suggestion ?? "",
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet([header, ...data]);
}

/** 14.4 — Əsas Siyahıda tapılmayanlar. */
function missingMainSheet(rows: VerificationRow[]): XLSX.WorkSheet {
  const header = ["Mənbə fayl", "Sətir", "Soyad", "Ad", "FİN", "Status"];
  const data = rows
    .filter((r) => r.mainListMatch && r.mainListMatch.status === "not_found")
    .map((r) => [
      r.record.sourceFile,
      r.record.rowNumber,
      r.record.normalized.lastName ?? "",
      r.record.normalized.firstName ?? "",
      r.record.normalized.finCode ?? "",
      MATCH_STATUS_LABELS[r.mainListMatch!.status],
    ]);
  return XLSX.utils.aoa_to_sheet([header, ...data]);
}

/** 14.5 — Vəsiqə uyğunsuzluqları. */
function identityMismatchSheet(rows: VerificationRow[]): XLSX.WorkSheet {
  const header = ["Şəxs", "Sahə", "Yekun Siyahı dəyəri", "Vəsiqə dəyəri", "Mənbə vəsiqə"];
  const data: string[][] = [];
  for (const row of rows) {
    if (!row.identityMatch?.hasMismatch) continue;
    const name = `${row.record.normalized.lastName ?? ""} ${row.record.normalized.firstName ?? ""}`.trim();
    for (const c of row.identityMatch.comparisons) {
      if (c.status !== "mismatch") continue;
      data.push([
        name,
        CANONICAL_FIELD_LABELS[c.field],
        c.finalValue ?? "",
        c.referenceValue ?? "",
        row.identityMatch.identity.sourceFile,
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet([header, ...data]);
}

/** 14.6 — Təkrarlar hesabatı. */
function duplicatesSheet(rows: VerificationRow[], duplicates: DuplicateGroup[]): XLSX.WorkSheet {
  const byId = new Map(rows.map((r) => [r.record.id, r]));
  const header = ["Təkrar növü", "Şəxs", "FİN", "Mənbə fayl", "Sətir", "Tövsiyə"];
  const data: (string | number)[][] = [];
  for (const g of duplicates) {
    for (const id of g.recordIds) {
      const row = byId.get(id);
      if (!row) continue;
      const name = `${row.record.normalized.lastName ?? ""} ${row.record.normalized.firstName ?? ""}`.trim();
      data.push([
        DUPLICATE_TYPE_LABELS[g.type],
        name,
        row.record.normalized.finCode ?? "",
        row.record.sourceFile,
        row.record.rowNumber,
        g.recommendation,
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet([header, ...data]);
}

/** Bütün hesabatları bir Excel faylında (ArrayBuffer) qaytarır. */
export function buildReportWorkbook(
  rows: VerificationRow[],
  duplicates: DuplicateGroup[],
  corrections: CorrectionsMap = {},
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, correctedSheet(rows, corrections), "Düzəldilmiş Siyahı");
  XLSX.utils.book_append_sheet(wb, fullReportSheet(rows, corrections), "Tam Hesabat");
  XLSX.utils.book_append_sheet(wb, errorsSheet(rows), "Səhvlər");
  XLSX.utils.book_append_sheet(wb, missingMainSheet(rows), "Əsas Siyahıda yoxdur");
  XLSX.utils.book_append_sheet(wb, identityMismatchSheet(rows), "Vəsiqə uyğunsuzluqları");
  XLSX.utils.book_append_sheet(wb, duplicatesSheet(rows, duplicates), "Təkrarlar");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}
