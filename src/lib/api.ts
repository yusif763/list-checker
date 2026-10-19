import type { ExtractedIdentity, ParsedSheetResult, PersonRecord, SheetDetection } from "@/lib/types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server xətası (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function detectWorkbook(file: File): Promise<ParsedSheetResult> {
  const form = new FormData();
  form.append("file", file);
  return handle(await fetch("/api/excel/detect", { method: "POST", body: form }));
}

export interface BuildRecordsConfig {
  sheet: SheetDetection;
  idPrefix: string;
}

export async function buildRecordsRequest(
  file: File,
  config: BuildRecordsConfig,
): Promise<PersonRecord[]> {
  const form = new FormData();
  form.append("file", file);
  form.append(
    "config",
    JSON.stringify({
      sheetName: config.sheet.sheetName,
      headerRowIndex: config.sheet.headerRowIndex,
      mappings: config.sheet.mappings,
      idPrefix: config.idPrefix,
    }),
  );
  const data = await handle<{ records: PersonRecord[] }>(
    await fetch("/api/excel/records", { method: "POST", body: form }),
  );
  return data.records;
}

export async function extractIdentities(
  files: File[],
): Promise<{ identities: ExtractedIdentity[]; warnings: string[] }> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return handle(await fetch("/api/identity/extract", { method: "POST", body: form }));
}

export async function aiStatus(): Promise<{ enabled: boolean; provider: string }> {
  return handle(await fetch("/api/ai/status"));
}
