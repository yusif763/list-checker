"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Play, RefreshCw, IdCard } from "lucide-react";
import type { Project } from "@/lib/projects/types";
import { Badge, Button, Card, Spinner } from "@/components/ui";

export function ProcessPanel({
  project,
  onProcessStep,
}: {
  project: Project;
  onProcessStep: (fileId?: string) => Promise<number>;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identityFiles = project.files.filter((f) => f.kind === "identity");
  const pending = identityFiles.filter((f) => f.status === "pending").length;
  const done = identityFiles.filter((f) => f.status === "done").length;

  const processAll = async () => {
    setRunning(true);
    setError(null);
    try {
      // Addım-addım: hər gözləyən faylı ardıcıl emal et.
      // Qoruyucu limit (sonsuz dövrün qarşısını alır).
      for (let i = 0; i < identityFiles.length + 2; i++) {
        const remaining = await onProcessStep();
        if (remaining === 0) break;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const reprocess = async (fileId: string) => {
    setRunning(true);
    setError(null);
    try {
      await onProcessStep(fileId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (identityFiles.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-slate-500">
        Hələ şəxsiyyət vəsiqəsi yüklənməyib. 1-ci addımda yükləyin.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-slate-600">
          {identityFiles.length} fayl • {done} emal olunub • {pending} gözləyir
        </div>
        <Button onClick={processAll} disabled={running || pending === 0}>
          {running ? <Spinner /> : <Play className="h-4 w-4" />}
          {pending === 0 ? "Hamısı emal olunub" : `Emalı başlat (${pending})`}
        </Button>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-2">
        {identityFiles.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-brand-500" />
                <div>
                  <div className="font-medium text-slate-700">{f.name}</div>
                  {f.extractedCount !== undefined && (
                    <div className="text-xs text-slate-500">{f.extractedCount} vəsiqə çıxarıldı</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {f.status === "done" && (
                  <Badge tone="green">
                    <CheckCircle2 className="h-3 w-3" /> Hazır
                  </Badge>
                )}
                {f.status === "failed" && (
                  <Badge tone="red">
                    <XCircle className="h-3 w-3" /> Xəta
                  </Badge>
                )}
                {f.status === "pending" && (
                  <Badge tone="gray">
                    <Clock className="h-3 w-3" /> Gözləyir
                  </Badge>
                )}
                {f.status === "processing" && (
                  <Badge tone="blue">
                    <Spinner className="h-3 w-3" /> Emal olunur
                  </Badge>
                )}
                {(f.status === "done" || f.status === "failed") && (
                  <Button variant="ghost" size="sm" disabled={running} onClick={() => reprocess(f.id)}>
                    <RefreshCw className="h-3 w-3" /> Təkrar
                  </Button>
                )}
              </div>
            </div>
            {f.error && (
              <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">{f.error}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
