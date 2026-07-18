"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavLinks } from "./nav-links";
import type { Role } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = getNavLinks(role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 shrink-0 items-center px-6">
        <span className="text-lg font-bold text-slate-900">Uniwave Go</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <nav className="flex flex-col gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
