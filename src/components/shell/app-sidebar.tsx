"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { Role } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

import { getNavLinks } from "./nav-links";

type AppSidebarViewProps = {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
  role: Role;
};

export function AppSidebarView({
  collapsed,
  onToggle,
  pathname,
  role,
}: AppSidebarViewProps) {
  const links = getNavLinks(role);
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 self-start flex-col border-r border-border bg-card text-card-foreground md:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
      data-sidebar-state={collapsed ? "collapsed" : "expanded"}
    >
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-border",
          collapsed
            ? "h-16 justify-between gap-1 px-2"
            : "h-16 justify-between gap-2 px-4",
        )}
      >
        <span
          className={cn(
            "font-bold text-foreground",
            collapsed ? "text-base" : "text-lg",
          )}
          title={collapsed ? "Uniwave Go" : undefined}
        >
          <span aria-hidden={collapsed}>{collapsed ? "U" : "Uniwave Go"}</span>
          {collapsed ? <span className="sr-only">Uniwave Go</span> : null}
        </span>
        <button
          aria-controls="desktop-sidebar-navigation"
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggle}
          title={toggleLabel}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-4",
        )}
      >
        <nav className="flex flex-col gap-1" id="desktop-sidebar-navigation">
          {links.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                aria-label={collapsed ? link.title : undefined}
                className={cn(
                  "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  isActive
                    ? "border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                href={link.href}
                key={link.href}
                title={collapsed ? link.title : undefined}
              >
                <link.icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={collapsed ? "sr-only" : undefined}>{link.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <AppSidebarView
      collapsed={collapsed}
      onToggle={() => setCollapsed((current) => !current)}
      pathname={pathname}
      role={role}
    />
  );
}
