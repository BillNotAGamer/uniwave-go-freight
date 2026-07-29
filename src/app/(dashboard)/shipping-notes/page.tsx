import Link from "next/link";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";

import { listShippingNotesForUser } from "@/features/shipping-notes/queries";

function formatDate(value: Date): string {
  return new Date(value).toLocaleString();
}

export default async function ShippingNotesPage() {
  const { user } = await requireAuthenticatedUser();
  const shippingNotes = await listShippingNotesForUser(user);
  const canCreateShippingNote = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_CREATE_OWN,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Shipping notes"
        description="Safe list view only. Draft creation and submission stay server-side."
      >
        {canCreateShippingNote ? (
          <Link
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 shadow-sm"
            href="/shipping-notes/new"
          >
            New Shipping Note
          </Link>
        ) : null}
      </PageHeader>

      <div className="flex w-full flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">

        {shippingNotes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3">Jobsheet No</th>
                  <th className="border-b border-slate-200 px-3 py-3">Mode</th>
                  <th className="border-b border-slate-200 px-3 py-3">Shipper</th>
                  <th className="border-b border-slate-200 px-3 py-3">Consignee</th>
                  <th className="border-b border-slate-200 px-3 py-3">Status</th>
                  <th className="border-b border-slate-200 px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {shippingNotes.map((note) => (
                  <tr key={note.id} className="align-top hover:bg-slate-50 transition-colors">
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      <Link className="text-indigo-600 underline-offset-4 hover:underline" href={`/shipping-notes/${note.id}`}>
                        {note.jobsheetNo}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {note.shippingMode}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {note.shipperText ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {note.consigneeText ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <StatusBadge status={note.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700 whitespace-nowrap">
                      {formatDate(note.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No shipping notes"
            description="You haven't created any shipping notes yet."
          >
            {canCreateShippingNote && (
              <Link
                href="/shipping-notes/new"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 shadow-sm"
              >
                Create new note
              </Link>
            )}
          </EmptyState>
        )}

        <div className="text-xs text-slate-400 mt-2">
          Charge lines, buying data, accounting review, and exports are next-phase
          work.
        </div>
      </div>
    </PageContainer>
  );
}
