"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { aiStatus } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Badge, Button, Card } from "@/components/ui";

export default function SettingsPage() {
  const store = useStore();
  const { data: ai } = useQuery({ queryKey: ["ai-status"], queryFn: aiStatus });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Parametrlər</h1>
        <p className="text-sm text-slate-500">Sistem vəziyyəti və sessiya idarəetməsi</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">AI provayderi</h2>
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
          AI deaktiv olduqda sənəd çıxarışı deterministik (regex) üsulla işləyir və bütün
          deterministik yoxlamalar (FİN, telefon, tarix, e-poçt) tam fəaliyyət göstərir. Açarı
          <code className="mx-1 rounded bg-slate-100 px-1">.env.local</code> faylında
          <code className="mx-1 rounded bg-slate-100 px-1">DEEPSEEK_API_KEY</code> ilə təyin edin.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Sessiya məlumatları</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Yekun qeydlər</div>
            <div className="text-lg font-bold text-slate-800">{store.finalRecords.length}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Əsas qeydlər</div>
            <div className="text-lg font-bold text-slate-800">{store.mainRecords.length}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Vəsiqələr</div>
            <div className="text-lg font-bold text-slate-800">{store.identities.length}</div>
          </div>
        </div>
        <div className="mt-4">
          <Button variant="danger" onClick={() => store.resetAll()}>
            <Trash2 className="h-4 w-4" /> Bütün sessiya məlumatlarını sil
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Məlumatlar yalnız brauzer sessiyasında saxlanılır, serverdə heç nə qeyd olunmur.
        </p>
      </Card>
    </div>
  );
}
