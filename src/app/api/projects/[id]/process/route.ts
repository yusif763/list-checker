import { NextResponse } from "next/server";
import { getProject, readOriginalFile, saveProject } from "@/lib/projects/repo";
import { processIdentityFile } from "@/lib/document/process-identity";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Növbəti gözləyən (və ya `fileId` ilə göstərilən) şəxsiyyət faylını emal edir.
 * Addım-addım: klient təkrar çağıraraq statusu izləyir.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: "Layihə tapılmadı." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body?.fileId;

    const identityFiles = project.files.filter((f) => f.kind === "identity");
    const target = targetId
      ? identityFiles.find((f) => f.id === targetId)
      : identityFiles.find((f) => f.status === "pending" || f.status === "failed");

    if (!target) {
      return NextResponse.json({ project, processed: null, remaining: 0 });
    }

    target.status = "processing";
    target.error = undefined;
    await saveProject(project);

    try {
      const stored = await readOriginalFile(params.id, target.id);
      if (!stored) throw new Error("Orijinal fayl tapılmadı.");
      const { identities, warnings } = await processIdentityFile(target.name, stored.data.buffer.slice(
        stored.data.byteOffset,
        stored.data.byteOffset + stored.data.byteLength,
      ) as ArrayBuffer);

      // Bu fayla aid əvvəlki çıxarışları əvəz et (təkrar emal üçün).
      project.identities = project.identities.filter((i) => i.sourceFile !== target.name);
      project.identities.push(...identities);

      target.status = "done";
      target.extractedCount = identities.length;
      if (warnings.length) target.error = warnings.join(" | ");
    } catch (e) {
      target.status = "failed";
      target.error = (e as Error).message;
    }

    await saveProject(project);

    const remaining = project.files.filter(
      (f) => f.kind === "identity" && (f.status === "pending"),
    ).length;

    return NextResponse.json({ project, processed: target.id, remaining });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
