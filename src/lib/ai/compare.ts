import { z } from "zod";
import { getAIProvider } from "./index";

export interface ComparePair {
  field: string;
  label: string;
  finalValue: string;
  referenceValue: string;
}

const ResultSchema = z.object({
  results: z.array(
    z.object({
      field: z.string(),
      status: z.enum(["match", "mismatch", "uncertain"]),
      note: z.string().nullable().optional(),
    }),
  ),
});

export interface AiCompareResult {
  field: string;
  status: "match" | "mismatch" | "uncertain";
  note: string | null;
}

const SYSTEM_PROMPT = `Sən eyni şəxsin iki fərqli mənbədən məlumatını müqayisə edən dəqiq analitiksən.
Hər sahə üçün dəyərlərin EYNİ məlumatı bildirib-bildirmədiyini qiymətləndir.

VACİB qaydalar:
- Fərqli yazılış, qısaltma, format, böyük/kiçik hərf, əlavə boşluq EYNİ sayılır (status=match).
  Məsələn məktəb adlarında: "k-d"="kənd", "t.o.ü.m."="tam orta ümumtəhsil məktəbi",
  "ü.o.ü.m."="ümumi orta ümumtəhsil məktəbi", "ş."="şəhər". Mötərizədəki rayon təkrarı fərq deyil.
- Latın/kiril hərf fərqi, "oğlu/qızı"-nın olub-olmaması EYNİ sayılır.
- Tarixin formatı (15.08.1990 vs 1990-08-15 vs 15/08/1990) fərq DEYİL; yalnız gün/ay/il fərqlidirsə mismatch.
- Təşkilat adında bir mənbədə regional idarə, digərində məktəb göstərilə bilər — əgər biri digərinin
  tərkibidirsə və ya əlaqəlidirsə, qeyd et, amma açıq ziddiyyət yoxdursa mismatch sayma.
- HƏQİQƏTƏN fərqli məlumat (başqa ad, başqa doğum tarixi, başqa FİN, başqa məktəb) = mismatch.
- Əmin deyilsənsə status=uncertain.

Hər sahə üçün qısa Azərbaycanca note yaz (nə üçün match/mismatch).
Yalnız bu JSON: { "results": [ { "field": string, "status": "match"|"mismatch"|"uncertain", "note": string } ] }`;

/**
 * İki qeydin sahələrini AI ilə ağıllı müqayisə edir (format/qısaltma fərqlərini
 * nəzərə alaraq). AI deaktiv/xəta olduqda boş massiv qaytarır.
 */
export async function aiCompareRecords(pairs: ComparePair[]): Promise<AiCompareResult[]> {
  const provider = getAIProvider();
  if (!provider.isEnabled() || pairs.length === 0) return [];

  const lines = pairs
    .map((p) => `- field="${p.field}" (${p.label}): A="${p.finalValue}" | B="${p.referenceValue}"`)
    .join("\n");

  try {
    const raw = await provider.chatJson(
      SYSTEM_PROMPT,
      `A = Yekun siyahı, B = Əsas siyahı. Hər sahəni müqayisə et (JSON cavab ver):\n${lines}`,
    );
    const parsed = ResultSchema.parse(raw);
    return parsed.results.map((r) => ({ field: r.field, status: r.status, note: r.note ?? null }));
  } catch {
    return [];
  }
}
