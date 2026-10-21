import { NextResponse } from "next/server";
import { deleteOriginalFile, getProject, readOriginalFile, saveProject } from "@/lib/projects/repo";

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

/** Faylı və ona aid məlumatları (qeydlər/vəsiqələr) layihədən silir. */
export async function DELETE(_req: Request, { params }: { params: { id: string; fileId: string } }) {
  try {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: "Layihə tapılmadı." }, { status: 404 });

    const file = project.files.find((f) => f.id === params.fileId);
    if (!file) return NextResponse.json({ error: "Fayl tapılmadı." }, { status: 404 });

    // Fayla aid məlumatları təmizlə.
    if (file.kind === "final") {
      project.finalRecords = project.finalRecords.filter((r) => !r.id.startsWith(`${params.fileId}-`));
    } else if (file.kind === "main") {
      project.mainRecords = project.mainRecords.filter((r) => !r.id.startsWith(`${params.fileId}-`));
    } else if (file.kind === "identity") {
      project.identities = project.identities.filter((i) => i.sourceFile !== file.name);
    }

    project.files = project.files.filter((f) => f.id !== params.fileId);
    await deleteOriginalFile(params.id, params.fileId).catch(() => {});
    await saveProject(project);

    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
