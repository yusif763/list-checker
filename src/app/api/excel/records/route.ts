import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRecords } from "@/lib/excel/records";
import type { CanonicalField } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MappingSchema = z.object({
  header: z.string(),
  index: z.number().int().min(0),
  field: z.string().nullable(),
  confidence: z.number(),
  source: z.enum(["rule", "ai", "manual", "none"]),
});

const ConfigSchema = z.object({
  sheetName: z.string(),
  headerRowIndex: z.number().int().min(0),
  mappings: z.array(MappingSchema),
  idPrefix: z.string().default("rec"),
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const configRaw = form.get("config");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fayl tapılmadı." }, { status: 400 });
    }
    if (typeof configRaw !== "string") {
      return NextResponse.json({ error: "Konfiqurasiya tapılmadı." }, { status: 400 });
    }

    const config = ConfigSchema.parse(JSON.parse(configRaw));
    const buffer = await file.arrayBuffer();

    const records = buildRecords(
      buffer,
      {
        sheetName: config.sheetName,
        headerRowIndex: config.headerRowIndex,
        sourceFile: file.name,
        mappings: config.mappings.map((m) => ({
          ...m,
          field: (m.field as CanonicalField | null) ?? null,
        })),
      },
      config.idPrefix,
    );

    return NextResponse.json({ records });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Naməlum xəta";
    return NextResponse.json({ error: `Qeydlər qurulmadı: ${message}` }, { status: 500 });
  }
}
