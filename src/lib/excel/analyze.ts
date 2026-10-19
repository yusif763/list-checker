import * as XLSX from "xlsx";
import type { CanonicalField, ColumnMapping, PersonRecord } from "@/lib/types";
import { detectFields, hasIdentityField } from "./field-detection";
import { buildRecords } from "./records";
import { aiDetectStructure } from "@/lib/ai/structure";
import { getAIProvider } from "@/lib/ai";

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function readMatrices(data: ArrayBuffer): { name: string; matrix: string[][] }[] {
  const wb = XLSX.read(data, { type: "array", cellDates: false, raw: true });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = ws
      ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: false })
      : [];
    return { name, matrix: rows.map((r) => (r ?? []).map(cellToString)) };
  });
}

/** Rule əsaslı: ən ehtimallı başlıq sətri. */
function ruleHeaderRow(matrix: string[][]): number {
  let bestIndex = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i];
    const nonEmpty = row.filter((c) => c !== "").length;
    if (nonEmpty < 2) continue;
    const detected = detectFields(row).filter((g) => g.field).length;
    const score = detected * 5 + nonEmpty;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function columnCount(matrix: string[][]): number {
  return matrix.reduce((m, r) => Math.max(m, r.length), 0);
}

function buildMappings(
  headers: string[],
  colCount: number,
  aiFields: Map<number, string> | null,
): ColumnMapping[] {
  const ruleGuesses = detectFields(headers);
  const mappings: ColumnMapping[] = [];
  for (let i = 0; i < colCount; i++) {
    const header = headers[i] || `Sütun ${i + 1}`;
    const aiField = aiFields?.get(i);
    const rule = ruleGuesses[i];
    if (aiField) {
      mappings.push({ header, index: i, field: aiField as CanonicalField, confidence: 0.9, source: "ai" });
    } else if (rule?.field) {
      mappings.push({ header, index: i, field: rule.field, confidence: rule.confidence, source: "rule" });
    } else {
      mappings.push({ header, index: i, field: null, confidence: 0, source: "none" });
    }
  }
  // Hər sahəni yalnız ən inamlı sütunda saxla.
  const best = new Map<string, number>();
  mappings.forEach((m) => {
    if (!m.field) return;
    const prev = best.get(m.field);
    if (prev === undefined || m.confidence > mappings[prev].confidence) best.set(m.field, m.index);
  });
  return mappings.map((m) => (m.field && best.get(m.field) !== m.index ? { ...m, field: null } : m));
}

export interface SheetAnalysis {
  sheetName: string;
  headerRowIndex: number;
  mappings: ColumnMapping[];
  records: PersonRecord[];
}

/**
 * Faylı analiz edir: hər vərəq üçün struktur (AI + qayda), ən uyğun vərəqi
 * seçir və qeydləri qurur. Başlıqsız fayllar (headerRowIndex = -1) dəstəklənir.
 */
export async function analyzeWorkbook(
  data: ArrayBuffer,
  fileName: string,
  idPrefix: string,
): Promise<SheetAnalysis | null> {
  const sheets = readMatrices(data);
  if (sheets.length === 0) return null;

  const aiEnabled = getAIProvider().isEnabled();
  const candidates: SheetAnalysis[] = [];

  for (const { name, matrix } of sheets) {
    if (matrix.length === 0) continue;
    const colCount = columnCount(matrix);

    let headerRowIndex = ruleHeaderRow(matrix);
    let aiFields: Map<number, string> | null = null;

    if (aiEnabled) {
      const ai = await aiDetectStructure(matrix);
      if (ai) {
        headerRowIndex = ai.headerRowIndex;
        aiFields = new Map(ai.mappings.filter((m) => m.field).map((m) => [m.index, m.field as string]));
      }
    }

    const headers = headerRowIndex >= 0 ? (matrix[headerRowIndex] ?? []) : [];
    const mappings = buildMappings(headers, colCount, aiFields);

    const records = buildRecords(
      data,
      { sheetName: name, headerRowIndex, mappings, sourceFile: fileName },
      idPrefix,
    );

    candidates.push({ sheetName: name, headerRowIndex, mappings, records });
  }

  if (candidates.length === 0) return null;

  // Ən yaxşı vərəq: identifikasiya sahəsi olan, ən çox fərqli sahə
  // uyğunlaşan (ən zəngin), sonra ən çox qeydli vərəq.
  const distinctFields = (c: SheetAnalysis) =>
    new Set(c.mappings.filter((m) => m.field).map((m) => m.field)).size;

  candidates.sort((a, b) => {
    const ai = hasIdentityField(a.mappings) ? 1 : 0;
    const bi = hasIdentityField(b.mappings) ? 1 : 0;
    if (ai !== bi) return bi - ai;
    const df = distinctFields(b) - distinctFields(a);
    if (df !== 0) return df;
    return b.records.length - a.records.length;
  });

  return candidates[0];
}
