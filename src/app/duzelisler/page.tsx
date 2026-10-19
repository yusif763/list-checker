"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, Wand2 } from "lucide-react";
import { CANONICAL_FIELD_LABELS, type CanonicalField } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Badge, Button, Card } from "@/components/ui";

interface Suggestion {
  recordId: string;
  field: CanonicalField;
  name: string;
  original: string | null;
  suggestion: string;
  applied: boolean;
}

export default function CorrectionsPage() {
  const store = useStore();
  const { rows } = store.verification;

  const suggestions = useMemo<Suggestion[]>(() => {
    const list: Suggestion[] = [];
    for (const row of rows) {
      const name =
        [row.record.normalized.lastName, row.record.normalized.firstName]
          .filter(Boolean)
          .join(" ") || row.record.sourceFile;
      for (const issue of row.validationIssues) {
        if (!issue.suggestion) continue;
        list.push({
          recordId: row.record.id,
          field: issue.field,
          name,
          original: issue.originalValue,
          suggestion: issue.suggestion,
          applied: store.corrections[row.record.id]?.[issue.field] === issue.suggestion,
        });
      }
    }
    return list;
  }, [rows, store.corrections]);

  const pending = suggestions.filter((s) => !s.applied);
  const applied = suggestions.filter((s) => s.applied);

  const acceptAll = () => {
    for (const s of pending) store.setCorrection(s.recordId, s.field, s.suggestion);
  };

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <Wand2 className="mb-3 h-10 w-10 text-slate-300" />
        <h1 className="text-lg font-bold text-slate-700">Düzəliş təklifi yoxdur</h1>
        <p className="mt-2 text-sm text-slate-500">
          Təhlükəsiz avtomatik düzəliş (format, boşluq, baş hərf) tələb edən sahə tapılmadı.
        </p>
        <Link href="/" className="mt-4">
          <Button variant="secondary">Panelə qayıt</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Düzəlişlər</h1>
          <p className="text-sm text-slate-500">
            {pending.length} gözləyən • {applied.length} tətbiq olunub
          </p>
        </div>
        <Button onClick={acceptAll} disabled={pending.length === 0}>
          <Check className="h-4 w-4" /> Hamısını qəbul et ({pending.length})
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Şəxs</th>
                <th className="px-4 py-3">Sahə</th>
                <th className="px-4 py-3">Əvvəl</th>
                <th className="px-4 py-3">Sonra</th>
                <th className="px-4 py-3 text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suggestions.map((s, i) => (
                <tr key={`${s.recordId}-${s.field}-${i}`} className={s.applied ? "bg-emerald-50/40" : undefined}>
                  <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{CANONICAL_FIELD_LABELS[s.field]}</td>
                  <td className="px-4 py-3 text-slate-400 line-through">{s.original ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{s.suggestion}</td>
                  <td className="px-4 py-3 text-right">
                    {s.applied ? (
                      <div className="flex items-center justify-end gap-2">
                        <Badge tone="green">Tətbiq olundu</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => store.clearCorrection(s.recordId, s.field)}
                        >
                          Geri al
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => store.setCorrection(s.recordId, s.field, s.suggestion)}>
                        Qəbul et
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
