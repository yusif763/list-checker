"use client";

import Link from "next/link";
import { Download, FileBarChart } from "lucide-react";
import { useStore } from "@/lib/store";
import { downloadReport } from "@/lib/download";
import { Button, Card } from "@/components/ui";

export default function ReportsPage() {
  const store = useStore();
  const { rows, duplicates, metrics } = store.verification;

  const reportTypes = [
    { title: "Düzəldilmiş Yekun Siyahı", desc: "Təsdiqlənmiş düzəlişlərlə bütün qeydlər", count: rows.length },
    { title: "Tam yoxlama hesabatı", desc: "Hər qeyd + bütün müqayisə statusları", count: rows.length },
    {
      title: "Səhvlər hesabatı",
      desc: "Aşkarlanmış bütün problemlər (hər problem bir sətir)",
      count: rows.reduce((s, r) => s + r.validationIssues.filter((i) => i.severity !== "info").length, 0),
    },
    { title: "Əsas Siyahıda tapılmayanlar", desc: "Əsas Siyahıda uyğunu olmayan şəxslər", count: metrics.notFoundInMainList },
    { title: "Vəsiqə uyğunsuzluqları", desc: "Vəsiqə məlumatı fərqlənən şəxslər", count: metrics.identityMismatches },
    { title: "Təkrarlar hesabatı", desc: "Dəqiq və ehtimal olunan təkrarlar", count: duplicates.length },
  ];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <FileBarChart className="mb-3 h-10 w-10 text-slate-300" />
        <h1 className="text-lg font-bold text-slate-700">Hesabat üçün məlumat yoxdur</h1>
        <Link href="/yukle" className="mt-4">
          <Button variant="secondary">Fayl yüklə</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hesabatlar</h1>
          <p className="text-sm text-slate-500">
            Bütün hesabatlar bir Excel faylında ayrı-ayrı vərəqlər kimi ixrac olunur.
          </p>
        </div>
        <Button onClick={() => downloadReport(store.verification, store.corrections)}>
          <Download className="h-4 w-4" /> Excel hesabatı yüklə
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {reportTypes.map((r) => (
          <Card key={r.title} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-slate-800">{r.title}</div>
              <div className="text-sm text-slate-500">{r.desc}</div>
            </div>
            <div className="text-2xl font-bold text-brand-600">{r.count}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
