import { readOriginalFile } from "@/lib/projects/repo";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string; fileId: string } }) {
  try {
    const stored = await readOriginalFile(params.id, params.fileId);
    if (!stored) return new Response("Fayl tapılmadı.", { status: 404 });
    const contentType = (stored.meta.contentType as string) || "application/octet-stream";
    const name = (stored.meta.name as string) || params.fileId;
    return new Response(stored.data as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch (err) {
    return new Response((err as Error).message, { status: 500 });
  }
}
