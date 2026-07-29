import Link from "next/link";
import { Package, PlusCircle, ArrowRight, Activity } from "lucide-react";

import { ROLE_LABELS } from "@/lib/permissions/roles";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SHIPPING_NOTE_STATUSES } from "@/features/shipping-notes/constants";

export default async function DashboardPage() {
  const { user } = await requireAuthenticatedUser();

  const canCreate = hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_CREATE_OWN);
  const canReadFinancial = hasPermission(user.role, PERMISSIONS.FINANCIAL_SUMMARY_READ);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Welcome, {user.name}
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              You are signed in as <span className="font-medium text-slate-700">{ROLE_LABELS[user.role]}</span>.
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Actions */}
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Quick Actions
            </h2>

            <Link
              href="/shipping-notes"
              className="group relative flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-slate-900">Shipping Notes</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {canReadFinancial ? "Review notes and accounting details." : "View and manage your shipping notes."}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-indigo-600" />
            </Link>

            {canCreate && (
              <Link
                href="/shipping-notes/new"
                className="group relative flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-medium text-slate-900">New Note</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a draft shipping note.
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-emerald-600" />
              </Link>
            )}
          </section>

          {/* System Status Legend */}
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Status Legend
            </h2>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <Activity className="h-5 w-5" />
                <h3 className="text-base font-medium">Workflow states</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {SHIPPING_NOTE_STATUSES.map((status) => (
                  <StatusBadge key={status} status={status} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
