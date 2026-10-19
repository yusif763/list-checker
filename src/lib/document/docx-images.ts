import JSZip from "jszip";

export interface EmbeddedImage {
  name: string;
  mime: string;
  /** data:image/...;base64,... formatında URL. */
  dataUrl: string;
  bytes: number;
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Word (.docx) sənədinin içindəki şəkilləri (word/media/*) çıxarır.
 * Şəxsiyyət vəsiqələri çox vaxt Word daxilində şəkil kimi olur.
 */
export async function extractDocxImages(data: ArrayBuffer): Promise<EmbeddedImage[]> {
  const zip = await JSZip.loadAsync(data);
  const images: EmbeddedImage[] = [];

  const entries = Object.keys(zip.files)
    .filter((p) => /^word\/media\/.+\.(jpe?g|png|webp|gif)$/i.test(p))
    // image1, image2, ... ardıcıllığını qoru (nömrəyə görə sırala).
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)\.\w+$/)?.[1] ?? 0);
      const nb = Number(b.match(/(\d+)\.\w+$/)?.[1] ?? 0);
      return na - nb;
    });

  for (const path of entries) {
    const file = zip.files[path];
    if (!file) continue;
    const buf = await file.async("nodebuffer");
    if (buf.length < 2000) continue; // çox kiçik — loqo/ikon ola bilər
    const ext = (path.split(".").pop() || "jpeg").toLowerCase();
    const mime = EXT_MIME[ext] || "image/jpeg";
    images.push({
      name: path.split("/").pop() || path,
      mime,
      dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
      bytes: buf.length,
    });
  }

  return images;
}
