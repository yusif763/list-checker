import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocxText } from "@/lib/document/docx";
import { extractDocxImages } from "@/lib/document/docx-images";
import { segmentDocument } from "@/lib/document/segment";
import { extractIdentity, extractIdentityFromImage, getAIProvider } from "@/lib/ai";
import type { ExtractedIdentity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ITEMS_PER_FILE = 120;

function manualReviewPlaceholder(sourceFile: string, pageNumber: number | null, note: string): ExtractedIdentity {
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
    sourceFile,
    pageNumber,
    method: "manual",
    model: null,
    rawText: note,
  };
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Sənəd tapılmadı." }, { status: 400 });
    }

    const provider = getAIProvider();
    const canVision = provider.isEnabled() && provider.supportsVision();
    const identities: ExtractedIdentity[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      const name = file.name;
      const lower = name.toLowerCase();

      try {
        if (lower.endsWith(".docx")) {
          // 1) Word içindəki şəkilləri (ID kartları) çıxar → hər birini vision ilə oxu.
          const buffer = await file.arrayBuffer();
          const images = await extractDocxImages(buffer);

          if (images.length > 0 && canVision) {
            const limited = images.slice(0, MAX_ITEMS_PER_FILE);
            if (images.length > MAX_ITEMS_PER_FILE) {
              warnings.push(`${name}: ${MAX_ITEMS_PER_FILE} şəkil limitinə çatdı, qalanı emal olunmadı.`);
            }
            for (let i = 0; i < limited.length; i++) {
              try {
                const id = await extractIdentityFromImage([limited[i].dataUrl], name, i + 1);
                identities.push(id);
              } catch (e) {
                warnings.push(`${name} (şəkil ${i + 1}): ${(e as Error).message}`);
                identities.push(manualReviewPlaceholder(name, i + 1, "şəkil oxunmadı — təkrar emal lazımdır"));
              }
            }
          } else {
            // Şəkil yoxdursa mətnə keç.
            const text = await extractDocxText(buffer);
            if (text.length < 10) {
              warnings.push(
                `${name}: Word daxilində oxunabilən mətn/şəkil tapılmadı${canVision ? "" : " (vision AI deaktivdir)"}.`,
              );
              identities.push(manualReviewPlaceholder(name, null, "boş və ya vision deaktiv"));
            } else {
              for (const seg of segmentDocument([text]).slice(0, MAX_ITEMS_PER_FILE)) {
                identities.push(await extractIdentity(seg.text, name, seg.pageNumber));
              }
            }
          }
        } else if (IMAGE_EXT.test(lower)) {
          // Müstəqil şəkil faylı → vision OCR.
          if (!canVision) {
            warnings.push(`${name}: şəkil üçün vision AI deaktivdir — manual yoxlama lazımdır.`);
            identities.push(manualReviewPlaceholder(name, null, "vision deaktiv"));
          } else {
            const buffer = await file.arrayBuffer();
            const ext = (lower.split(".").pop() || "jpeg").toLowerCase();
            const mime = MIME[ext] || "image/jpeg";
            const dataUrl = `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
            identities.push(await extractIdentityFromImage([dataUrl], name, null));
          }
        } else if (lower.endsWith(".pdf")) {
          const buffer = await file.arrayBuffer();
          const pdf = await extractPdfText(buffer);
          if (pdf.likelyScanned) {
            warnings.push(`${name}: skan edilmiş PDF — bu versiyada PDF şəkil OCR yoxdur, manual yoxlama lazımdır.`);
            identities.push(manualReviewPlaceholder(name, null, "skan PDF — OCR lazımdır"));
          } else {
            for (const seg of segmentDocument(pdf.pages).slice(0, MAX_ITEMS_PER_FILE)) {
              identities.push(await extractIdentity(seg.text, name, seg.pageNumber));
            }
          }
        } else if (lower.endsWith(".txt")) {
          identities.push(await extractIdentity(await file.text(), name, null));
        } else {
          warnings.push(`${name}: bu format (.doc və s.) hələ dəstəklənmir, manual yoxlama lazımdır.`);
          identities.push(manualReviewPlaceholder(name, null, "format dəstəklənmir"));
        }
      } catch (e) {
        // Bir faylın xətası bütün batch-i dayandırmasın.
        warnings.push(`${name}: emal xətası — ${(e as Error).message}`);
        identities.push(manualReviewPlaceholder(name, null, `emal xətası: ${(e as Error).message}`));
      }
    }

    return NextResponse.json({ identities, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Naməlum xəta";
    return NextResponse.json({ error: `Sənəd emalı xətası: ${message}` }, { status: 500 });
  }
}
