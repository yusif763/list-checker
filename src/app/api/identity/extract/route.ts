import { NextResponse } from "next/server";
import { processIdentityFile } from "@/lib/document/process-identity";
import type { ExtractedIdentity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Sənəd tapılmadı." }, { status: 400 });
    }

    const identities: ExtractedIdentity[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      try {
        const res = await processIdentityFile(file.name, await file.arrayBuffer());
        identities.push(...res.identities);
        warnings.push(...res.warnings);
      } catch (e) {
        warnings.push(`${file.name}: emal xətası — ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ identities, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Naməlum xəta";
    return NextResponse.json({ error: `Sənəd emalı xətası: ${message}` }, { status: 500 });
  }
}
