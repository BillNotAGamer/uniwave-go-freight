import Link from "next/link";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";

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
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Shipping Notes
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Shipping note list
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Safe list view only. Draft creation and submission stay server-side.
            </p>
          </div>

          {canCreateShippingNote ? (
            <Link
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              href="/shipping-notes/new"
            >
              New Shipping Note
            </Link>
          ) : null}
        </div>

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
                  <tr key={note.id} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      <Link className="text-slate-900 underline-offset-4 hover:underline" href={`/shipping-notes/${note.id}`}>
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
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {note.status}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDate(note.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No shipping notes yet.</p>
        )}

        <div className="text-sm text-slate-500">
          Charge lines, buying data, accounting review, and exports are next-phase
          work.
        </div>
      </div>
    </main>
  );
}
