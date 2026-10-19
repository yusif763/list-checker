// Word (.docx) sənədindən xam mətn çıxarışı (mammoth).
// Köhnə .doc formatı dəstəklənmir (ayrıca çevrilmə tələb edir).

export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(data);
  const result = await mammoth.extractRawText({ buffer });
  return (result.value ?? "").replace(/\r/g, "").trim();
}
