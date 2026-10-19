"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Database, FileSpreadsheet, IdCard } from "lucide-react";
import { aiStatus } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ExcelUploadStep } from "@/components/excel-upload-step";
import { IdentityUploadStep } from "@/components/identity-upload-step";

type Step = "yekun" | "esas" | "vesiqe";

const STEPS: { id: Step; label: string; icon: typeof FileSpreadsheet }[] = [
  { id: "yekun", label: "Yekun Siyahı", icon: FileSpreadsheet },
  { id: "esas", label: "Əsas Siyahı", icon: Database },
  { id: "vesiqe", label: "Şəxsiyyət vəsiqələri", icon: IdCard },
];

function WizardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("addim") as Step) || "yekun";
  const [step, setStep] = useState<Step>(STEPS.some((s) => s.id === initial) ? initial : "yekun");

  const store = useStore();
  const { data: ai } = useQuery({ queryKey: ["ai-status"], queryFn: aiStatus });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Yükləmə sehrbazı</h1>
        <p className="mt-1 text-sm text-slate-500">
          Yekun Siyahı əsas mənbədir. Əsas Siyahı və vəsiqələr onunla müqayisə olunur.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const count =
            s.id === "yekun"
              ? store.finalRecords.length
              : s.id === "esas"
                ? store.mainRecords.length
                : store.identities.length;
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                step === s.id
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon className="h-4 w-4" />
              {s.label}
              {count > 0 && (
                <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {step === "yekun" && (
        <ExcelUploadStep
          idPrefix={`final-${store.finalRecords.length}`}
          onComplete={(records) => store.addFinalRecords(records)}
        />
      )}
      {step === "esas" && (
        <>
          {store.finalRecords.length === 0 && (
            <Card className="mb-4 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Qeyd: Əsas Siyahı Yekun Siyahı ilə müqayisə olunur. Əvvəlcə Yekun Siyahı yükləmək
              tövsiyə olunur.
            </Card>
          )}
          <ExcelUploadStep idPrefix="main" onComplete={(records) => store.setMainRecords(records)} />
        </>
      )}
      {step === "vesiqe" && (
        <IdentityUploadStep
          aiEnabled={ai?.enabled ?? false}
          onComplete={(identities, warnings) => {
            store.addIdentities(identities);
            if (warnings.length) store.addWarnings(warnings);
          }}
        />
      )}

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="text-sm text-slate-500">
          Yekun: {store.finalRecords.length} • Əsas: {store.mainRecords.length} • Vəsiqə:{" "}
          {store.identities.length}
        </div>
        <Button onClick={() => router.push("/")} disabled={store.finalRecords.length === 0}>
          Nəticələrə keç <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function UploadWizardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Yüklənir...</div>}>
      <WizardInner />
    </Suspense>
  );
}
