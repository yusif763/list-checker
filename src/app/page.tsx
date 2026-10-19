"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Folder, Trash2, FileSpreadsheet, Database, IdCard } from "lucide-react";
import { createProject, deleteProject, listProjects } from "@/lib/projects/client";
import { Button, Card, Spinner } from "@/components/ui";

export default function ProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const create = useMutation({
    mutationFn: () => createProject(name.trim()),
    onSuccess: (p) => {
      setName("");
      qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/layihe/${p.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Layihələr</h1>
        <p className="text-sm text-slate-500">
          Hər layihə öz Yekun siyahısı, Əsas siyahısı və şəxsiyyət vəsiqələri ilə ayrıca saxlanılır.
        </p>
      </div>

      <Card className="p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yeni layihənin adı (məs. Sabirabad)"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Spinner /> : <FolderPlus className="h-4 w-4" />} Yarat
          </Button>
        </form>
        {create.isError && (
          <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
        )}
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Yüklənir...
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => router.push(`/layihe/${p.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                    <Folder className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(p.updatedAt).toLocaleString("az-AZ")}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${p.name}" layihəsi silinsin?`)) remove.mutate(p.id);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> {p.finalCount}
                </span>
                <span className="flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" /> {p.mainCount}
                </span>
                <span className="flex items-center gap-1">
                  <IdCard className="h-3.5 w-3.5" /> {p.identityCount}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">
          Hələ layihə yoxdur. Yuxarıdan yeni layihə yaradın.
        </Card>
      )}
    </div>
  );
}
