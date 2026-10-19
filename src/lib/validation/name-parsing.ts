// Birləşmiş tam ad sütununu (S.A.A.) hissələrə ayırır.
// Qayda əsaslı; qeyri-müəyyən hallar manual yoxlama üçün işarələnir.
// Sözləri kor-koranə mövqeyə görə bölmür.

export interface ParsedName {
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  requiresReview: boolean;
  note: string | null;
}

const SUFFIX_WORDS = new Set(["oğlu", "oglu", "qızı", "qizi"]);

/** Bir tokenin patronim suffiksi olub-olmadığını yoxlayır (ASCII \b-dən asılı olmadan). */
function isSuffixWord(token: string): boolean {
  return SUFFIX_WORDS.has(token.toLocaleLowerCase("az"));
}

/**
 * "Məmmədov Əli Hüseyn oğlu" -> { lastName: Məmmədov, firstName: Əli, patronymic: Hüseyn oğlu }
 * Gözlənilən sıra: Soyad Ad Ata-adı.
 */
export function parseFullName(raw: string | null | undefined): ParsedName {
  const empty: ParsedName = {
    firstName: null,
    lastName: null,
    patronymic: null,
    requiresReview: true,
    note: "Tam ad boşdur.",
  };
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return empty;

  const tokens = trimmed.split(" ");
  const suffixIndex = tokens.findIndex(isSuffixWord);

  if (suffixIndex !== -1) {
    // Patronim: oğlu/qızı sözü və ondan əvvəlki söz.
    if (suffixIndex >= 1) {
      const patronymic = `${tokens[suffixIndex - 1]} ${tokens[suffixIndex]}`;
      const before = tokens.slice(0, suffixIndex - 1);
      if (before.length === 2) {
        return {
          lastName: before[0],
          firstName: before[1],
          patronymic,
          requiresReview: false,
          note: null,
        };
      }
      if (before.length === 1) {
        return {
          lastName: before[0],
          firstName: null,
          patronymic,
          requiresReview: true,
          note: "Ad hissəsi tapılmadı — yoxlama lazımdır.",
        };
      }
      // Çox söz — qeyri-müəyyən.
      return {
        lastName: before[0] ?? null,
        firstName: before.slice(1).join(" ") || null,
        patronymic,
        requiresReview: true,
        note: "Ad hissələri qeyri-müəyyəndir — yoxlama lazımdır.",
      };
    }
  }

  // Suffiks yoxdur: 3 söz -> Soyad Ad Ata-adı (ehtiyatlı).
  if (tokens.length === 3) {
    return {
      lastName: tokens[0],
      firstName: tokens[1],
      patronymic: tokens[2],
      requiresReview: true,
      note: "Patronim suffiksi (oğlu/qızı) yoxdur — sıra təxmin edildi, yoxlama tövsiyə olunur.",
    };
  }

  if (tokens.length === 2) {
    return {
      lastName: tokens[0],
      firstName: tokens[1],
      patronymic: null,
      requiresReview: true,
      note: "Yalnız iki söz — soyad/ad sırası təxmin edildi.",
    };
  }

  return {
    firstName: null,
    lastName: null,
    patronymic: null,
    requiresReview: true,
    note: `Ad strukturu tanınmır: "${trimmed}".`,
  };
}
