import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const currentSession = await getCurrentSession();

  if (currentSession) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 text-foreground sm:px-12 lg:px-8">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-xl border border-border bg-card text-card-foreground px-8 py-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none sm:px-10">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            Uniwave Go Freight
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Internal access only. Self-registration is disabled.
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
