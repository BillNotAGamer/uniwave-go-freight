import Link from "next/link";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

import { createShippingNoteDraftAction } from "@/features/shipping-notes/actions";
import { ShippingNoteDraftForm } from "@/features/shipping-notes/components/shipping-note-draft-form";

export default async function NewShippingNotePage() {
  const { user } = await requireAuthenticatedUser();
  requireAnyPermission(user.role, PERMISSIONS.SHIPPING_NOTES_CREATE_OWN);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Shipping Notes
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            New shipping note draft
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Draft creation is limited to sale/admin roles. Accounting fields are
            intentionally unavailable here.
          </p>
        </div>

        <ShippingNoteDraftForm action={createShippingNoteDraftAction} submitLabel="Save Draft" />

        <Link
          className="text-sm text-slate-600 underline-offset-4 hover:underline"
          href="/shipping-notes"
        >
          Back to list
        </Link>
      </div>
    </main>
  );
}
