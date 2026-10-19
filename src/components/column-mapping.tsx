"use client";

import {
  CANONICAL_FIELD_LABELS,
  type CanonicalField,
  type ColumnMapping,
  type SheetDetection,
} from "@/lib/types";
import { Badge } from "@/components/ui";
import { AlertTriangle } from "lucide-react";

const FIELD_OPTIONS = Object.keys(CANONICAL_FIELD_LABELS) as CanonicalField[];
const LOW_CONFIDENCE = 0.6;

export function ColumnMapping({
  sheet,
  onChange,
}: {
  sheet: SheetDetection;
  onChange: (mappings: ColumnMapping[]) => void;
}) {
  const update = (index: number, field: CanonicalField | null) => {
    const next = sheet.mappings.map((m) =>
      m.index === index ? { ...m, field, confidence: field ? 1 : 0, source: "manual" as const } : m,
    );
    onChange(next);
  };

  const lowConfidence = sheet.mappings.filter((m) => m.field && m.confidence < LOW_CONFIDENCE);

  return (
    <div className="space-y-3">
      {lowConfidence.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Bəzi sütunlar aşağı inamla uyğunlaşdırılıb. Təsdiqləməzdən əvvəl yoxlayın və lazım
            olarsa düzəldin.
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Excel sütunu</th>
              <th className="px-3 py-2">Nümunə dəyərlər</th>
              <th className="px-3 py-2">İnam</th>
              <th className="px-3 py-2">Uyğunlaşdırma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sheet.mappings.map((m) => {
              const samples = sheet.sampleRows
                .map((r) => r[m.index])
                .filter((v) => v && v !== "")
                .slice(0, 2);
              return (
                <tr key={m.index}>
                  <td className="px-3 py-2 font-medium text-slate-700">{m.header}</td>
                  <td className="px-3 py-2 text-slate-500">{samples.join(", ") || "—"}</td>
                  <td className="px-3 py-2">
                    {m.field ? (
                      <Badge tone={m.confidence >= LOW_CONFIDENCE ? "green" : "amber"}>
                        {Math.round(m.confidence * 100)}%
                      </Badge>
                    ) : (
                      <Badge tone="gray">—</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.field ?? ""}
                      onChange={(e) =>
                        update(m.index, (e.target.value || null) as CanonicalField | null)
                      }
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                    >
                      <option value="">Nəzərə alma</option>
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {CANONICAL_FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
