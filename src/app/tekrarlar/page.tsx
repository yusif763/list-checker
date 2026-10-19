"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { DUPLICATE_TYPE_LABELS, type VerificationRow } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Badge, Button, Card } from "@/components/ui";

export default function DuplicatesPage() {
  const store = useStore();
  const { rows, duplicates } = store.verification;
  const byId = useMemo(() => new Map(rows.map((r) => [r.record.id, r])), [rows]);

  const name = (row: VerificationRow | undefined) =>
    row
      ? [row.record.normalized.lastName, row.record.normalized.firstName, row.record.normalized.patronymic]
          .filter(Boolean)
          .join(" ") || "—"
      : "—";

  if (duplicates.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <Users className="mb-3 h-10 w-10 text-slate-300" />
        <h1 className="text-lg font-bold text-slate-700">Təkrar tapılmadı</h1>
        <p className="mt-2 text-sm text-slate-500">
          Yekun Siyahı qeydləri arasında təkrarlanan şəxs və ya FİN aşkarlanmadı.
        </p>
        <Link href="/yukle" className="mt-4">
          <Button variant="secondary">Fayl yüklə</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Təkrarlanan şəxslər</h1>
        <p className="text-sm text-slate-500">{duplicates.length} təkrar qrupu aşkarlandı</p>
      </div>

      {duplicates.map((group) => (
        <Card key={group.key} className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <Badge
              tone={
                group.type === "same_fin_diff_name"
                  ? "red"
                  : group.type === "same_fin_same_person"
                    ? "amber"
                    : "blue"
              }
            >
              {DUPLICATE_TYPE_LABELS[group.type]}
            </Badge>
            <span className="text-xs text-slate-500">{group.recordIds.length} qeyd</span>
          </div>
          <p className="mb-3 text-xs text-slate-500">{group.recommendation}</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Şəxs</th>
                  <th className="px-3 py-2">FİN</th>
                  <th className="px-3 py-2">Mənbə</th>
                  <th className="px-3 py-2">Sətir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.recordIds.map((id) => {
                  const row = byId.get(id);
                  return (
                    <tr key={id}>
                      <td className="px-3 py-2 font-medium text-slate-700">{name(row)}</td>
                      <td className="px-3 py-2 text-slate-500">{row?.record.normalized.finCode ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{row?.record.sourceFile ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{row?.record.rowNumber ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
