"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { MobileNavigation } from "./mobile-navigation";
import { ThemeToggle } from "./theme-toggle";
import { RoleBadge } from "../ui/role-badge";
import type { CurrentSession } from "@/lib/auth/session";

export function AppTopbar({ session }: { session: CurrentSession }) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card text-card-foreground px-4 sm:px-6 md:px-8">
      <MobileNavigation role={session.user.role} />
      
      <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end text-sm">
            <span className="font-medium text-foreground leading-tight truncate max-w-[120px] sm:max-w-[200px]">{session.user.name}</span>
            <span className="text-muted-foreground text-xs leading-tight truncate max-w-[120px] sm:max-w-[200px]">{session.user.email}</span>
          </div>
          <RoleBadge role={session.user.role} />
        </div>
        
        <div className="h-6 w-px bg-border hidden sm:block" />

        <ThemeToggle className="hidden sm:inline-flex" />
        
        <div className="h-6 w-px bg-border hidden sm:block" />
        
        <button
          onClick={handleSignOut}
          className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
