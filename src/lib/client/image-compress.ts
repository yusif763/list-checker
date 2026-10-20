// Brauzer tərəfi: böyük şəkilləri (ID skanları) yükləmədən əvvəl kiçildir/sıxır.
// Serverless limitinə (~6MB) dəyməsin və vision OCR daha sürətli/ucuz olsun.
// OCR üçün 2200px kifayətdir.

export interface CompressOptions {
  maxBytes?: number;
  maxDim?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxBytes: 4 * 1024 * 1024, // ~4MB — limitin altında, təhlükəsiz
  maxDim: 2200,
};

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

/**
 * Şəkil faylını (lazım gələrsə) kiçildir. Şəkil deyilsə və ya kiçikdirsə
 * olduğu kimi qaytarır. JPEG kimi sıxır.
 */
export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxBytes, maxDim } = { ...DEFAULTS, ...options };

  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  // Kiçik və ölçüsü normaldırsa toxunma.
  if (file.size <= 1.8 * 1024 * 1024) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // dekod olunmadısa orijinalı saxla
  }

  let { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.85;
  let blob = await toBlob(canvas, quality);
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.15;
    blob = await toBlob(canvas, quality);
  }
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, "") + ".jpeg";
  return new File([blob], name, { type: "image/jpeg" });
}
