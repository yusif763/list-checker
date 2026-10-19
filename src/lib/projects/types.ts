import type { ExtractedIdentity, PersonRecord } from "@/lib/types";
import type { CorrectionsMap } from "@/lib/excel/export";

export type FileKind = "final" | "main" | "identity";
export type ProcessStatus = "pending" | "processing" | "done" | "failed";

/** Layihəyə yüklənmiş bir faylın metadatası və emal statusu. */
export interface ProjectFile {
  id: string;
  name: string;
  kind: FileKind;
  size: number;
  uploadedAt: string;
  status: ProcessStatus;
  /** Şəxsiyyət faylları üçün: çıxarılan vəsiqə sayı. */
  extractedCount?: number;
  /** Excel faylları üçün: qurulan qeyd sayı. */
  recordCount?: number;
  error?: string;
}

/** Bir layihə — bütün məlumat, nəticə və status burada saxlanılır. */
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  files: ProjectFile[];
  finalRecords: PersonRecord[];
  mainRecords: PersonRecord[];
  identities: ExtractedIdentity[];
  corrections: CorrectionsMap;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  finalCount: number;
  mainCount: number;
  identityCount: number;
}

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    finalCount: p.finalRecords.length,
    mainCount: p.mainRecords.length,
    identityCount: p.identities.length,
  };
}
