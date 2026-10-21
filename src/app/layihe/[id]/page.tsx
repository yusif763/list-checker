"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import type { Project } from "@/lib/projects/types";
import type { CanonicalField } from "@/lib/types";
import { deleteFile, getProject, processNext, saveCorrections, uploadFiles } from "@/lib/projects/client";
import { buildVerification } from "@/lib/verification";
import { downloadReport } from "@/lib/download";
import type { CorrectionsMap } from "@/lib/excel/export";
import { Button, Card, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { UploadPanel } from "@/components/project/upload-panel";
import { ProcessPanel } from "@/components/project/process-panel";
import { ResultsPanel } from "@/components/project/results-panel";

type Tab = "yukle" | "emal" | "neticeler" | "hesabat";

const TABS: { id: Tab; label: string }[] = [
  { id: "yukle", label: "1. Yüklə" },
  { id: "emal", label: "2. Vəsiqə emalı" },
  { id: "neticeler", label: "3. Nəticələr" },
  { id: "hesabat", label: "4. Hesabat" },
];

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>("yukle");
  const [autoProcessing, setAutoProcessing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  // Vəsiqələri avtomatik, hissə-hissə emal et (remaining 0 olana qədər).
  const runProcessLoop = async () => {
    setAutoProcessing(true);
    try {
      let guard = 0;
      while (guard < 2000) {
        const r = await processNext(id);
        setProject(r.project);
        guard++;
        if (r.remaining === 0) break;
      }
    } finally {
      setAutoProcessing(false);
    }
  };

  const handleUpload = async (kind: "final" | "main" | "identity", files: File[]) => {
    const res = await uploadFiles(id, kind, files);
    setProject(res.project);
    // Yeni vəsiqə faylları yüklənəndə emalı avtomatik başlat.
    if (kind === "identity") {
      setTab("emal");
      void runProcessLoop();
    }
    return res.warnings;
  };

  const handleDelete = async (fileId: string) => {
    setProject(await deleteFile(id, fileId));
  };

  useEffect(() => {
    if (data) setProject(data);
  }, [data]);

  const verification = useMemo(
    () =>
      project
        ? buildVerification({
            finalRecords: project.finalRecords,
            mainRecords: project.mainRecords,
            identities: project.identities,
          })
        : null,
    [project],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Layihə yüklənir...
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Layihə yüklənmədi: {(error as Error)?.message}</p>
        <Link href="/">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Layihələrə qayıt
          </Button>
        </Link>
      </div>
    );
  }

  const corrections: CorrectionsMap = project.corrections ?? {};

  const setCorrection = (recordId: string, field: CanonicalField, value: string) => {
    setProject((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        corrections: {
          ...prev.corrections,
          [recordId]: { ...(prev.corrections[recordId] ?? {}), [field]: value },
        },
      };
      void saveCorrections(id, next.corrections);
      return next;
    });
  };
  const clearCorrection = (recordId: string, field: CanonicalField) => {
    setProject((prev) => {
      if (!prev) return prev;
      const rec = { ...(prev.corrections[recordId] ?? {}) };
      delete rec[field];
      const next = { ...prev, corrections: { ...prev.corrections, [recordId]: rec } };
      void saveCorrections(id, next.corrections);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
            <p className="text-xs text-slate-500">
              Yekun: {project.finalRecords.length} • Əsas: {project.mainRecords.length} • Vəsiqə:{" "}
              {project.identities.length}
            </p>
          </div>
        </div>
        {verification && verification.rows.length > 0 && (
          <Button onClick={() => downloadReport(verification, corrections)}>
            <Download className="h-4 w-4" /> Excel ixrac
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "yukle" && (
        <UploadPanel project={project} onUpload={handleUpload} onDelete={handleDelete} />
      )}

      {tab === "emal" && (
        <ProcessPanel
          project={project}
          busy={autoProcessing}
          onProcessStep={async (fileId) => {
            const res = await processNext(id, fileId);
            setProject(res.project);
            return res.remaining;
          }}
        />
      )}

      {tab === "neticeler" && verification && (
        <ResultsPanel
          verification={verification}
          corrections={corrections}
          onSetCorrection={setCorrection}
          onClearCorrection={clearCorrection}
        />
      )}

      {tab === "hesabat" && verification && (
        <div className="space-y-4">
          <Card className="flex items-center justify-between p-5">
            <div>
              <div className="font-medium text-slate-800">Excel hesabatı</div>
              <div className="text-sm text-slate-500">
                Düzəldilmiş siyahı, tam hesabat, səhvlər, əsas siyahıda yoxlar, vəsiqə
                uyğunsuzluqları və təkrarlar — bir faylda.
              </div>
            </div>
            <Button onClick={() => downloadReport(verification, corrections)}>
              <Download className="h-4 w-4" /> Yüklə
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
