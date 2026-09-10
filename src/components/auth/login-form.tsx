"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth/client";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const TEMPORARY_SIGN_IN_FAILURE_MESSAGE =
  "Unable to sign in right now. Please try again.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    isSubmittingRef.current = true;
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      });

      if (result.error) {
        setError(INVALID_CREDENTIALS_MESSAGE);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(TEMPORARY_SIGN_IN_FAILURE_MESSAGE);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/30"
          id="email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/30"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <button
            type="button"
            className="absolute right-0 top-0 flex h-full items-center justify-center px-3 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 rounded-md dark:text-slate-500 dark:hover:text-slate-300 dark:focus:ring-indigo-500/30"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:border dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
