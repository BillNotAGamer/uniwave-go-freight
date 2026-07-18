"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const TEMPORARY_SIGN_IN_FAILURE_MESSAGE =
  "Unable to sign in right now. Please try again.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
          className="block text-sm font-medium text-slate-700"
          htmlFor="password"
        >
          Password
        </label>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
