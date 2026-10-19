import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocxText } from "@/lib/document/docx";
import { extractDocxImages } from "@/lib/document/docx-images";
import { segmentDocument } from "@/lib/document/segment";
import { extractIdentity, extractIdentityFromImage, getAIProvider } from "@/lib/ai";
import type { ExtractedIdentity } from "@/lib/types";

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

/** Bir emal vahidi — bir şəxsiyyət vəsiqəsi (şəkil və ya mətn hissəsi). */
export interface IdentityUnit {
  kind: "image" | "text" | "placeholder";
  /** image üçün data URL, text üçün mətn, placeholder üçün qeyd. */
  payload: string;
  pageNumber: number | null;
}

export interface IdentityPlan {
  units: IdentityUnit[];
  warnings: string[];
}

/**
 * Faylı emal vahidlərinə (ayrı-ayrı vəsiqələrə) BÖLÜR, amma hələ AI çağırmır.
 * Bu, emalı kiçik hissələrlə (serverless vaxt limiti üçün) aparmağa imkan verir.
 */
export async function planIdentityUnits(fileName: string, buffer: ArrayBuffer): Promise<IdentityPlan> {
  const lower = fileName.toLowerCase();
  const provider = getAIProvider();
  const canVision = provider.isEnabled() && provider.supportsVision();
  const warnings: string[] = [];

  if (lower.endsWith(".docx")) {
    const images = await extractDocxImages(buffer);
    if (images.length > 0) {
      if (!canVision) {
        warnings.push(`${fileName}: şəkilli Word üçün vision AI deaktivdir.`);
        return { units: [{ kind: "placeholder", payload: "vision deaktiv", pageNumber: null }], warnings };
      }
      return {
        units: images.map((img, i) => ({ kind: "image", payload: img.dataUrl, pageNumber: i + 1 })),
        warnings,
      };
    }
    const text = await extractDocxText(buffer);
    if (text.length < 10) {
      warnings.push(`${fileName}: Word daxilində mətn/şəkil tapılmadı.`);
      return { units: [{ kind: "placeholder", payload: "boş Word", pageNumber: null }], warnings };
    }
    return {
      units: segmentDocument([text]).map((s) => ({ kind: "text", payload: s.text, pageNumber: s.pageNumber })),
      warnings,
    };
  }

  if (IMAGE_EXT.test(lower)) {
    if (!canVision) {
      warnings.push(`${fileName}: şəkil üçün vision AI deaktivdir.`);
      return { units: [{ kind: "placeholder", payload: "vision deaktiv", pageNumber: null }], warnings };
    }
    const ext = (lower.split(".").pop() || "jpeg").toLowerCase();
    const mime = MIME[ext] || "image/jpeg";
    const dataUrl = `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
    return { units: [{ kind: "image", payload: dataUrl, pageNumber: null }], warnings };
  }

  if (lower.endsWith(".pdf")) {
    const pdf = await extractPdfText(buffer);
    if (pdf.likelyScanned) {
      warnings.push(`${fileName}: skan PDF — OCR bu versiyada yoxdur.`);
      return { units: [{ kind: "placeholder", payload: "skan PDF", pageNumber: null }], warnings };
    }
    return {
      units: segmentDocument(pdf.pages).map((s) => ({ kind: "text", payload: s.text, pageNumber: s.pageNumber })),
      warnings,
    };
  }

  if (lower.endsWith(".txt")) {
    const text = new TextDecoder().decode(buffer);
    return {
      units: segmentDocument([text]).map((s) => ({ kind: "text", payload: s.text, pageNumber: s.pageNumber })),
      warnings,
    };
  }

  warnings.push(`${fileName}: format (.doc və s.) dəstəklənmir.`);
  return { units: [{ kind: "placeholder", payload: "format dəstəklənmir", pageNumber: null }], warnings };
}

/** Bir emal vahidini AI ilə işlədir (xəta atsa, çağıran tutur). */
export async function processUnit(unit: IdentityUnit, fileName: string): Promise<ExtractedIdentity> {
  if (unit.kind === "image") {
    return extractIdentityFromImage([unit.payload], fileName, unit.pageNumber);
  }
  if (unit.kind === "text") {
    return extractIdentity(unit.payload, fileName, unit.pageNumber);
  }
  return manualReviewPlaceholder(fileName, unit.pageNumber, unit.payload);
}

export interface IdentityFileResult {
  identities: ExtractedIdentity[];
  warnings: string[];
}

/** Bütün faylı bir dəfəyə emal edir (köhnə /api/identity/extract üçün). */
export async function processIdentityFile(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<IdentityFileResult> {
  const plan = await planIdentityUnits(fileName, buffer);
  const identities: ExtractedIdentity[] = [];
  for (let i = 0; i < plan.units.length; i++) {
    try {
      identities.push(await processUnit(plan.units[i], fileName));
    } catch (e) {
      plan.warnings.push(`${fileName} (vahid ${i + 1}): ${(e as Error).message}`);
      identities.push(manualReviewPlaceholder(fileName, i + 1, "oxunmadı — təkrar lazımdır"));
    }
  }
  return { identities, warnings: plan.warnings };
}
