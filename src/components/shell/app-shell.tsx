import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import type { CurrentSession } from "@/lib/auth/session";

export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: CurrentSession;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-slate-50">
      <AppSidebar role={session.user.role} />
      
      <div className="flex flex-1 flex-col min-w-0">
        <AppTopbar session={session} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
