import type { CanonicalField, ColumnMapping } from "@/lib/types";
import type { AiColumnGuess } from "@/lib/ai/column-mapping";

/** Başlıq mətnini müqayisə üçün sadələşdirir. */
function normalizeHeader(header: string): string {
  return header
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/[ıİi]/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Kanonik sahə -> normallaşdırılmış açar sözlər (tam uyğunluq üçün).
const EXACT: Record<CanonicalField, string[]> = {
  firstName: ["ad", "adi", "name", "first name", "firstname", "given name"],
  lastName: ["soyad", "soyadi", "surname", "last name", "lastname", "family name"],
  patronymic: ["ata adi", "atasinin adi", "patronymic", "father name", "ata ad"],
  fullName: [
    "soyadi adi atasinin adi",
    "saa",
    "s a a",
    "tam ad",
    "full name",
    "fullname",
    "fio",
    "ad soyad",
    "soyad ad ata adi",
  ],
  finCode: ["fin", "fin kod", "fin kodu", "fin code", "sv fin", "pin"],
  dateOfBirth: ["dogum tarixi", "dob", "birth date", "birthdate", "date of birth", "tevellud"],
  phone: ["telefon", "mobil nomre", "phone", "mobile", "nomre", "telefon nomresi", "elaqe nomresi"],
  email: ["e poct", "email", "e mail", "epoct", "elektron poct"],
  gender: ["cins", "gender", "sex", "cinsi"],
  documentNumber: ["sened nomresi", "document number", "vesiqe nomresi", "seriya nomre"],
  position: ["vezife", "vezifesi", "position", "v32zif"],
  subject: ["fenn", "tedris etdiyi fenn", "subject", "ixtisas"],
  region: ["rayon", "sehir", "rayon sehir", "region", "sehir rayon"],
  workplace: ["isledigi muessise", "muessise", "is yeri", "mekteb", "workplace", "teskilat"],
};

// Qismən uyğunluq üçün açar söz hissələri (daha aşağı inamla).
const CONTAINS: Array<{ field: CanonicalField; token: string; confidence: number }> = [
  { field: "fullName", token: "soyadi adi atasinin", confidence: 0.95 },
  { field: "finCode", token: "fin", confidence: 0.9 },
  { field: "patronymic", token: "ata ad", confidence: 0.85 },
  { field: "dateOfBirth", token: "dogum", confidence: 0.85 },
  { field: "dateOfBirth", token: "tevellud", confidence: 0.85 },
  { field: "phone", token: "telefon", confidence: 0.85 },
  { field: "phone", token: "mobil", confidence: 0.8 },
  { field: "email", token: "poct", confidence: 0.8 },
  { field: "email", token: "mail", confidence: 0.8 },
  { field: "gender", token: "cins", confidence: 0.9 },
  { field: "lastName", token: "soyad", confidence: 0.8 },
  { field: "position", token: "vezif", confidence: 0.8 },
  { field: "subject", token: "fenn", confidence: 0.8 },
  { field: "subject", token: "tedris", confidence: 0.75 },
  { field: "region", token: "rayon", confidence: 0.8 },
  { field: "workplace", token: "muessise", confidence: 0.8 },
  { field: "workplace", token: "mekteb", confidence: 0.6 },
  { field: "firstName", token: "ad", confidence: 0.5 },
];

export interface FieldGuess {
  field: CanonicalField | null;
  confidence: number;
  source: "rule" | "none";
}

/** Bir başlıq üçün ən yaxşı kanonik sahə təxminini qaytarır. */
export function detectField(header: string): FieldGuess {
  const norm = normalizeHeader(header);
  if (!norm) return { field: null, confidence: 0, source: "none" };

  // 1) Tam uyğunluq.
  for (const field of Object.keys(EXACT) as CanonicalField[]) {
    if (EXACT[field].includes(norm)) {
      return { field, confidence: 0.99, source: "rule" };
    }
  }

  // 2) Qismən (contains) uyğunluq — ən yüksək inamlı.
  let best: FieldGuess = { field: null, confidence: 0, source: "none" };
  for (const rule of CONTAINS) {
    if (norm.includes(rule.token) && rule.confidence > best.confidence) {
      best = { field: rule.field, confidence: rule.confidence, source: "rule" };
    }
  }
  return best;
}

/**
 * Bütün başlıqlar üçün sahələri təyin edir, hər kanonik sahənin yalnız
 * ən inamlı sütuna verilməsini təmin edir (fullName istisna olmaqla).
 */
export function detectFields(headers: string[]): FieldGuess[] {
  const guesses = headers.map(detectField);

  // Eyni sahəyə bir neçə sütun düşərsə, yalnız ən inamlını saxla.
  const bestByField = new Map<CanonicalField, number>();
  guesses.forEach((g, i) => {
    if (!g.field) return;
    const prev = bestByField.get(g.field);
    if (prev === undefined || guesses[i].confidence > guesses[prev].confidence) {
      bestByField.set(g.field, i);
    }
  });

  return guesses.map((g, i) => {
    if (!g.field) return g;
    if (bestByField.get(g.field) !== i) {
      return { field: null, confidence: 0, source: "none" as const };
    }
    return g;
  });
}

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Yekun/müqayisə üçün ən azı bir identifikasiya sahəsi lazımdır. */
const IDENTITY_FIELDS: CanonicalField[] = ["firstName", "lastName", "fullName", "finCode"];

export function hasIdentityField(mappings: { field: CanonicalField | null }[]): boolean {
  return mappings.some((m) => m.field && IDENTITY_FIELDS.includes(m.field));
}

/**
 * AI təxminlərini qayda əsaslı uyğunlaşdırma ilə birləşdirir.
 * Güclü qayda nəticələri (conf >= 0.9) saxlanılır; AI yalnız boş qalan
 * sütunlar və hələ təyin olunmayan sahələr üçün istifadə olunur.
 */
export function mergeAiMappings(mappings: ColumnMapping[], aiGuesses: AiColumnGuess[]): ColumnMapping[] {
  const result = mappings.map((m) => ({ ...m }));

  const claimed = new Set<CanonicalField>();
  for (const m of result) {
    if (m.field && m.confidence >= 0.9) claimed.add(m.field);
  }

  for (const guess of aiGuesses) {
    if (!guess.field) continue;
    const target = result.find((m) => m.index === guess.index);
    if (!target) continue;
    // Güclü qayda nəticəsini dəyişmə.
    if (target.field && target.confidence >= 0.9) continue;
    // Bu sahə artıq güclü şəkildə başqa sütuna verilibsə, keç.
    if (claimed.has(guess.field)) continue;

    target.field = guess.field;
    target.confidence = guess.confidence;
    target.source = "ai";
    claimed.add(guess.field);
  }

  return result;
}
