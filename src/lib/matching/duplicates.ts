import type { CanonicalField, DuplicateGroup, DuplicateType, PersonRecord } from "@/lib/types";
import { normalizeForCompare, nameSimilarity } from "./string-similarity";

function val(record: PersonRecord, field: CanonicalField): string | null {
  return record.normalized[field] ?? record.raw[field] ?? null;
}

function fullNameKey(r: PersonRecord): string {
  return [val(r, "lastName"), val(r, "firstName"), val(r, "patronymic")]
    .map((v) => normalizeForCompare(v))
    .join("|");
}

function namesEqual(a: PersonRecord, b: PersonRecord): boolean {
  return fullNameKey(a) === fullNameKey(b) && fullNameKey(a) !== "||";
}

/**
 * Qeydlər arasında təkrarları aşkarlayır (eyni siyahı daxilində və ya
 * bir neçə Yekun Siyahı arasında). Hər qrup mənbə izlənilə bilən qalır.
 */
export function detectDuplicates(records: PersonRecord[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  // 1) FİN üzrə qruplaşdırma.
  const byFin = new Map<string, PersonRecord[]>();
  for (const r of records) {
    const fin = normalizeForCompare(val(r, "finCode"));
    if (!fin) continue;
    const arr = byFin.get(fin) ?? [];
    arr.push(r);
    byFin.set(fin, arr);
  }

  for (const [fin, arr] of byFin) {
    if (arr.length < 2) continue;
    const allSameName = arr.every((r) => namesEqual(r, arr[0]));
    const type: DuplicateType = allSameName ? "same_fin_same_person" : "same_fin_diff_name";
    groups.push({
      type,
      recordIds: arr.map((r) => r.id),
      key: `fin:${fin}`,
      recommendation: allSameName
        ? "Eyni şəxs ehtimalı yüksəkdir — qeydləri birləşdirin və ya təkrarı silin."
        : "Eyni FİN, fərqli ad — kritik ziddiyyət, mənbələri yoxlayın.",
    });
    arr.forEach((r) => seen.add(r.id));
  }

  // 2) Ad üzrə qruplaşdırma (FİN fərqli olanlar üçün).
  const byName = new Map<string, PersonRecord[]>();
  for (const r of records) {
    const key = fullNameKey(r);
    if (key === "||") continue;
    const arr = byName.get(key) ?? [];
    arr.push(r);
    byName.set(key, arr);
  }

  for (const [key, arr] of byName) {
    if (arr.length < 2) continue;
    const fins = new Set(arr.map((r) => normalizeForCompare(val(r, "finCode"))).filter(Boolean));
    if (fins.size > 1) {
      groups.push({
        type: "same_name_diff_fin",
        recordIds: arr.map((r) => r.id),
        key: `name:${key}`,
        recommendation: "Eyni ad, fərqli FİN — ayrı şəxslər ola bilər, yoxlama lazımdır.",
      });
      arr.forEach((r) => seen.add(r.id));
    }
  }

  // 3) Fuzzy ehtimal olunan təkrarlar (hələ işarələnməyənlər arasında).
  const candidates = records.filter((r) => !seen.has(r.id));
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const lastA = val(a, "lastName");
      const lastB = val(b, "lastName");
      const firstA = val(a, "firstName");
      const firstB = val(b, "firstName");
      if (!lastA || !lastB || !firstA || !firstB) continue;
      const sim = (nameSimilarity(lastA, lastB) + nameSimilarity(firstA, firstB)) / 2;
      const dobA = val(a, "dateOfBirth");
      const dobB = val(b, "dateOfBirth");
      const dobSame = dobA && dobB && normalizeForCompare(dobA) === normalizeForCompare(dobB);
      if (sim >= 0.92 && dobSame) {
        groups.push({
          type: "possible_duplicate",
          recordIds: [a.id, b.id],
          key: `fuzzy:${a.id}:${b.id}`,
          recommendation: "Adlar çox oxşardır və doğum tarixi eynidir — ehtimal olunan təkrar.",
        });
      }
    }
  }

  return groups;
}

/** Qeyd id -> aid olduğu təkrar qruplarının açarları. */
export function duplicateMap(groups: DuplicateGroup[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const g of groups) {
    for (const id of g.recordIds) {
      const arr = map.get(id) ?? [];
      arr.push(g.key);
      map.set(id, arr);
    }
  }
  return map;
}
