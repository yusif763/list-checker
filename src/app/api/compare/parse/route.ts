import { NextResponse } from "next/server";
import { analyzeWorkbook } from "@/lib/excel/analyze";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Bir Excel faylını analiz edib qeydləri qaytarır (tutuşdurma modulu üçün). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const side = (form.get("side") as string) || "X";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fayl tapılmadı." }, { status: 400 });
    }
    const analysis = await analyzeWorkbook(await file.arrayBuffer(), file.name, side);
    if (!analysis || analysis.records.length === 0) {
      return NextResponse.json({ error: "Qeyd tapılmadı və ya struktur tanınmadı." }, { status: 422 });
    }
    return NextResponse.json({
      records: analysis.records,
      sheetName: analysis.sheetName,
      fileName: file.name,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
