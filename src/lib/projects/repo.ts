import { getStorage, type StoredFileMeta } from "@/lib/storage";
import { summarize, type Project, type ProjectSummary } from "./types";

const INDEX_KEY = "projects/index";
const projectKey = (id: string) => `projects/${id}/project`;
const fileKey = (projectId: string, fileId: string) => `projects/${projectId}/files/${fileId}`;

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function readIndex(): Promise<ProjectSummary[]> {
  const storage = getStorage();
  return (await storage.getJSON<ProjectSummary[]>(INDEX_KEY)) ?? [];
}

async function writeIndex(list: ProjectSummary[]): Promise<void> {
  await getStorage().setJSON(INDEX_KEY, list);
}

async function syncIndex(project: Project): Promise<void> {
  const index = await readIndex();
  const summary = summarize(project);
  const i = index.findIndex((p) => p.id === project.id);
  if (i === -1) index.unshift(summary);
  else index[i] = summary;
  await writeIndex(index);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return readIndex();
}

export async function createProject(name: string): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomId("prj"),
    name: name.trim() || "Adsız layihə",
    createdAt: now,
    updatedAt: now,
    files: [],
    finalRecords: [],
    mainRecords: [],
    identities: [],
    corrections: {},
  };
  await getStorage().setJSON(projectKey(project.id), project);
  await syncIndex(project);
  return project;
}

export async function getProject(id: string): Promise<Project | null> {
  return getStorage().getJSON<Project>(projectKey(id));
}

export async function saveProject(project: Project): Promise<Project> {
  project.updatedAt = new Date().toISOString();
  await getStorage().setJSON(projectKey(project.id), project);
  await syncIndex(project);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const storage = getStorage();
  await storage.deletePrefix(`projects/${id}/`);
  await storage.delete(projectKey(id));
  const index = (await readIndex()).filter((p) => p.id !== id);
  await writeIndex(index);
}

/* ----------------------- Orijinal fayllar ----------------------- */

export async function saveOriginalFile(
  projectId: string,
  fileId: string,
  data: ArrayBuffer | Buffer,
  meta: StoredFileMeta,
): Promise<void> {
  await getStorage().putFile(fileKey(projectId, fileId), data, meta);
}

export async function readOriginalFile(
  projectId: string,
  fileId: string,
): Promise<{ data: Buffer; meta: StoredFileMeta } | null> {
  return getStorage().getFile(fileKey(projectId, fileId));
}
