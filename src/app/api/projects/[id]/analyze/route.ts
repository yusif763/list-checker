import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects/repo";
import { matchRecord } from "@/lib/matching/engine";
import { aiCompareRecords, getAIProvider, type ComparePair } from "@/lib/ai";
import { CANONICAL_FIELD_LABELS, type CanonicalField, type PersonRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const TIME_BUDGET_MS = 12_000;
const MAX_RECORDS_PER_CALL = 5;

const COMPARE_FIELDS: CanonicalField[] = [
  "lastName", "firstName", "patronymic", "dateOfBirth", "finCode", "gender",
  "documentNumber", "position", "subject", "region", "workplace", "educationAuthority",
];

function val(r: PersonRecord, f: CanonicalField): string | null {
  return r.normalized[f] ?? r.raw[f] ?? null;
}

function buildPairs(final: PersonRecord, main: PersonRecord): ComparePair[] {
  const pairs: ComparePair[] = [];
  for (const f of COMPARE_FIELDS) {
    const a = val(final, f);
    const b = val(main, f);
    if (a && b) pairs.push({ field: f, label: CANONICAL_FIELD_LABELS[f], finalValue: a, referenceValue: b });
  }
  return pairs;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: "Layihə tapılmadı." }, { status: 404 });

    if (!getAIProvider().isEnabled()) {
      return NextResponse.json({ error: "AI deaktivdir — təhlil mümkün deyil." }, { status: 400 });
    }
    if (project.mainRecords.length === 0) {
      return NextResponse.json({ error: "Əsas siyahı yüklənməyib." }, { status: 400 });
    }

    const comparisons = project.aiComparisons ?? {};
    const mainById = new Map(project.mainRecords.map((r) => [r.id, r]));

    // Təhlil olunmamış, Əsas siyahıda uyğunu olan Yekun qeydləri.
    const pendingRecords = project.finalRecords.filter((r) => !(r.id in comparisons));

    const start = Date.now();
    let count = 0;

    for (const final of pendingRecords) {
      if (count >= MAX_RECORDS_PER_CALL || Date.now() - start >= TIME_BUDGET_MS) break;

      const match = matchRecord(final, project.mainRecords);
      if (!match.matchedRecordId) {
        comparisons[final.id] = []; // uyğun yoxdur — təhlil yoxdur
        count++;
        continue;
      }
      const main = mainById.get(match.matchedRecordId);
      if (!main) {
        comparisons[final.id] = [];
        count++;
        continue;
      }
      const pairs = buildPairs(final, main);
      comparisons[final.id] = pairs.length > 0 ? await aiCompareRecords(pairs) : [];
      count++;
    }

    project.aiComparisons = comparisons;
    await saveProject(project);

    const analyzed = Object.keys(comparisons).length;
    const remaining = project.finalRecords.length - analyzed;
    return NextResponse.json({ analyzed, remaining, total: project.finalRecords.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
