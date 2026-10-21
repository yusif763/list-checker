"use client";

import { useState } from "react";
import { FileSpreadsheet, Database, IdCard, CheckCircle2, XCircle, Clock, AlertTriangle, Trash2 } from "lucide-react";
import type { FileKind, Project } from "@/lib/projects/types";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { Dropzone } from "@/components/dropzone";

const SECTIONS: { kind: FileKind; title: string; desc: string; accept: string; multiple: boolean; icon: typeof FileSpreadsheet }[] = [
  {
    kind: "final",
    title: "Yekun siyahı",
    desc: "Əsas məlumat mənbəyi — bütün yoxlamalar buna əsaslanır. Struktur AI ilə analiz olunur.",
    accept: ".xlsx,.xls,.csv",
    multiple: true,
    icon: FileSpreadsheet,
  },
  {
    kind: "main",
    title: "Əsas siyahı",
    desc: "Yekun siyahı ilə müqayisə üçün istinad məlumatı.",
    accept: ".xlsx,.xls,.csv",
    multiple: true,
    icon: Database,
  },
  {
    kind: "identity",
    title: "Şəxsiyyət vəsiqələri",
    desc: "PDF, Word və şəkil — tək və ya toplu. Bir faylda çox vəsiqə ola bilər. Yükləndikdən sonra 2-ci addımda emal edin.",
    accept: ".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp",
    multiple: true,
    icon: IdCard,
  },
];

const STATUS_BADGE: Record<string, { tone: "green" | "red" | "amber" | "gray" | "blue"; label: string; icon: typeof CheckCircle2 }> = {
  done: { tone: "green", label: "Hazır", icon: CheckCircle2 },
  failed: { tone: "red", label: "Xəta", icon: XCircle },
  pending: { tone: "gray", label: "Gözləyir", icon: Clock },
  processing: { tone: "blue", label: "Emal olunur", icon: Spinner as unknown as typeof CheckCircle2 },
};

export function UploadPanel({
  project,
  onUpload,
  onDelete,
}: {
  project: Project;
  onUpload: (kind: FileKind, files: File[]) => Promise<string[]>;
  onDelete: (fileId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<FileKind | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (fileId: string) => {
    setDeleting(fileId);
    try {
      await onDelete(fileId);
    } finally {
      setDeleting(null);
    }
  };

  const handle = async (kind: FileKind, files: File[]) => {
    setBusy(kind);
    setWarnings([]);
    try {
      const w = await onUpload(kind, files);
      setWarnings(w);
    } catch (e) {
      setWarnings([(e as Error).message]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
            </div>
          ))}
        </Card>
      )}

      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const files = project.files.filter((f) => f.kind === s.kind);
        return (
          <Card key={s.kind} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Icon className="h-5 w-5 text-brand-600" />
              <div>
                <div className="font-semibold text-slate-800">{s.title}</div>
                <div className="text-xs text-slate-500">{s.desc}</div>
              </div>
            </div>

            {busy === s.kind ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Spinner /> Yüklənir və analiz olunur...
              </div>
            ) : (
              <Dropzone accept={s.accept} multiple={s.multiple} onFiles={(f) => handle(s.kind, f)} />
            )}

            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((f) => {
                  const badge = STATUS_BADGE[f.status] ?? STATUS_BADGE.pending;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="truncate font-medium text-slate-700">{f.name}</span>
                      <div className="flex items-center gap-2">
                        {f.recordCount !== undefined && (
                          <span className="text-xs text-slate-500">{f.recordCount} qeyd</span>
                        )}
                        {f.extractedCount !== undefined && (
                          <span className="text-xs text-slate-500">{f.extractedCount} vəsiqə</span>
                        )}
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleting === f.id}
                          onClick={() => handleDelete(f.id)}
                          title="Sil"
                        >
                          {deleting === f.id ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
