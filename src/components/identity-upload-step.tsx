"use client";

import { useState } from "react";
import { AlertTriangle, IdCard } from "lucide-react";
import type { ExtractedIdentity } from "@/lib/types";
import { extractIdentities } from "@/lib/api";
import { Button, Badge, Card, Spinner } from "@/components/ui";
import { Dropzone } from "@/components/dropzone";

export function IdentityUploadStep({
  aiEnabled,
  onComplete,
}: {
  aiEnabled: boolean;
  onComplete: (identities: ExtractedIdentity[], warnings: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBatch, setLastBatch] = useState<ExtractedIdentity[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleFiles = async (files: File[]) => {
    setBusy(true);
    setError(null);
    try {
      const { identities, warnings: w } = await extractIdentities(files);
      onComplete(identities, w);
      setLastBatch(identities);
      setWarnings(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!aiEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            AI deaktivdir (DEEPSEEK_API_KEY təyin edilməyib). Sənədlər yalnız deterministik
            (regex) üsulla emal olunacaq — nəticələr aşağı inamlı və manual yoxlama tələb edir.
          </span>
        </div>
      )}

      <Dropzone
        accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,.docx,.doc"
        multiple
        onFiles={handleFiles}
        hint="PDF, Word (.docx), TXT — çoxlu vəsiqə AI ilə çıxarılır • skan/şəkil OCR manual yoxlama tələb edir"
      />

      {busy && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Sənədlər emal olunur (çıxarış + müqayisə)...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      {lastBatch && lastBatch.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 text-sm font-medium text-slate-700">
            Çıxarılan {lastBatch.length} sənəd:
          </div>
          <div className="space-y-2">
            {lastBatch.map((id, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-brand-500" />
                  <span className="font-medium text-slate-700">
                    {[id.lastName, id.firstName, id.patronymic].filter(Boolean).join(" ") || "Ad çıxarılmadı"}
                  </span>
                  {id.finCode && <span className="text-slate-500">FİN: {id.finCode}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={id.confidence >= 0.7 ? "green" : id.confidence > 0 ? "amber" : "red"}>
                    İnam {Math.round(id.confidence * 100)}%
                  </Badge>
                  {id.requiresManualReview && <Badge tone="amber">Yoxlama</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
