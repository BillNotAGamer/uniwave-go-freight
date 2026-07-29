import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const currentSession = await getCurrentSession();

  if (currentSession) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 text-slate-900 sm:px-12 lg:px-8">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:px-10">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Uniwave Go Freight
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-sm leading-6 text-slate-500">
            Internal access only. Self-registration is disabled.
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
