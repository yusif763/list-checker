"use client";

import { useState } from "react";
import { CheckCircle2, FileSpreadsheet } from "lucide-react";
import type { ColumnMapping, ParsedSheetResult, PersonRecord, SheetDetection } from "@/lib/types";
import { buildRecordsRequest, detectWorkbook } from "@/lib/api";
import { Button, Card, Spinner } from "@/components/ui";
import { Dropzone } from "@/components/dropzone";
import { ColumnMapping as ColumnMappingTable } from "@/components/column-mapping";

export function ExcelUploadStep({
  idPrefix,
  requireNameOrFin = true,
  onComplete,
}: {
  idPrefix: string;
  requireNameOrFin?: boolean;
  onComplete: (records: PersonRecord[], fileName: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [detection, setDetection] = useState<ParsedSheetResult | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mappingsBySheet, setMappingsBySheet] = useState<Record<number, ColumnMapping[]>>({});
  const [busy, setBusy] = useState<"detect" | "build" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ count: number; file: string } | null>(null);

  const reset = () => {
    setFile(null);
    setDetection(null);
    setSheetIdx(0);
    setMappingsBySheet({});
    setError(null);
    setDone(null);
  };

  const handleFile = async (files: File[]) => {
    reset();
    const f = files[0];
    setFile(f);
    setBusy("detect");
    try {
      const result = await detectWorkbook(f);
      setDetection(result);
      const init: Record<number, ColumnMapping[]> = {};
      result.sheets.forEach((s, i) => (init[i] = s.mappings));
      setMappingsBySheet(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setBusy(null);
    }
  };

  const currentSheet: SheetDetection | null = detection?.sheets[sheetIdx] ?? null;
  const currentMappings = currentSheet ? mappingsBySheet[sheetIdx] ?? currentSheet.mappings : [];

  const mappedFields = new Set(currentMappings.filter((m) => m.field).map((m) => m.field));
  const hasIdentityField =
    mappedFields.has("firstName") || mappedFields.has("lastName") || mappedFields.has("fullName") || mappedFields.has("finCode");

  const confirm = async () => {
    if (!file || !currentSheet) return;
    setBusy("build");
    setError(null);
    try {
      const records = await buildRecordsRequest(file, {
        sheet: { ...currentSheet, mappings: currentMappings },
        idPrefix,
      });
      if (records.length === 0) {
        setError("Heç bir məlumat sətri tapılmadı.");
        return;
      }
      onComplete(records, file.name);
      setDone({ count: records.length, file: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setBusy(null);
    }
  };

  if (done) {
    return (
      <Card className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <div>
            <div className="font-medium text-slate-800">{done.file}</div>
            <div className="text-sm text-slate-500">{done.count} qeyd əlavə edildi.</div>
          </div>
        </div>
        <Button variant="secondary" onClick={reset}>
          Başqa fayl yüklə
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!detection && (
        <Dropzone
          accept=".xlsx,.xls,.csv"
          onFiles={handleFile}
          hint="XLSX, XLS və ya CSV • başlıqlar avtomatik aşkarlanır (AI köməyi ilə)"
        />
      )}

      {busy === "detect" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Fayl oxunur və sütunlar aşkarlanır...
        </div>
      )}

      {detection && currentSheet && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-brand-500" />
              {file?.name}
            </div>
            {detection.sheets.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Vərəq:
                <select
                  value={sheetIdx}
                  onChange={(e) => setSheetIdx(Number(e.target.value))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                >
                  {detection.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.sheetName} ({s.totalRows} sətir)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Başlıq sətri: <strong>{currentSheet.headerRowIndex + 1}</strong> • Məlumat sətirləri:{" "}
            <strong>{currentSheet.totalRows}</strong>
          </div>

          <ColumnMappingTable
            sheet={{ ...currentSheet, mappings: currentMappings }}
            onChange={(m) => setMappingsBySheet((prev) => ({ ...prev, [sheetIdx]: m }))}
          />

          {requireNameOrFin && !hasIdentityField && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Ən azı bir identifikasiya sahəsi (Ad, Soyad, Tam ad və ya FİN) uyğunlaşdırılmalıdır.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={reset}>
              Ləğv et
            </Button>
            <Button
              onClick={confirm}
              disabled={busy === "build" || (requireNameOrFin && !hasIdentityField)}
            >
              {busy === "build" ? <Spinner /> : null}
              Təsdiqlə və əlavə et
            </Button>
          </div>
        </Card>
      )}

      {error && !detection && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}
