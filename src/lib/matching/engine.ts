import type {
  CanonicalField,
  FieldComparison,
  MatchResult,
  MatchStatus,
  PersonRecord,
} from "@/lib/types";
import { normalizeForCompare, nameSimilarity } from "./string-similarity";

const COMPARE_FIELDS: CanonicalField[] = [
  "lastName",
  "firstName",
  "patronymic",
  "dateOfBirth",
  "finCode",
  "gender",
  "documentNumber",
];

const NAME_FUZZY_THRESHOLD = 0.9;

function val(record: PersonRecord, field: CanonicalField): string | null {
  return record.normalized[field] ?? record.raw[field] ?? null;
}

/** İki qeydin ortaq sahələrini müqayisə edir. */
export function compareFields(a: PersonRecord, b: PersonRecord): FieldComparison[] {
  const result: FieldComparison[] = [];
  for (const field of COMPARE_FIELDS) {
    const av = val(a, field);
    const bv = val(b, field);
    if (av === null && bv === null) continue;
    let status: FieldComparison["status"];
    if (av === null || bv === null) {
      status = "missing";
    } else {
      const fuzzy = field === "firstName" || field === "lastName" || field === "patronymic";
      const equal = fuzzy
        ? nameSimilarity(av, bv) >= 0.97
        : normalizeForCompare(av) === normalizeForCompare(bv);
      status = equal ? "match" : "mismatch";
    }
    result.push({ field, finalValue: av, referenceValue: bv, status });
  }
  return result;
}

interface CandidateEval {
  record: PersonRecord;
  score: number;
  method: MatchResult["method"];
  comparisons: FieldComparison[];
  finExact: boolean;
  identityExact: boolean;
}

function evaluateCandidate(final: PersonRecord, candidate: PersonRecord): CandidateEval {
  const comparisons = compareFields(final, candidate);
  const finFinal = val(final, "finCode");
  const finCand = val(candidate, "finCode");
  const finExact =
    !!finFinal && !!finCand && normalizeForCompare(finFinal) === normalizeForCompare(finCand);

  const last = val(final, "lastName");
  const first = val(final, "firstName");
  const patr = val(final, "patronymic");
  const dob = val(final, "dateOfBirth");

  const lastSim = last && val(candidate, "lastName") ? nameSimilarity(last, val(candidate, "lastName")!) : 0;
  const firstSim = first && val(candidate, "firstName") ? nameSimilarity(first, val(candidate, "firstName")!) : 0;
  const patrSim = patr && val(candidate, "patronymic") ? nameSimilarity(patr, val(candidate, "patronymic")!) : null;
  const dobMatch = dob && val(candidate, "dateOfBirth") ? normalizeForCompare(dob) === normalizeForCompare(val(candidate, "dateOfBirth")!) : null;

  const identityExact =
    lastSim >= 0.97 &&
    firstSim >= 0.97 &&
    (patrSim === null || patrSim >= 0.97) &&
    dobMatch !== false &&
    (dobMatch === true || patrSim !== null); // ad+soyad tək başına kifayət deyil

  // Fuzzy bal: ad komponentlərinin ortalaması, varlıq nəzərə alınmaqla.
  const sims = [lastSim, firstSim, ...(patrSim !== null ? [patrSim] : [])];
  const nameScore = sims.length ? sims.reduce((s, v) => s + v, 0) / sims.length : 0;
  let score = nameScore;
  if (finExact) score = Math.max(score, 0.99);
  if (dobMatch === true) score = Math.min(1, score + 0.05);
  if (dobMatch === false) score = Math.max(0, score - 0.2);

  const method: MatchResult["method"] = finExact
    ? "fin"
    : identityExact
      ? "full_identity"
      : nameScore >= NAME_FUZZY_THRESHOLD
        ? "fuzzy"
        : nameScore > 0
          ? "partial"
          : "none";

  return { record: candidate, score, method, comparisons, finExact, identityExact };
}

function hasMismatch(comparisons: FieldComparison[]): boolean {
  return comparisons.some((c) => c.status === "mismatch");
}

/**
 * Yekun Siyahının bir qeydini istinad dəstində axtarır.
 * Prioritet: FİN-dəqiq -> tam kimlik -> qismən -> fuzzy.
 * İstiqamət HƏMİŞƏ Yekun -> İstinad.
 */
export function matchRecord(final: PersonRecord, references: PersonRecord[]): MatchResult {
  if (references.length === 0) {
    return {
      status: "not_found",
      score: 0,
      method: "none",
      matchedRecordId: null,
      comparisons: [],
      candidateIds: [],
      explanation: "İstinad siyahısı boşdur.",
    };
  }

  const evals = references.map((r) => evaluateCandidate(final, r));

  // 1) FİN-dəqiq uyğunluqlar.
  const finMatches = evals.filter((e) => e.finExact);
  if (finMatches.length > 1) {
    return multiple(finMatches, "Eyni FİN ilə birdən çox qeyd tapıldı.");
  }
  if (finMatches.length === 1) {
    const e = finMatches[0];
    const mismatch = hasMismatch(e.comparisons);
    return {
      status: mismatch ? "found_mismatch" : "found",
      score: e.score,
      method: "fin",
      matchedRecordId: e.record.id,
      comparisons: e.comparisons,
      candidateIds: [e.record.id],
      explanation: mismatch
        ? "FİN uyğun gəldi, lakin digər sahələrdə uyğunsuzluq var — kritik fərq."
        : "FİN və sahələr tam uyğun gəldi.",
    };
  }

  // 2) Tam kimlik uyğunluğu.
  const identityMatches = evals.filter((e) => e.identityExact);
  if (identityMatches.length === 1) {
    const e = identityMatches[0];
    return {
      status: hasMismatch(e.comparisons) ? "found_mismatch" : "found",
      score: e.score,
      method: "full_identity",
      matchedRecordId: e.record.id,
      comparisons: e.comparisons,
      candidateIds: [e.record.id],
      explanation: "Soyad, ad, ata adı və doğum tarixi uyğun gəldi.",
    };
  }
  if (identityMatches.length > 1) {
    return multiple(identityMatches, "Eyni kimlik məlumatı ilə birdən çox qeyd tapıldı.");
  }

  // 3/4) Fuzzy namizədlər.
  const fuzzy = evals
    .filter((e) => e.score >= NAME_FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (fuzzy.length > 1 && fuzzy[0].score - fuzzy[1].score < 0.03) {
    return multiple(fuzzy, "Oxşar adlı birdən çox namizəd tapıldı.");
  }
  if (fuzzy.length >= 1) {
    const e = fuzzy[0];
    return {
      status: "possible",
      score: e.score,
      method: e.method,
      matchedRecordId: e.record.id,
      comparisons: e.comparisons,
      candidateIds: fuzzy.slice(0, 3).map((x) => x.record.id),
      explanation: `Oxşarlıq balı ${(e.score * 100).toFixed(0)}%. Bu yalnız ehtimaldır — manual yoxlama lazımdır.`,
    };
  }

  return {
    status: "not_found",
    score: evals.reduce((m, e) => Math.max(m, e.score), 0),
    method: "none",
    matchedRecordId: null,
    comparisons: [],
    candidateIds: [],
    explanation: "Uyğun qeyd tapılmadı.",
  };
}

function multiple(evals: CandidateEval[], explanation: string): MatchResult {
  const sorted = [...evals].sort((a, b) => b.score - a.score);
  return {
    status: "multiple",
    score: sorted[0].score,
    method: sorted[0].method,
    matchedRecordId: null,
    comparisons: sorted[0].comparisons,
    candidateIds: sorted.map((e) => e.record.id),
    explanation,
  };
}
