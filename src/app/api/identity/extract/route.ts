import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf/extract";
import { segmentDocument } from "@/lib/document/segment";
import { extractIdentity } from "@/lib/ai";
import type { ExtractedIdentity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SEGMENTS_PER_FILE = 60;

function manualReviewPlaceholder(fileName: string, note: string): ExtractedIdentity {
  return {
    firstName: null,
    lastName: null,
    patronymic: null,
    dateOfBirth: null,
    finCode: null,
    gender: null,
    documentNumber: null,
    issueDate: null,
    expiryDate: null,
    issuingAuthority: null,
    confidence: 0,
    requiresManualReview: true,
    sourceFile: `${fileName} — ${note}`,
    pageNumber: null,
    method: "manual",
    model: null,
  };
}

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
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf")) {
        const buffer = await file.arrayBuffer();
        const pdf = await extractPdfText(buffer);
        if (pdf.likelyScanned) {
          warnings.push(`${file.name}: skan edilmiş görünür — bu versiyada OCR yoxdur, manual yoxlama lazımdır.`);
          identities.push(manualReviewPlaceholder(file.name, "skan/OCR tələb olunur"));
          continue;
        }
        const segments = segmentDocument(pdf.pages).slice(0, MAX_SEGMENTS_PER_FILE);
        if (segments.length === MAX_SEGMENTS_PER_FILE) {
          warnings.push(`${file.name}: ${MAX_SEGMENTS_PER_FILE} sənəd limitinə çatdı, qalanı emal olunmadı.`);
        }
        for (const seg of segments) {
          const identity = await extractIdentity(seg.text, file.name, seg.pageNumber);
          identities.push(identity);
        }
      } else if (name.endsWith(".txt")) {
        const text = await file.text();
        const identity = await extractIdentity(text, file.name, null);
        identities.push(identity);
      } else {
        // Şəkil/DOCX/DOC bu nazik versiyada hələ OCR/çevirmə dəstəkləmir.
        warnings.push(`${file.name}: bu format (şəkil/DOCX) hələ dəstəklənmir, manual yoxlama lazımdır.`);
        identities.push(manualReviewPlaceholder(file.name, "format dəstəklənmir"));
      }
    }

    return NextResponse.json({ identities, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Naməlum xəta";
    return NextResponse.json({ error: `Sənəd emalı xətası: ${message}` }, { status: 500 });
  }
}
