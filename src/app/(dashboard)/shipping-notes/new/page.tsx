import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

import { createShippingNoteDraftAction } from "@/features/shipping-notes/actions";
import { ShippingNoteCreateForm } from "@/features/shipping-notes/components/shipping-note-create-form";
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
        title="Create Shipping Note"
        description="Create a compact operational draft. Accounting fields remain unavailable here."
      >
        <Link
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline px-2"
          href="/shipping-notes"
        >
          Back to list
        </Link>
      </PageHeader>

      <div className="flex w-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
        <ShippingNoteCreateForm action={createShippingNoteDraftAction} />
      </div>
    </PageContainer>
  );
}
