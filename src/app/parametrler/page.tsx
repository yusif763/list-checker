"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { aiStatus } from "@/lib/api";
import { Badge, Card } from "@/components/ui";

export default function SettingsPage() {
  const { data: ai } = useQuery({ queryKey: ["ai-status"], queryFn: aiStatus });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Parametrlər</h1>
        <p className="text-sm text-slate-500">Sistem vəziyyəti</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">AI provayderi (DeepSeek)</h2>
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            {ai?.enabled ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-slate-400" />
            )}
            <span className="font-medium text-slate-700">{ai?.provider ?? "deepseek"}</span>
          </div>
          <Badge tone={ai?.enabled ? "green" : "gray"}>{ai?.enabled ? "Aktiv" : "Deaktiv"}</Badge>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          AI həm Excel strukturunun analizi (başlıq/sütun aşkarlama), həm də şəxsiyyət
          vəsiqələrinin vision OCR çıxarışı üçün istifadə olunur. Açarı{" "}
          <code className="mx-1 rounded bg-slate-100 px-1">DEEPSEEK_API_KEY</code> ilə təyin edin.
          AI deaktiv olduqda deterministik yoxlamalar işləməyə davam edir.
        </p>
      </Card>

      <Card className="p-5 text-sm text-slate-600">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Saxlama</h2>
        <p className="text-xs text-slate-500">
          Layihələr, fayllar və nəticələr Netlify Blobs-da (lokal inkişafda{" "}
          <code className="rounded bg-slate-100 px-1">.data/</code> qovluğunda) saxlanılır.
          Məlumatlar deploy-lar arası qalır.
        </p>
      </Card>
    </div>
  );
}
