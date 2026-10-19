import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocxText } from "@/lib/document/docx";
import { extractDocxImages } from "@/lib/document/docx-images";
import { segmentDocument } from "@/lib/document/segment";
import { extractIdentity, extractIdentityFromImage, getAIProvider } from "@/lib/ai";
import type { ExtractedIdentity } from "@/lib/types";

const MAX_ITEMS_PER_FILE = 120;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function manualReviewPlaceholder(
  sourceFile: string,
  pageNumber: number | null,
  note: string,
): ExtractedIdentity {
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

export interface IdentityFileResult {
  identities: ExtractedIdentity[];
  warnings: string[];
}

/**
 * Bir şəxsiyyət sənədi faylını emal edir (Word şəkilləri → vision, müstəqil
 * şəkil → vision, PDF mətn, TXT). Hər vahid ayrıca try/catch ilə — bir
 * xəta bütün faylı dayandırmır.
 */
export async function processIdentityFile(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<IdentityFileResult> {
  const lower = fileName.toLowerCase();
  const provider = getAIProvider();
  const canVision = provider.isEnabled() && provider.supportsVision();
  const identities: ExtractedIdentity[] = [];
  const warnings: string[] = [];

  if (lower.endsWith(".docx")) {
    const images = await extractDocxImages(buffer);
    if (images.length > 0 && canVision) {
      const limited = images.slice(0, MAX_ITEMS_PER_FILE);
      if (images.length > MAX_ITEMS_PER_FILE) {
        warnings.push(`${fileName}: ${MAX_ITEMS_PER_FILE} şəkil limitinə çatdı, qalanı emal olunmadı.`);
      }
      for (let i = 0; i < limited.length; i++) {
        try {
          identities.push(await extractIdentityFromImage([limited[i].dataUrl], fileName, i + 1));
        } catch (e) {
          warnings.push(`${fileName} (şəkil ${i + 1}): ${(e as Error).message}`);
          identities.push(manualReviewPlaceholder(fileName, i + 1, "şəkil oxunmadı — təkrar emal lazımdır"));
        }
      }
    } else {
      const text = await extractDocxText(buffer);
      if (text.length < 10) {
        warnings.push(`${fileName}: Word daxilində oxunabilən mətn/şəkil tapılmadı${canVision ? "" : " (vision deaktiv)"}.`);
        identities.push(manualReviewPlaceholder(fileName, null, "boş və ya vision deaktiv"));
      } else {
        for (const seg of segmentDocument([text]).slice(0, MAX_ITEMS_PER_FILE)) {
          identities.push(await extractIdentity(seg.text, fileName, seg.pageNumber));
        }
      }
    }
  } else if (IMAGE_EXT.test(lower)) {
    if (!canVision) {
      warnings.push(`${fileName}: şəkil üçün vision AI deaktivdir — manual yoxlama lazımdır.`);
      identities.push(manualReviewPlaceholder(fileName, null, "vision deaktiv"));
    } else {
      const ext = (lower.split(".").pop() || "jpeg").toLowerCase();
      const mime = MIME[ext] || "image/jpeg";
      const dataUrl = `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
      identities.push(await extractIdentityFromImage([dataUrl], fileName, null));
    }
  } else if (lower.endsWith(".pdf")) {
    const pdf = await extractPdfText(buffer);
    if (pdf.likelyScanned) {
      warnings.push(`${fileName}: skan edilmiş PDF — PDF şəkil OCR bu versiyada yoxdur, manual yoxlama lazımdır.`);
      identities.push(manualReviewPlaceholder(fileName, null, "skan PDF — OCR lazımdır"));
    } else {
      for (const seg of segmentDocument(pdf.pages).slice(0, MAX_ITEMS_PER_FILE)) {
        identities.push(await extractIdentity(seg.text, fileName, seg.pageNumber));
      }
    }
  } else if (lower.endsWith(".txt")) {
    const dec = new TextDecoder();
    identities.push(await extractIdentity(dec.decode(buffer), fileName, null));
  } else {
    warnings.push(`${fileName}: bu format (.doc və s.) hələ dəstəklənmir, manual yoxlama lazımdır.`);
    identities.push(manualReviewPlaceholder(fileName, null, "format dəstəklənmir"));
  }

  return { identities, warnings };
}
