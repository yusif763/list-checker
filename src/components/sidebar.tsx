"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Settings, ClipboardCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { label: "Layihələr", href: "/", icon: FolderKanban, match: (p) => p === "/" || p.startsWith("/layihe") },
  { label: "Parametrlər", href: "/parametrler", icon: Settings, match: (p) => p.startsWith("/parametrler") },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold leading-tight text-slate-800">Siyahı Yoxlama</div>
          <div className="text-xs text-slate-500">Sənəd təsdiq sistemi</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-400">
        Yekun siyahı — əsas mənbə. Bütün yoxlamalar ona əsaslanır.
      </div>
    </aside>
  );
}
