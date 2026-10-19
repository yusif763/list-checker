import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, listProjects } from "@/lib/projects/repo";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ projects: await listProjects() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const CreateSchema = z.object({ name: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    const body = CreateSchema.parse(await req.json());
    const project = await createProject(body.name);
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
