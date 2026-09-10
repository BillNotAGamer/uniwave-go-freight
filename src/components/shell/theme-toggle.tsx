"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "uniwave-theme";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Fail safely if storage is inaccessible
  }
  return "system";
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(callback: () => void) {
  window.addEventListener("uniwave-theme-change", callback);
  window.addEventListener("storage", callback);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  function onMediaChange() {
    if (getStoredTheme() === "system") {
      document.documentElement.classList.toggle("dark", resolveIsDark("system"));
    }
    callback();
  }
  mediaQuery.addEventListener("change", onMediaChange);

  return () => {
    window.removeEventListener("uniwave-theme-change", callback);
    window.removeEventListener("storage", callback);
    mediaQuery.removeEventListener("change", onMediaChange);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getStoredTheme, () => "system");

  useEffect(() => {
    const current = getStoredTheme();
    document.documentElement.classList.toggle("dark", resolveIsDark(current));
  }, []);

  function handleSelect(mode: ThemeMode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Fail safely if storage is blocked
    }

    const isDark = resolveIsDark(mode);
    document.documentElement.classList.toggle("dark", isDark);

    window.dispatchEvent(
      new CustomEvent<ThemeMode>("uniwave-theme-change", { detail: mode }),
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5 shadow-xs",
        className,
      )}
      role="group"
      aria-label="Theme selection"
    >
      <button
        type="button"
        onClick={() => handleSelect("light")}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          theme === "light"
            ? "bg-card text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="Light mode"
        aria-pressed={theme === "light"}
        title="Light mode"
      >
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => handleSelect("dark")}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          theme === "dark"
            ? "bg-card text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="Dark mode"
        aria-pressed={theme === "dark"}
        title="Dark mode"
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => handleSelect("system")}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          theme === "system"
            ? "bg-card text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="System theme"
        aria-pressed={theme === "system"}
        title="System theme"
      >
        <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
