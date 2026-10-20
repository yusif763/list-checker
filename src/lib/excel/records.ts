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

// Başlıq/etiket sətirlərini tanımaq üçün dəqiq sözlər.
const HEADER_WORDS = new Set([
  "soyad", "soyadı", "ad", "adı", "ata", "atasının", "imza", "imzası", "fin",
  "kod", "kodu", "cins", "cinsi", "doğum", "tarix", "tarixi", "telefon", "nömrə",
  "nömrəsi", "vəzifə", "vəzifəsi", "fənn", "rayon", "şəhər", "email", "poçt", "s.a.a",
  "name", "surname", "patronymic",
]);

function looksLikeHeaderText(text: string): boolean {
  const words = text.toLocaleLowerCase("az").split(/[^\p{L}.]+/u).filter(Boolean);
  const hits = words.filter((w) => HEADER_WORDS.has(w)).length;
  return hits >= 2;
}

/** Sətrin real insan datası olub-olmadığını yoxlayır (başlıq/boş/footer deyil). */
function isPersonRow(raw: Partial<Record<CanonicalField, string>>): boolean {
  const nameText = (raw.fullName || [raw.lastName, raw.firstName].filter(Boolean).join(" ")).trim();
  const fin = (raw.finCode ?? "").trim();

  // Nə ad, nə FİN — şəxs deyil.
  if (!nameText && !fin) return false;
  // Ad başlıq/etiket mətnidirsə (məs. "Soyadı, Adı, Ata adı, imzası") — şəxs deyil.
  if (nameText && looksLikeHeaderText(nameText)) return false;
  // Adda heç bir hərf yoxdursa (yalnız rəqəm/işarə) və FİN də yoxdursa — şəxs deyil.
  if (nameText && !/\p{L}/u.test(nameText) && !fin) return false;
  return true;
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

    // Yalnız real insan datası olan sətirlər — başlıq/etiket/boş sətirləri at.
    if (!isPersonRow(raw)) continue;

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
