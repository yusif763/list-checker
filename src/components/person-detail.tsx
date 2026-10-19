"use client";

import { X, CheckCircle2, XCircle, MinusCircle, Check } from "lucide-react";
import {
  CANONICAL_FIELD_LABELS,
  MATCH_STATUS_LABELS,
  type FieldComparison,
  type MatchStatus,
  type VerificationRow,
} from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui";
import type { CanonicalField } from "@/lib/types";
import type { CorrectionsMap } from "@/lib/excel/export";

const MATCH_TONE: Record<MatchStatus, "green" | "red" | "amber" | "blue"> = {
  found: "green",
  found_mismatch: "amber",
  possible: "amber",
  not_found: "red",
  multiple: "blue",
};

function CompIcon({ status }: { status: FieldComparison["status"] }) {
  if (status === "match") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "mismatch") return <XCircle className="h-4 w-4 text-red-500" />;
  return <MinusCircle className="h-4 w-4 text-slate-400" />;
}

function ComparisonTable({
  title,
  comparisons,
  rightLabel,
}: {
  title: string;
  comparisons: FieldComparison[];
  rightLabel: string;
}) {
  if (comparisons.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Sahə</th>
              <th className="px-3 py-2">Yekun Siyahı</th>
              <th className="px-3 py-2">{rightLabel}</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparisons.map((c) => (
              <tr key={c.field} className={c.status === "mismatch" ? "bg-red-50/50" : undefined}>
                <td className="px-3 py-2 font-medium text-slate-600">{CANONICAL_FIELD_LABELS[c.field]}</td>
                <td className="px-3 py-2">{c.finalValue ?? "—"}</td>
                <td className="px-3 py-2">{c.referenceValue ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex justify-center">
                    <CompIcon status={c.status} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PersonDetail({
  row,
  onClose,
  corrections: allCorrections,
  onSetCorrection,
  onClearCorrection,
}: {
  row: VerificationRow;
  onClose: () => void;
  corrections: CorrectionsMap;
  onSetCorrection: (recordId: string, field: CanonicalField, value: string) => void;
  onClearCorrection: (recordId: string, field: CanonicalField) => void;
}) {
  const corrections = allCorrections[row.record.id] ?? {};

  const name =
    [row.record.normalized.lastName, row.record.normalized.firstName, row.record.normalized.patronymic]
      .filter(Boolean)
      .join(" ") || "Ad yoxdur";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="text-lg font-bold text-slate-800">{name}</div>
            <div className="text-xs text-slate-500">
              {row.record.sourceFile} • vərəq: {row.record.sheetName} • sətir: {row.record.rowNumber}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-6">
          {/* Əsas Siyahı nəticəsi */}
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Əsas Siyahı uyğunluğu</h3>
              {row.mainListMatch ? (
                <Badge tone={MATCH_TONE[row.mainListMatch.status]}>
                  {MATCH_STATUS_LABELS[row.mainListMatch.status]}
                </Badge>
              ) : (
                <Badge tone="gray">Əsas Siyahı yüklənməyib</Badge>
              )}
            </div>
            {row.mainListMatch && (
              <>
                <p className="mb-3 text-xs text-slate-500">{row.mainListMatch.explanation}</p>
                <ComparisonTable
                  title=""
                  comparisons={row.mainListMatch.comparisons}
                  rightLabel="Əsas Siyahı"
                />
              </>
            )}
          </Card>

          {/* Şəxsiyyət vəsiqəsi */}
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Şəxsiyyət vəsiqəsi</h3>
              {row.identityMatch ? (
                <Badge tone={row.identityMatch.hasMismatch ? "amber" : "green"}>
                  {row.identityMatch.hasMismatch ? "Uyğunsuzluq var" : "Uyğun"}
                </Badge>
              ) : (
                <Badge tone="gray">Vəsiqə tapılmadı</Badge>
              )}
            </div>
            {row.identityMatch && (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  Mənbə: {row.identityMatch.identity.sourceFile}
                  {row.identityMatch.identity.pageNumber
                    ? ` • səhifə ${row.identityMatch.identity.pageNumber}`
                    : ""}{" "}
                  • üsul: {row.identityMatch.identity.method} • inam{" "}
                  {Math.round(row.identityMatch.identity.confidence * 100)}%
                </p>
                <ComparisonTable title="" comparisons={row.identityMatch.comparisons} rightLabel="Vəsiqə" />
              </>
            )}
          </Card>

          {/* Yoxlama problemləri + düzəlişlər */}
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Yoxlama problemləri ({row.validationIssues.length})
            </h3>
            {row.validationIssues.length === 0 ? (
              <p className="text-sm text-emerald-600">Problem yoxdur.</p>
            ) : (
              <div className="space-y-2">
                {row.validationIssues.map((issue, i) => {
                  const applied = corrections[issue.field];
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-slate-700">
                            {CANONICAL_FIELD_LABELS[issue.field]}:
                          </span>{" "}
                          <span className="text-slate-600">{issue.message}</span>
                        </div>
                        <Badge
                          tone={issue.severity === "error" ? "red" : issue.severity === "warning" ? "amber" : "blue"}
                        >
                          {issue.severity === "error" ? "Səhv" : issue.severity === "warning" ? "Xəb." : "İnfo"}
                        </Badge>
                      </div>
                      {issue.suggestion && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5">
                          <div className="text-xs text-slate-500">
                            Təklif: <span className="font-medium text-slate-700">{issue.suggestion}</span>
                            {issue.originalValue && (
                              <span className="text-slate-400"> (əvvəl: {issue.originalValue})</span>
                            )}
                          </div>
                          {applied === issue.suggestion ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onClearCorrection(row.record.id, issue.field)}
                            >
                              Geri al
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() =>
                                onSetCorrection(row.record.id, issue.field, issue.suggestion!)
                              }
                            >
                              <Check className="h-3 w-3" /> Qəbul et
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {Object.keys(corrections).length > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <div className="mb-1 font-medium">Tətbiq olunmuş düzəlişlər:</div>
                {Object.entries(corrections).map(([field, value]) => (
                  <div key={field}>
                    {CANONICAL_FIELD_LABELS[field as keyof typeof CANONICAL_FIELD_LABELS]}: {value}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {row.duplicateOf.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Təkrar qrupları</h3>
              <div className="flex flex-wrap gap-2">
                {row.duplicateOf.map((k) => (
                  <Badge key={k} tone="amber">
                    {k}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
