import { NextResponse } from "next/server";
import { parseWorkbook } from "@/lib/excel/parse";
import { hasIdentityField, mergeAiMappings } from "@/lib/excel/field-detection";
import { aiMapColumns, getAIProvider } from "@/lib/ai";

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

    // AI aşkarlama: qayda nəticəsi zəif olduqda (identifikasiya sahəsi yoxdursa
    // və ya uyğunlaşdırılmamış başlıqlar varsa) başlıqları AI ilə təhlil et.
    const aiEnabled = getAIProvider().isEnabled();
    if (aiEnabled) {
      for (const sheet of result.sheets) {
        const unmapped = sheet.mappings.some((m) => !m.field && m.header.trim() !== "");
        if (!hasIdentityField(sheet.mappings) || unmapped) {
          const guesses = await aiMapColumns(sheet.headers, sheet.sampleRows);
          if (guesses.length > 0) {
            sheet.mappings = mergeAiMappings(sheet.mappings, guesses);
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Naməlum xəta";
    return NextResponse.json({ error: `Excel oxunmadı: ${message}` }, { status: 500 });
  }
}
