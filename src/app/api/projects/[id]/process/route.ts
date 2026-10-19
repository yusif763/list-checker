import { NextResponse } from "next/server";
import { getProject, readOriginalFile, saveProject } from "@/lib/projects/repo";
import { planIdentityUnits, processUnit } from "@/lib/document/process-identity";
import type { Project, ProjectFile } from "@/lib/projects/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Hər sorğuda emal büdcəsi — Netlify funksiya limitinin altında qalmaq üçün.
const TIME_BUDGET_MS = 12_000;
const MAX_UNITS_PER_CALL = 4;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function remainingUnits(project: Project): number {
  return project.files
    .filter((f) => f.kind === "identity")
    .reduce((sum, f) => {
      if (f.status === "done") return sum;
      const total = f.totalUnits ?? 1;
      const processed = f.processedUnits ?? 0;
      return sum + Math.max(0, total - processed);
    }, 0);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: "Layihə tapılmadı." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body?.fileId;

    const identityFiles = project.files.filter((f) => f.kind === "identity");

    // Təkrar emal (fileId verilib və fayl bitib/xəta): sıfırla.
    if (targetId) {
      const f = identityFiles.find((x) => x.id === targetId);
      if (f && (f.status === "done" || f.status === "failed")) {
        f.processedUnits = 0;
        f.status = "pending";
        project.identities = project.identities.filter((i) => i.sourceFile !== f.name);
      }
    }

    // Emal ediləcək faylı seç: göstərilən, yoxsa ilk tamamlanmamış.
    const target: ProjectFile | undefined = targetId
      ? identityFiles.find((f) => f.id === targetId)
      : identityFiles.find((f) => f.status !== "done");

    if (!target) {
      return NextResponse.json({ project, processed: null, remaining: 0 });
    }

    const stored = await readOriginalFile(params.id, target.id);
    if (!stored) {
      target.status = "failed";
      target.error = "Orijinal fayl tapılmadı.";
      await saveProject(project);
      return NextResponse.json({ project, processed: target.id, remaining: remainingUnits(project) });
    }

    // Vahidləri planla (şəkillər/mətn hissələri) — AI hələ çağırılmır.
    const plan = await planIdentityUnits(target.name, toArrayBuffer(stored.data));
    target.totalUnits = plan.units.length;
    target.status = "processing";

    let processed = target.processedUnits ?? 0;
    const start = Date.now();
    let count = 0;
    const warnings: string[] = [...plan.warnings];

    while (processed < plan.units.length && count < MAX_UNITS_PER_CALL && Date.now() - start < TIME_BUDGET_MS) {
      const idx = processed;
      try {
        const identity = await processUnit(plan.units[idx], target.name);
        project.identities.push(identity);
      } catch (e) {
        warnings.push(`${target.name} (vəsiqə ${idx + 1}): ${(e as Error).message}`);
      }
      processed = idx + 1;
      count++;
    }

    target.processedUnits = processed;
    target.extractedCount = project.identities.filter((i) => i.sourceFile === target.name).length;
    if (processed >= plan.units.length) {
      target.status = "done";
    }
    if (warnings.length) target.error = warnings.slice(0, 3).join(" | ");

    await saveProject(project);

    return NextResponse.json({
      project,
      processed: target.id,
      remaining: remainingUnits(project),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
