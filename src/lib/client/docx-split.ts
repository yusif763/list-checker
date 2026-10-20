// Brauzer tərəfi: böyük .docx faylını içindəki şəkillərə (ID kartlarına) bölür,
// beləcə hər şəkil ayrıca kiçik fayl kimi yüklənir və serverless ~6MB limiti problem olmur.

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * .docx içindəki şəkilləri ayrı-ayrı File obyektlərinə çevirir.
 * Şəkil yoxdursa və ya docx deyilsə boş massiv qaytarır (çağıran orijinalı yükləyir).
 */
export async function splitDocxToImageFiles(file: File): Promise<File[]> {
  if (!file.name.toLowerCase().endsWith(".docx")) return [];

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const base = file.name.replace(/\.docx$/i, "");

  const entries = Object.keys(zip.files)
    .filter((p) => /^word\/media\/.+\.(jpe?g|png|webp|gif)$/i.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)\.\w+$/)?.[1] ?? 0);
      const nb = Number(b.match(/(\d+)\.\w+$/)?.[1] ?? 0);
      return na - nb;
    });

  const files: File[] = [];
  let i = 0;
  for (const p of entries) {
    const entry = zip.files[p];
    if (!entry) continue;
    const blob = await entry.async("blob");
    if (blob.size < 2000) continue; // çox kiçik — loqo/ikon
    i++;
    let ext = (p.split(".").pop() || "jpeg").toLowerCase();
    if (ext === "jpg") ext = "jpeg";
    const mime = EXT_MIME[ext] || "image/jpeg";
    files.push(new File([blob], `${base} (${i}).${ext}`, { type: mime }));
  }

  return files;
}
