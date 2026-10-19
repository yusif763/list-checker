import { NextResponse } from "next/server";
import type { PersonRecord } from "@/lib/types";
import { matchRecord } from "@/lib/matching/engine";
import { detectDuplicates } from "@/lib/matching/duplicates";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * İki Yekun siyahını tutuşdurur (deterministik, AI-siz): hər A qeydi üçün
 * B-də uyğun axtarır, yalnız B-də olanları və hər siyahının daxili təkrarlarını tapır.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const aRecords = (body.aRecords ?? []) as PersonRecord[];
    const bRecords = (body.bRecords ?? []) as PersonRecord[];

    const pairs = aRecords.map((a) => ({ aId: a.id, match: matchRecord(a, bRecords) }));

    const matchedB = new Set(pairs.map((p) => p.match.matchedRecordId).filter(Boolean) as string[]);
    const onlyInB = bRecords.filter((b) => !matchedB.has(b.id)).map((b) => b.id);

    return NextResponse.json({
      pairs,
      onlyInB,
      duplicatesA: detectDuplicates(aRecords),
      duplicatesB: detectDuplicates(bRecords),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
