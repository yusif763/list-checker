import type { DuplicateGroup, MatchResult, PersonRecord } from "@/lib/types";
import type { AiCompareResult, ComparePair } from "@/lib/ai/compare";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server xətası (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function parseFile(
  file: File,
  side: "A" | "B",
): Promise<{ records: PersonRecord[]; sheetName: string; fileName: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("side", side);
  return handle(await fetch("/api/compare/parse", { method: "POST", body: form }));
}

export interface ComparePairResult {
  aId: string;
  match: MatchResult;
}

export async function matchLists(
  aRecords: PersonRecord[],
  bRecords: PersonRecord[],
): Promise<{
  pairs: ComparePairResult[];
  onlyInB: string[];
  duplicatesA: DuplicateGroup[];
  duplicatesB: DuplicateGroup[];
}> {
  return handle(
    await fetch("/api/compare/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aRecords, bRecords }),
    }),
  );
}

export async function aiCompareBatch(
  items: { aId: string; pairs: ComparePair[] }[],
): Promise<{ results: Record<string, AiCompareResult[]>; processed: number }> {
  return handle(
    await fetch("/api/compare/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }),
  );
}
