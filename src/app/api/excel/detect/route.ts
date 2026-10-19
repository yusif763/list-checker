import { NextResponse } from "next/server";
import { parseWorkbook } from "@/lib/excel/parse";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fayl tapılmadı." }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    const result = parseWorkbook(buffer, file.name);
    if (result.sheets.length === 0) {
      return NextResponse.json({ error: "Faylda oxunabilən vərəq tapılmadı." }, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Naməlum xəta";
    return NextResponse.json({ error: `Excel oxunmadı: ${message}` }, { status: 500 });
  }
}
