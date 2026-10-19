import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects/repo";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: "Layihə tapılmadı." }, { status: 404 });
    const body = await req.json();
    if (body && typeof body.corrections === "object") {
      project.corrections = body.corrections;
      await saveProject(project);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
