import { z } from "zod";
import type { CanonicalField } from "@/lib/types";
import { getAIProvider } from "./index";

const FIELDS: CanonicalField[] = [
  "firstName", "lastName", "patronymic", "fullName", "finCode", "dateOfBirth",
  "phone", "email", "gender", "documentNumber", "position", "subject", "region", "workplace",
];

const Schema = z.object({
  headerRowIndex: z.number().int(),
  mappings: z.array(
    z.object({
      index: z.number().int().min(0),
      field: z
        .string()
        .nullable()
        .transform((v) => (v && FIELDS.includes(v as CanonicalField) ? (v as CanonicalField) : null)),
    }),
  ),
});

export interface AiStructure {
  /** Başlıq sətrinin indeksi; -1 = başlıq yoxdur (data 0-cı sətirdən). */
  headerRowIndex: number;
  mappings: Array<{ index: number; field: CanonicalField | null }>;
}

const SYSTEM_PROMPT = `Sən Excel cədvəlinin strukturunu təhlil edən köməkçisən.
Sənə cədvəlin ilk sətirləri verilir (hər sətir massiv kimi). Təyin et:
1) Başlıq sətrinin indeksi (0-dan). Əgər cədvəldə ÜMUMİYYƏTLƏ başlıq yoxdursa (birbaşa data ilə başlayır) headerRowIndex = -1 qoy.
2) Hər məlumat sütununu kanonik sahəyə uyğunlaşdır (dəyərlərin özünə bax).

Kanonik sahələr: firstName(Ad), lastName(Soyad), patronymic(Ata adı),
fullName(birləşmiş Soyad Ad Ata-adı), finCode(7 simvollu FİN, məs ABC1234 və ya 2TPULW0),
dateOfBirth(doğum tarixi), phone(telefon), email, gender(Cins), documentNumber,
position(Vəzifə), subject(fənn), region(rayon/şəhər), workplace(müəssisə/məktəb).

Qaydalar:
- Başlıqlar birdən çox sətir ola bilər və ya başlıqdan əvvəl başlıq/mətn sətirləri ola bilər — ƏSL başlıq sətrini seç.
- Başlıq yoxdursa sütunları dəyərlərin nümunələrinə görə təyin et (məs. "Məlikova Aytən Afik qızı" → fullName, "4n7agez" → finCode, "18/10/1989" → dateOfBirth, "Qadın" → gender).
- 7 rəqəmli hərfli kod → finCode. Uzun məktəb adı → workplace.
- Aid olmayan sütunlar üçün field=null.
- Yalnız bu JSON: { "headerRowIndex": number, "mappings": [ { "index": number, "field": string|null } ] }`;

/**
 * İlk sətirləri AI ilə təhlil edib struktur (başlıq sətri + sütunlar) qaytarır.
 * AI deaktiv/xəta olduqda null qaytarır.
 */
export async function aiDetectStructure(rows: string[][]): Promise<AiStructure | null> {
  const provider = getAIProvider();
  if (!provider.isEnabled()) return null;

  const sample = rows.slice(0, 10).map((r, i) => `sətir ${i}: ${JSON.stringify(r.slice(0, 20))}`).join("\n");

  try {
    const raw = await provider.chatJson(SYSTEM_PROMPT, `Cədvəlin ilk sətirləri (JSON cavabı ver):\n${sample}`);
    return Schema.parse(raw);
  } catch {
    return null;
  }
}
