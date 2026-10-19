"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Sparkles, X, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import {
  CANONICAL_FIELD_LABELS,
  MATCH_STATUS_LABELS,
  type CanonicalField,
  type FieldComparison,
  type MatchStatus,
  type PersonRecord,
} from "@/lib/types";
import type { AiCompareResult, ComparePair } from "@/lib/ai/compare";
import { aiStatus } from "@/lib/api";
import { aiCompareBatch, matchLists, parseFile, type ComparePairResult } from "@/lib/compare/client";
import { Badge, Button, Card, Spinner, StatCard } from "@/components/ui";
import { Dropzone } from "@/components/dropzone";

const MATCH_TONE: Record<MatchStatus, "green" | "red" | "amber" | "blue"> = {
  found: "green",
  found_mismatch: "amber",
  possible: "amber",
  not_found: "red",
  multiple: "blue",
};

function personName(r?: PersonRecord): string {
  if (!r) return "—";
  return (
    [r.normalized.lastName, r.normalized.firstName, r.normalized.patronymic].filter(Boolean).join(" ") ||
    r.normalized.fullName ||
    r.raw.fullName ||
    "—"
  );
}

function CompIcon({ status }: { status: FieldComparison["status"] }) {
  if (status === "match") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "mismatch") return <XCircle className="h-4 w-4 text-red-500" />;
  return <MinusCircle className="h-4 w-4 text-slate-400" />;
}

export default function ComparePage() {
  const { data: ai } = useQuery({ queryKey: ["ai-status"], queryFn: aiStatus });

  const [aRecords, setA] = useState<PersonRecord[]>([]);
  const [bRecords, setB] = useState<PersonRecord[]>([]);
  const [aName, setAName] = useState("");
  const [bName, setBName] = useState("");
  const [busy, setBusy] = useState<"A" | "B" | "match" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pairs, setPairs] = useState<ComparePairResult[]>([]);
  const [onlyInB, setOnlyInB] = useState<string[]>([]);
  const [aiResults, setAiResults] = useState<Record<string, AiCompareResult[]>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [selected, setSelected] = useState<ComparePairResult | null>(null);

  const aById = useMemo(() => new Map(aRecords.map((r) => [r.id, r])), [aRecords]);
  const bById = useMemo(() => new Map(bRecords.map((r) => [r.id, r])), [bRecords]);

  const upload = async (side: "A" | "B", files: File[]) => {
    setBusy(side);
    setError(null);
    try {
      const res = await parseFile(files[0], side);
      if (side === "A") {
        setA(res.records);
        setAName(res.fileName);
      } else {
        setB(res.records);
        setBName(res.fileName);
      }
      setPairs([]);
      setAiResults({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runMatch = async () => {
    setBusy("match");
    setError(null);
    try {
      const res = await matchLists(aRecords, bRecords);
      setPairs(res.pairs);
      setOnlyInB(res.onlyInB);
      setAiResults({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const summary = useMemo(() => {
    const found = pairs.filter((p) => p.match.status === "found").length;
    const mismatch = pairs.filter((p) => p.match.status === "found_mismatch").length;
    const possible = pairs.filter((p) => p.match.status === "possible").length;
    const notFound = pairs.filter((p) => p.match.status === "not_found").length;
    return { found, mismatch, possible, notFound };
  }, [pairs]);

  const runAi = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      // AI üçün yalnız B-də uyğunu olan cütlər.
      const matched = pairs.filter((p) => p.match.matchedRecordId);
      const buildPairs = (p: ComparePairResult): ComparePair[] =>
        p.match.comparisons
          .filter((c) => c.finalValue && c.referenceValue)
          .map((c) => ({
            field: c.field,
            label: CANONICAL_FIELD_LABELS[c.field],
            finalValue: c.finalValue!,
            referenceValue: c.referenceValue!,
          }));

      const queue = matched.map((p) => ({ aId: p.aId, pairs: buildPairs(p) }));
      let i = 0;
      while (i < queue.length) {
        const batch = queue.slice(i, i + 5);
        const { results } = await aiCompareBatch(batch);
        setAiResults((prev) => ({ ...prev, ...results }));
        i += batch.length;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const ready = aRecords.length > 0 && bRecords.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">İki Yekun siyahının tutuşdurulması</h1>
        <p className="text-sm text-slate-500">
          İki Yekun cədvəlini bütün sütunlar üzrə tutuşdurun — təkrarlanan şəxslər, uyğunsuzluqlar və
          fərqlər AI qərarı ilə müəyyən edilir.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["A", "B"] as const).map((side) => {
          const name = side === "A" ? aName : bName;
          const count = side === "A" ? aRecords.length : bRecords.length;
          return (
            <Card key={side} className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileSpreadsheet className="h-4 w-4 text-brand-600" /> Siyahı {side}
                {count > 0 && <span className="text-xs font-normal text-slate-400">— {name} ({count} qeyd)</span>}
              </div>
              {busy === side ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                  <Spinner /> Analiz olunur...
                </div>
              ) : (
                <Dropzone accept=".xlsx,.xls,.csv" onFiles={(f) => upload(side, f)} hint="XLSX / XLS / CSV" />
              )}
            </Card>
          );
        })}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {ready && (
        <div className="flex items-center gap-2">
          <Button onClick={runMatch} disabled={busy === "match"}>
            {busy === "match" ? <Spinner /> : null} Tutuşdur
          </Button>
          {pairs.length > 0 && (
            <Button variant="secondary" onClick={runAi} disabled={analyzing || !ai?.enabled}>
              {analyzing ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {ai?.enabled ? "AI ilə dəqiqləşdir" : "AI deaktiv"}
            </Button>
          )}
          {Object.keys(aiResults).length > 0 && (
            <span className="text-xs text-slate-400">{Object.keys(aiResults).length} cüt AI ilə təhlil olundu</span>
          )}
        </div>
      )}

      {pairs.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Siyahı A" value={aRecords.length} tone="blue" />
            <StatCard label="Tapıldı (B-də)" value={summary.found} tone="green" />
            <StatCard label="Uyğunsuzluq" value={summary.mismatch} tone="amber" />
            <StatCard label="A-da tək (B-də yox)" value={summary.notFound} tone="red" />
            <StatCard label="B-də tək (A-da yox)" value={onlyInB.length} tone="gray" />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Şəxs (A)</th>
                    <th className="px-4 py-3">FİN</th>
                    <th className="px-4 py-3">B-də vəziyyət</th>
                    <th className="px-4 py-3 text-center">Fərqli sahə</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pairs.map((p) => {
                    const a = aById.get(p.aId);
                    const mismatches = p.match.comparisons.filter((c) => c.status === "mismatch").length;
                    return (
                      <tr key={p.aId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(p)}>
                        <td className="px-4 py-3 font-medium text-slate-700">{personName(a)}</td>
                        <td className="px-4 py-3 text-slate-500">{a?.normalized.finCode ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={MATCH_TONE[p.match.status]}>{MATCH_STATUS_LABELS[p.match.status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {mismatches > 0 ? <Badge tone="amber">{mismatches}</Badge> : <span className="text-slate-400">0</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm">Detallar</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {selected && (
        <CompareDetail
          pair={selected}
          a={aById.get(selected.aId)}
          b={selected.match.matchedRecordId ? bById.get(selected.match.matchedRecordId) : undefined}
          ai={aiResults[selected.aId]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CompareDetail({
  pair,
  a,
  b,
  ai,
  onClose,
}: {
  pair: ComparePairResult;
  a?: PersonRecord;
  b?: PersonRecord;
  ai?: AiCompareResult[];
  onClose: () => void;
}) {
  const aiByField = new Map((ai ?? []).map((r) => [r.field, r]));
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="text-lg font-bold text-slate-800">{personName(a)}</div>
            <div className="text-xs text-slate-500">
              {MATCH_STATUS_LABELS[pair.match.status]} • {pair.match.explanation}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">
          {pair.match.comparisons.length === 0 ? (
            <Card className="p-4 text-sm text-slate-500">B-də uyğun qeyd tapılmadı — müqayisə yoxdur.</Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Sahə</th>
                    <th className="px-3 py-2">A</th>
                    <th className="px-3 py-2">B</th>
                    <th className="px-3 py-2 text-center">Nəticə</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pair.match.comparisons.map((c) => {
                    const aiv = aiByField.get(c.field);
                    return (
                      <tr key={c.field} className={c.status === "mismatch" && !(aiv?.status === "match") ? "bg-red-50/50" : undefined}>
                        <td className="px-3 py-2 font-medium text-slate-600">
                          {CANONICAL_FIELD_LABELS[c.field as CanonicalField]}
                        </td>
                        <td className="px-3 py-2">{c.finalValue ?? "—"}</td>
                        <td className="px-3 py-2">{c.referenceValue ?? "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {aiv ? (
                            <Badge tone={aiv.status === "mismatch" ? "red" : aiv.status === "uncertain" ? "amber" : "green"}>
                              {aiv.status === "mismatch" ? "Fərqli" : aiv.status === "uncertain" ? "?" : "Uyğun"}
                            </Badge>
                          ) : (
                            <span className="inline-flex justify-center"><CompIcon status={c.status} /></span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {ai && ai.some((r) => r.note) && (
            <Card className="mt-4 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">AI izahları</h3>
              <div className="space-y-1 text-xs text-slate-600">
                {ai.filter((r) => r.note).map((r, i) => (
                  <div key={i}>
                    <strong>{CANONICAL_FIELD_LABELS[r.field as CanonicalField] ?? r.field}:</strong> {r.note}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
