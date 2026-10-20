import type { CorrectionsMap } from "@/lib/excel/export";
import type { FileKind, Project, ProjectSummary } from "./types";
import { splitDocxToImageFiles } from "@/lib/client/docx-split";
import { compressImageFile } from "@/lib/client/image-compress";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server xətası (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const d = await handle<{ projects: ProjectSummary[] }>(await fetch("/api/projects"));
  return d.projects;
}

export async function createProject(name: string): Promise<Project> {
  const d = await handle<{ project: Project }>(
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
  return d.project;
}

export async function getProject(id: string): Promise<Project> {
  const d = await handle<{ project: Project }>(await fetch(`/api/projects/${id}`));
  return d.project;
}

export async function deleteProject(id: string): Promise<void> {
  await handle(await fetch(`/api/projects/${id}`, { method: "DELETE" }));
}

// Netlify funksiyalarının sorğu limiti ~6 MB. Hər faylı AYRICA sorğu ilə
// göndəririk ki, birləşmiş ölçü limiti aşmasın.
const MAX_FILE_BYTES = 5.5 * 1024 * 1024;

export async function uploadFiles(
  id: string,
  kind: FileKind,
  files: File[],
): Promise<{ project: Project; warnings: string[] }> {
  let lastProject: Project | null = null;
  const warnings: string[] = [];

  // Şəxsiyyət .docx faylları — brauzerdə şəkillərə böl (böyük fayl limiti üçün).
  const expanded: File[] = [];
  for (const f of files) {
    if (kind === "identity" && f.name.toLowerCase().endsWith(".docx")) {
      try {
        const images = await splitDocxToImageFiles(f);
        if (images.length > 0) {
          expanded.push(...images);
          continue;
        }
      } catch {
        // bölünmədisə, orijinalı yüklə
      }
    }
    expanded.push(f);
  }

  // Böyük şəkilləri brauzerdə sıx (limitin altına düşsün).
  if (kind === "identity") {
    for (let i = 0; i < expanded.length; i++) {
      if (expanded[i].type.startsWith("image/")) {
        try {
          expanded[i] = await compressImageFile(expanded[i]);
        } catch {
          /* sıxılmadısa orijinalı saxla */
        }
      }
    }
  }
  files = expanded;

  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      warnings.push(
        `${f.name}: fayl çox böyükdür (${(f.size / 1024 / 1024).toFixed(1)} MB). ` +
          `Serverless limiti ~6 MB-dır — faylı bölün və ya kiçildin.`,
      );
      continue;
    }
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("files", f);
      const res = await handle<{ project: Project; warnings: string[] }>(
        await fetch(`/api/projects/${id}/upload`, { method: "POST", body: form }),
      );
      lastProject = res.project;
      warnings.push(...(res.warnings ?? []));
    } catch (e) {
      warnings.push(`${f.name}: yüklənmədi — ${(e as Error).message}`);
    }
  }

  if (!lastProject) {
    // Heç biri yüklənmədisə, cari layihəni gətir ki, UI sınmasın.
    lastProject = await getProject(id);
  }
  return { project: lastProject, warnings };
}

export async function processNext(
  id: string,
  fileId?: string,
): Promise<{ project: Project; processed: string | null; remaining: number }> {
  return handle(
    await fetch(`/api/projects/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fileId ? { fileId } : {}),
    }),
  );
}

export async function saveCorrections(id: string, corrections: CorrectionsMap): Promise<void> {
  await handle(
    await fetch(`/api/projects/${id}/corrections`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corrections }),
    }),
  );
}
