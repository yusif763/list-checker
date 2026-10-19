import { NextResponse } from "next/server";
import { getProject, saveOriginalFile, saveProject } from "@/lib/projects/repo";
import { analyzeWorkbook } from "@/lib/excel/analyze";
import type { FileKind, ProjectFile } from "@/lib/projects/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function fileId(): string {
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: "Layihə tapılmadı." }, { status: 404 });

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Fayl oxunmadı — ölçü serverless limitini (~6 MB) aşa bilər. Faylı kiçildin və ya bölün." },
        { status: 400 },
      );
    }
    const kind = form.get("kind") as FileKind | null;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!kind || !["final", "main", "identity"].includes(kind)) {
      return NextResponse.json({ error: "Fayl növü düzgün deyil." }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json(
        { error: "Fayl tapılmadı — ola bilsin fayl çox böyükdür (serverless limiti ~6 MB)." },
        { status: 400 },
      );
    }

    const warnings: string[] = [];

    for (const file of files) {
      const id = fileId();
      const buffer = await file.arrayBuffer();

      // Orijinalı saxla (önizləmə/təkrar emal üçün).
      await saveOriginalFile(params.id, id, buffer, { contentType: file.type, name: file.name, kind });

      const entry: ProjectFile = {
        id,
        name: file.name,
        kind,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: kind === "identity" ? "pending" : "processing",
      };

      if (kind === "final" || kind === "main") {
        try {
          const analysis = await analyzeWorkbook(buffer, file.name, id);
          if (!analysis || analysis.records.length === 0) {
            entry.status = "failed";
            entry.error = "Qeyd tapılmadı və ya struktur tanınmadı.";
            warnings.push(`${file.name}: qeyd qurulmadı.`);
          } else {
            if (kind === "final") project.finalRecords.push(...analysis.records);
            else project.mainRecords.push(...analysis.records);
            entry.status = "done";
            entry.recordCount = analysis.records.length;
          }
        } catch (e) {
          entry.status = "failed";
          entry.error = (e as Error).message;
          warnings.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      // identity faylları ayrıca /process endpoint-i ilə emal olunur (pending qalır).

      project.files.push(entry);
    }

    await saveProject(project);
    return NextResponse.json({ project, warnings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
