import * as XLSX from "xlsx";
import type { CanonicalField, ColumnMapping, PersonRecord } from "@/lib/types";
import { parseFullName, validateFields } from "@/lib/validation";

export interface RecordBuildConfig {
  sheetName: string;
  headerRowIndex: number;
  mappings: ColumnMapping[];
  sourceFile: string;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/**
 * Təsdiqlənmiş uyğunlaşdırmalara əsasən vərəqdən PersonRecord-lar qurur.
 * Birləşmiş tam ad varsa və ayrı ad/soyad yoxdursa, onu hissələrə ayırır.
 * Orijinal və normallaşdırılmış dəyərləri saxlayır.
 */
export function buildRecords(
  data: ArrayBuffer,
  config: RecordBuildConfig,
  idPrefix = "rec",
): PersonRecord[] {
  const wb = XLSX.read(data, { type: "array", cellDates: false, raw: true });
  const ws = wb.Sheets[config.sheetName];
  if (!ws) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  const activeMappings = config.mappings.filter((m) => m.field);
  const records: PersonRecord[] = [];

  for (let r = config.headerRowIndex + 1; r < matrix.length; r++) {
    const row = (matrix[r] ?? []).map(cellToString);
    if (row.every((c) => c === "")) continue;

    const raw: Partial<Record<CanonicalField, string>> = {};
    for (const m of activeMappings) {
      const value = cellToString(row[m.index]);
      if (value !== "") raw[m.field as CanonicalField] = value;
    }

    // Heç bir uyğunlaşdırılmış sütunda dəyər yoxdursa, sətri at (boş qeyd).
    if (Object.keys(raw).length === 0) continue;

    // Birləşmiş tam ad -> hissələr (ad/soyad ayrıca yoxdursa).
    if (raw.fullName && !raw.firstName && !raw.lastName) {
      const parsed = parseFullName(raw.fullName);
      if (parsed.firstName) raw.firstName = parsed.firstName;
      if (parsed.lastName) raw.lastName = parsed.lastName;
      if (parsed.patronymic && !raw.patronymic) raw.patronymic = parsed.patronymic;
    }

    const { normalized } = validateFields(raw);

    records.push({
      // Determinist, dataset daxilində unikal id (mənbə + sətir).
      id: `${idPrefix}-${config.sheetName}-${r + 1}`,
      sourceFile: config.sourceFile,
      sheetName: config.sheetName,
      rowNumber: r + 1, // 1-dən, orijinal Excel sətri
      raw,
      normalized,
    });
  }

  return records;
}
