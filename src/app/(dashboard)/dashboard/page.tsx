import { ROLE_LABELS } from "@/lib/permissions/roles";
import { requireAuthenticatedUser } from "@/lib/auth/session";

import { SignOutButton } from "@/components/auth/sign-out-button";

const roleDescriptions = {
  sale: "Sale workspace placeholder. Future scope: create and edit your own shipping note drafts.",
  accountant:
    "Accounting workspace placeholder. Future scope: review shipping notes and accounting fields.",
  admin:
    "Administrative workspace placeholder. Future scope: manage users, audit, and system settings.",
} as const;

export default async function DashboardPage() {
  const { user } = await requireAuthenticatedUser();

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Dashboard
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {ROLE_LABELS[user.role]} workspace
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              {roleDescriptions[user.role]}
            </p>
          </div>

          <SignOutButton />
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current user
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">{user.name}</p>
            <p className="mt-1 text-sm text-slate-600">{user.email}</p>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Role
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {ROLE_LABELS[user.role]}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Protected by server-side session and RBAC helpers.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
