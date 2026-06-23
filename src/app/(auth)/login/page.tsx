import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const currentSession = await getCurrentSession();

  if (currentSession) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Uniwave Go Freight
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm leading-6 text-slate-600">
            Internal access only. Self-registration is disabled.
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
