"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  MATCH_STATUS_LABELS,
  type MatchStatus,
  type CanonicalField,
  type VerificationRow,
} from "@/lib/types";
import type { VerificationOutput } from "@/lib/verification";
import type { CorrectionsMap } from "@/lib/excel/export";
import { Badge, Card, Button, StatCard } from "@/components/ui";
import { PersonDetail } from "@/components/person-detail";
import { cn } from "@/lib/cn";

type Filter = "all" | "errors" | "no_main" | "identity_mismatch" | "duplicates";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Hamısı" },
  { id: "errors", label: "Səhvli" },
  { id: "no_main", label: "Əsas Siyahıda yoxdur" },
  { id: "identity_mismatch", label: "Vəsiqə uyğunsuzluğu" },
  { id: "duplicates", label: "Təkrarlar" },
];

const MATCH_TONE: Record<MatchStatus, "green" | "red" | "amber" | "blue"> = {
  found: "green",
  found_mismatch: "amber",
  possible: "amber",
  not_found: "red",
  multiple: "blue",
};

const PAGE_SIZE = 25;

function personName(row: VerificationRow): string {
  return (
    [row.record.normalized.lastName, row.record.normalized.firstName, row.record.normalized.patronymic]
      .filter(Boolean)
      .join(" ") ||
    row.record.raw.fullName ||
    "—"
  );
}

export function ResultsPanel({
  verification,
  corrections,
  onSetCorrection,
  onClearCorrection,
}: {
  verification: VerificationOutput;
  corrections: CorrectionsMap;
  onSetCorrection: (recordId: string, field: CanonicalField, value: string) => void;
  onClearCorrection: (recordId: string, field: CanonicalField) => void;
}) {
  const { rows, metrics } = verification;
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<VerificationRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("az");
    return rows.filter((row) => {
      if (q) {
        const hay = `${personName(row)} ${row.record.normalized.finCode ?? ""}`.toLocaleLowerCase("az");
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "errors":
          return row.validationIssues.some((i) => i.severity === "error");
        case "no_main":
          return row.mainListMatch?.status === "not_found";
        case "identity_mismatch":
          return row.identityMatch?.hasMismatch ?? false;
        case "duplicates":
          return row.duplicateOf.length > 0;
        default:
          return true;
      }
    });
  }, [rows, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-slate-500">
        Nəticə yoxdur. Əvvəlcə Yekun siyahı yükləyin (1-ci addım).
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Yekun qeydlər" value={metrics.totalRecords} tone="blue" />
        <StatCard label="Düzgün" value={metrics.validRecords} tone="green" />
        <StatCard label="Səhvli" value={metrics.recordsWithErrors} tone="red" />
        <StatCard label="Əsasda var" value={metrics.foundInMainList} tone="green" />
        <StatCard label="Əsasda yox" value={metrics.notFoundInMainList} tone="amber" />
        <StatCard label="Vəsiqə uyğunsuz" value={metrics.identityMismatches} tone="amber" />
        <StatCard label="Vəsiqə tapıldı" value={metrics.identitiesMatched} tone="green" />
        <StatCard label="Vəsiqə yox" value={metrics.identitiesMissing} tone="gray" />
        <StatCard label="Təkrarlar" value={metrics.duplicateRecords} tone="amber" />
        <StatCard label="Yanlış telefon" value={metrics.invalidPhones} tone="red" />
        <StatCard label="Yanlış FİN" value={metrics.invalidFins} tone="red" />
        <StatCard label="Yanlış tarix" value={metrics.invalidDates} tone="red" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(0);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.id
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Ad və ya FİN üzrə axtar..."
            className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Şəxs</th>
                <th className="px-4 py-3">FİN</th>
                <th className="px-4 py-3">Əsas Siyahı</th>
                <th className="px-4 py-3">Vəsiqə</th>
                <th className="px-4 py-3">Təkrar</th>
                <th className="px-4 py-3 text-center">Problem</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {current.map((row) => (
                <tr
                  key={row.record.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(row)}
                >
                  <td className="px-4 py-3 font-medium text-slate-700">{personName(row)}</td>
                  <td className="px-4 py-3 text-slate-500">{row.record.normalized.finCode ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.mainListMatch ? (
                      <Badge tone={MATCH_TONE[row.mainListMatch.status]}>
                        {MATCH_STATUS_LABELS[row.mainListMatch.status]}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.identityMatch ? (
                      <Badge tone={row.identityMatch.hasMismatch ? "amber" : "green"}>
                        {row.identityMatch.hasMismatch ? "Uyğunsuz" : "Uyğun"}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">Yoxdur</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.duplicateOf.length > 0 ? (
                      <Badge tone="amber">Bəli</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={row.issueCount > 0 ? "red" : "green"}>{row.issueCount}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm">
                      Detallar
                    </Button>
                  </td>
                </tr>
              ))}
              {current.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Bu filtrə uyğun qeyd tapılmadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              {filtered.length} qeyddən {page * PAGE_SIZE + 1}–
              {Math.min(filtered.length, (page + 1) * PAGE_SIZE)}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Əvvəlki
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Növbəti
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selected && (
        <PersonDetail
          row={selected}
          onClose={() => setSelected(null)}
          corrections={corrections}
          onSetCorrection={onSetCorrection}
          onClearCorrection={onClearCorrection}
        />
      )}
    </div>
  );
}
