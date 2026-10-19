import { z } from "zod";
import type { CanonicalField } from "@/lib/types";
import { getAIProvider } from "./index";

const FIELDS: CanonicalField[] = [
  "firstName",
  "lastName",
  "patronymic",
  "fullName",
  "finCode",
  "dateOfBirth",
  "phone",
  "email",
  "gender",
  "documentNumber",
  "position",
  "subject",
  "region",
  "workplace",
];

const MappingItemSchema = z.object({
  index: z.number().int().min(0),
  field: z
    .string()
    .nullable()
    .transform((v) => (v && FIELDS.includes(v as CanonicalField) ? (v as CanonicalField) : null)),
  confidence: z.number().min(0).max(1).default(0.8),
});

const ResultSchema = z.object({ mappings: z.array(MappingItemSchema) });

export interface AiColumnGuess {
  index: number;
  field: CanonicalField | null;
  confidence: number;
}

const SYSTEM_PROMPT = `Sən Excel cədvəl başlıqlarını kanonik sahələrə uyğunlaşdıran köməkçisən.
Hər sütunu YALNIZ bu kanonik sahələrdən birinə uyğunlaşdır (və ya aid deyilsə null):
- firstName (Ad)
- lastName (Soyad)
- patronymic (Ata adı)
- fullName (birləşmiş Soyad Ad Ata-adı, məs. "Soyadı, adı, atasının adı")
- finCode (FİN kodu)
- dateOfBirth (Doğum tarixi)
- phone (Telefon)
- email (E-poçt)
- gender (Cins)
- documentNumber (Sənəd nömrəsi)
- position (Vəzifə, məs. Müəllim)
- subject (Tədris etdiyi fənn, məs. İngilis dili)
- region (Rayon / şəhər)
- workplace (İşlədiyi müəssisə / məktəb)

Qaydalar:
- Başlıq adı ilə yanaşı nümunə dəyərlərə də bax (məs. ABC1234 → finCode, 15.08.1990 → dateOfBirth).
- Hər kanonik sahə ƏN ÇOX bir sütuna verilə bilər (ən uyğun olana).
- Əmin olmadıqda field=null qoy. Heç nə uydurma.
- Yalnız bu JSON formatında cavab ver:
{ "mappings": [ { "index": number, "field": string|null, "confidence": number(0..1) } ] }`;

/**
 * Başlıqları (və nümunə sətirləri) AI ilə kanonik sahələrə uyğunlaşdırır.
 * AI deaktiv və ya xəta olduqda boş massiv qaytarır (çağıran qayda nəticəsini saxlayır).
 */
export async function aiMapColumns(
  headers: string[],
  sampleRows: string[][],
): Promise<AiColumnGuess[]> {
  const provider = getAIProvider();
  if (!provider.isEnabled()) return [];

  const headerLines = headers
    .map((h, i) => {
      const samples = sampleRows
        .map((r) => r[i])
        .filter((v) => v && v !== "")
        .slice(0, 3);
      return `index ${i}: başlıq="${h}" nümunələr=[${samples.join(", ")}]`;
    })
    .join("\n");

  try {
    const raw = await provider.chatJson(
      SYSTEM_PROMPT,
      `Sütunlar (JSON cavabı ver):\n${headerLines}`,
    );
    const parsed = ResultSchema.parse(raw);

    // Hər sahəni yalnız ən inamlı sütunda saxla.
    const bestByField = new Map<CanonicalField, number>();
    for (const m of parsed.mappings) {
      if (!m.field) continue;
      const prev = bestByField.get(m.field);
      const prevConf = prev === undefined ? -1 : parsed.mappings.find((x) => x.index === prev)?.confidence ?? -1;
      if (m.confidence > prevConf) bestByField.set(m.field, m.index);
    }

    return parsed.mappings.map((m) => ({
      index: m.index,
      field: m.field && bestByField.get(m.field) === m.index ? m.field : null,
      confidence: m.confidence,
    }));
  } catch {
    return [];
  }
}
