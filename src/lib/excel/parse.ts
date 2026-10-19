import * as XLSX from "xlsx";
import type { ColumnMapping, ParsedSheetResult, SheetDetection } from "@/lib/types";
import { detectFields } from "./field-detection";

const MAX_HEADER_SCAN_ROWS = 20;
const MAX_SAMPLE_ROWS = 5;

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** Bir vərəqin matrisində ən ehtimallı başlıq sətrini tapır. */
function detectHeaderRow(rows: string[][]): number {
  let bestIndex = 0;
  let bestScore = -1;
  const scanLimit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    const nonEmpty = row.filter((c) => c !== "").length;
    if (nonEmpty < 2) continue;
    const guesses = detectFields(row);
    const detected = guesses.filter((g) => g.field).length;
    // Tanınan sahələr güclü siqnaldır; dolu xanalar ikinci dərəcəli.
    const score = detected * 5 + nonEmpty;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function buildMappings(headers: string[]): ColumnMapping[] {
  const guesses = detectFields(headers);
  return headers.map((header, index) => ({
    header: header || `Sütun ${index + 1}`,
    index,
    field: guesses[index].field,
    confidence: guesses[index].confidence,
    source: guesses[index].field ? ("rule" as const) : ("none" as const),
  }));
}

function analyzeSheet(name: string, matrix: string[][]): SheetDetection {
  const headerRowIndex = detectHeaderRow(matrix);
  const headers = (matrix[headerRowIndex] ?? []).map(cellToString);
  const dataRows = matrix.slice(headerRowIndex + 1).filter((r) => r.some((c) => c !== ""));

  return {
    sheetName: name,
    headerRowIndex,
    headers,
    mappings: buildMappings(headers),
    sampleRows: dataRows.slice(0, MAX_SAMPLE_ROWS),
    totalRows: dataRows.length,
  };
}

/** Excel/CSV faylını (ArrayBuffer) oxuyur və hər vərəqin strukturunu aşkarlayır. */
export function parseWorkbook(data: ArrayBuffer, fileName: string): ParsedSheetResult {
  const wb = XLSX.read(data, { type: "array", cellDates: false, raw: true });
  const sheets: SheetDetection[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    const stringMatrix = matrix.map((row) => (row ?? []).map(cellToString));
    if (stringMatrix.length === 0) continue;
    sheets.push(analyzeSheet(sheetName, stringMatrix));
  }

  return { fileName, sheets };
}
