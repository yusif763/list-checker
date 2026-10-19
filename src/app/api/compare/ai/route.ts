import { NextResponse } from "next/server";
import { aiCompareRecords, getAIProvider, type ComparePair } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const TIME_BUDGET_MS = 12_000;
const MAX_ITEMS = 5;

interface Item {
  aId: string;
  pairs: ComparePair[];
}

/**
 * Tutuşdurma cütlərini AI ilə sahə-sahə qiymətləndirir (hissəli, batch).
 * Klient artıq işlənmiş aId-ləri göndərmir; qalanları batch-batch göndərir.
 */
export async function POST(req: Request) {
  try {
    if (!getAIProvider().isEnabled()) {
      return NextResponse.json({ error: "AI deaktivdir." }, { status: 400 });
    }
    const body = await req.json();
    const items = (body.items ?? []) as Item[];

    const results: Record<string, Awaited<ReturnType<typeof aiCompareRecords>>> = {};
    const start = Date.now();
    let count = 0;

    for (const item of items) {
      if (count >= MAX_ITEMS || Date.now() - start >= TIME_BUDGET_MS) break;
      results[item.aId] = item.pairs.length ? await aiCompareRecords(item.pairs) : [];
      count++;
    }

    return NextResponse.json({ results, processed: count });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
