// Mərkəzi domen tipləri. Yekun Siyahı (Final List) əsas mənbədir — bütün
// hesabatlar və müqayisələr Yekun Siyahının şəxsləri ətrafında qurulur.

/** Sistemin tanıdığı kanonik sahələr (sütun adları fərqli ola bilər). */
export type CanonicalField =
  | "firstName"
  | "lastName"
  | "patronymic"
  | "fullName"
  | "finCode"
  | "dateOfBirth"
  | "phone"
  | "email"
  | "gender"
  | "documentNumber";

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  firstName: "Ad",
  lastName: "Soyad",
  patronymic: "Ata adı",
  fullName: "Tam ad (S.A.A.)",
  finCode: "FİN",
  dateOfBirth: "Doğum tarixi",
  phone: "Telefon",
  email: "E-poçt",
  gender: "Cins",
  documentNumber: "Sənəd nömrəsi",
};

export type Gender = "MALE" | "FEMALE" | "UNKNOWN";

/** Bir Excel sütununun aşkarlanmış uyğunlaşdırması. */
export interface ColumnMapping {
  /** Orijinal başlıq mətni. */
  header: string;
  /** Sütunun indeksi (0-dan). */
  index: number;
  /** Uyğunlaşdırıldığı kanonik sahə (və ya null = nəzərə alınmır). */
  field: CanonicalField | null;
  /** 0..1 — aşkarlama inamı. */
  confidence: number;
  /** Qayda əsaslı, yoxsa AI? */
  source: "rule" | "ai" | "manual" | "none";
}

/** Excel strukturunun aşkarlanma nəticəsi (bir vərəq üçün). */
export interface SheetDetection {
  sheetName: string;
  /** Başlıq sətrinin indeksi (0-dan). */
  headerRowIndex: number;
  headers: string[];
  mappings: ColumnMapping[];
  /** Nümunə məlumat sətirləri (önizləmə üçün). */
  sampleRows: string[][];
  totalRows: number;
}

export interface ParsedSheetResult {
  fileName: string;
  sheets: SheetDetection[];
}

/** Bir şəxsin xam + normallaşdırılmış məlumatı (mənbədən asılı olmayaraq). */
export interface PersonRecord {
  id: string;
  sourceFile: string;
  sheetName: string;
  /** Orijinal Excel sətir nömrəsi (1-dən, başlıq daxil). */
  rowNumber: number;
  /** Kanonik sahə -> orijinal dəyər. */
  raw: Partial<Record<CanonicalField, string>>;
  /** Kanonik sahə -> normallaşdırılmış dəyər. */
  normalized: Partial<Record<CanonicalField, string>>;
}

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  field: CanonicalField;
  /** Maşın üçün kod, məs. "fin.invalid-length". */
  code: string;
  /** Azərbaycan dilində izah. */
  message: string;
  severity: IssueSeverity;
  originalValue: string | null;
  /** Təhlükəsiz avtomatik düzəliş təklifi (varsa). */
  suggestion: string | null;
}

export type MatchStatus =
  | "found" // dəqiq uyğunluq
  | "found_mismatch" // tapıldı, amma sahə uyğunsuzluğu var
  | "possible" // ehtimal — manual yoxlama
  | "not_found" // tapılmadı
  | "multiple"; // çoxlu namizəd

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  found: "Tapıldı",
  found_mismatch: "Tapıldı — uyğunsuzluq",
  possible: "Ehtimal — yoxlama lazımdır",
  not_found: "Tapılmadı",
  multiple: "Çoxlu namizəd",
};

export interface FieldComparison {
  field: CanonicalField;
  finalValue: string | null;
  referenceValue: string | null;
  status: "match" | "mismatch" | "missing";
}

export interface MatchResult {
  status: MatchStatus;
  /** 0..1 ümumi oxşarlıq balı. */
  score: number;
  /** Uyğunlaşdırmanın hansı prioritetlə tapıldığı. */
  method: "fin" | "full_identity" | "partial" | "fuzzy" | "none";
  /** Uyğun gələn istinad qeydinin id-si (varsa). */
  matchedRecordId: string | null;
  comparisons: FieldComparison[];
  /** Çoxlu namizəd olduqda onların id-ləri. */
  candidateIds: string[];
  explanation: string;
}

/** Şəxsiyyət vəsiqəsindən çıxarılan məlumat (AI/OCR). */
export interface ExtractedIdentity {
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  dateOfBirth: string | null;
  finCode: string | null;
  gender: Gender | null;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string | null;
  confidence: number;
  requiresManualReview: boolean;
  /** Mənbə izləmə üçün. */
  sourceFile: string;
  pageNumber: number | null;
  /** Çıxarışın necə alındığı. */
  method: "ai" | "text" | "manual";
  /** Model adı / versiya (audit üçün). */
  model: string | null;
  /** Xam mətn (debug / yoxlama üçün). */
  rawText?: string;
}

export type DuplicateType =
  | "same_fin_same_person"
  | "same_fin_diff_name"
  | "same_name_diff_fin"
  | "possible_duplicate";

export const DUPLICATE_TYPE_LABELS: Record<DuplicateType, string> = {
  same_fin_same_person: "Eyni FİN, eyni şəxs",
  same_fin_diff_name: "Eyni FİN, fərqli ad",
  same_name_diff_fin: "Eyni ad, fərqli FİN",
  possible_duplicate: "Ehtimal olunan təkrar",
};

export interface DuplicateGroup {
  type: DuplicateType;
  recordIds: string[];
  key: string;
  recommendation: string;
}

/** Yekun Siyahının bir şəxsi üçün tam yoxlama nəticəsi — hesabatın əsas vahidi. */
export interface VerificationRow {
  record: PersonRecord;
  validationIssues: ValidationIssue[];
  mainListMatch: MatchResult | null;
  identityMatch: {
    identity: ExtractedIdentity;
    comparisons: FieldComparison[];
    hasMismatch: boolean;
  } | null;
  duplicateOf: string[];
  /** Ümumi problem sayı (error + warning). */
  issueCount: number;
}
