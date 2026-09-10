"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import type { Role } from "@/lib/permissions/roles";
import { authClient } from "@/lib/auth/client";

export function MobileNavigation({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const links = getNavLinks(role);

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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Open main menu"
      >
        <Menu className="h-5 w-5" />
      </Dialog.Trigger>
      
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[300px] max-w-[80vw] bg-card text-card-foreground border-r border-border p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
          <div className="flex items-center justify-between mb-8">
            <Dialog.Title className="text-lg font-bold text-foreground">Uniwave Go</Dialog.Title>
            <Dialog.Close
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          
          <nav className="flex flex-col gap-2">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-800/40"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.title}
                </Link>
              );
            })}

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
            
            <button
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
