import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

import { createShippingNoteDraftAction } from "@/features/shipping-notes/actions";
import { ShippingNoteDraftForm } from "@/features/shipping-notes/components/shipping-note-draft-form";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";

export default async function NewShippingNotePage() {
  const { user } = await requireAuthenticatedUser();

  if (!hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_CREATE_OWN)) {
    redirect("/shipping-notes");
  }

  return (
    <PageContainer>
      <PageHeader
        title="New shipping note draft"
        description="Draft creation is limited to sale/admin roles. Accounting fields are intentionally unavailable here."
      >
        <Link
          className="text-sm text-slate-600 underline-offset-4 hover:underline px-2"
          href="/shipping-notes"
        >
          Back to list
        </Link>
      </PageHeader>

      <div className="flex w-full flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ShippingNoteDraftForm action={createShippingNoteDraftAction} submitLabel="Save Draft" />
      </div>
    </PageContainer>
  );
}
