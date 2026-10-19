/** Müqayisə üçün Unicode + boşluq normallaşdırması (Azərbaycan hərfləri qorunur). */
export function normalizeForCompare(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("az")
    .replace(/\s+/g, " ")
    .trim();
}

/** Diakritikaları qatlayan daha yumşaq variant (fuzzy üçün). */
export function foldDiacritics(value: string): string {
  return normalizeForCompare(value)
    .replace(/ə/g, "e")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ı/g, "i");
}

/** Levenshtein məsafəsi. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** 0..1 — Levenshtein əsaslı oxşarlıq. */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Jaro oxşarlığı. */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler oxşarlığı (ortaq prefiks bonusu ilə). */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return j + prefix * prefixScale * (1 - j);
}

/** İki adın oxşarlığı (diakritika qatlanmış, Jaro-Winkler). */
export function nameSimilarity(a: string, b: string): number {
  return jaroWinkler(foldDiacritics(a), foldDiacritics(b));
}

/** Patronimdən oğlu/qızı suffiksini çıxarır ("Əlibala oğlu" → "Əlibala"). */
export function stripPatronymicSuffix(value: string | null | undefined): string {
  return normalizeForCompare(value)
    .replace(/\s*(oğlu|oglu|qızı|qizi)\s*$/u, "")
    .trim();
}

/** Patronim oxşarlığı — oğlu/qızı fərqini nəzərə almır. */
export function patronymicSimilarity(a: string, b: string): number {
  return jaroWinkler(foldDiacritics(stripPatronymicSuffix(a)), foldDiacritics(stripPatronymicSuffix(b)));
}
