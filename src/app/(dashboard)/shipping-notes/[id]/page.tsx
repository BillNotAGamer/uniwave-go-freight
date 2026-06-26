import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";

import {
  submitShippingNoteAction,
  updateShippingNoteDraftAction,
} from "@/features/shipping-notes/actions";
import { ShippingNoteDraftForm } from "@/features/shipping-notes/components/shipping-note-draft-form";
import { ShippingNoteSubmitForm } from "@/features/shipping-notes/components/shipping-note-submit-form";
import { SellingChargesList } from "@/features/shipping-notes/components/selling-charges-list";
import { SellingChargeForm } from "@/features/shipping-notes/components/selling-charge-form";
import { SellingChargeSummaryView } from "@/features/shipping-notes/components/selling-charge-summary";
import {
  getShippingNoteForUser,
  getSellingChargesAndSummaryForNoteForUser,
} from "@/features/shipping-notes/queries";

function formatDateTime(value: Date | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

export default async function ShippingNoteDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { user } = await requireAuthenticatedUser();
  const { id } = await params;
  const note = await getShippingNoteForUser(id, user);

  if (!note) {
    notFound();
  }

  const canEditDraft =
    note.status === "draft" &&
    hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN) &&
    (user.role === "admin" || note.createdById === user.id);

  // Accountant cannot mutate charges, even though they can view.
  const canMutateCharges =
    canEditDraft && user.role !== "accountant";

  const { charges: sellingCharges, summary: sellingSummary } = await getSellingChargesAndSummaryForNoteForUser(id, user);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Shipping Notes
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {note.jobsheetNo}
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Status: {note.status}
            </p>
          </div>

          <Link
            className="text-sm text-slate-600 underline-offset-4 hover:underline"
            href="/shipping-notes"
          >
            Back to list
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Shipping
            </p>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">Mode</dt>
                <dd>{note.shippingMode}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">MAWB / HAWB</dt>
                <dd>{note.mawbHawbNo ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">AOL</dt>
                <dd>{note.aol ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">AOD</dt>
                <dd>{note.aod ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Final Destination</dt>
                <dd>{note.finalDestination ?? "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Parties
            </p>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">Shipper</dt>
                <dd>{note.shipperText ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Consignee</dt>
                <dd>{note.consigneeText ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Customer</dt>
                <dd>{note.customerText ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Agent</dt>
                <dd>{note.agentText ?? "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Shipment
            </p>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">ETD</dt>
                <dd>{formatDateTime(note.etd)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">ETA</dt>
                <dd>{formatDateTime(note.eta)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Volume</dt>
                <dd>
                  {note.volumeValue ?? "-"} {note.volumeUnit ?? ""}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Exchange Rate</dt>
                <dd>{note.exchangeRate}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Timeline
            </p>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">Created</dt>
                <dd>{formatDateTime(note.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Submitted</dt>
                <dd>{formatDateTime(note.submittedAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Updated</dt>
                <dd>{formatDateTime(note.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Selling Charges Section */}
        <section className="grid gap-4 border-t border-slate-200 pt-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">Selling Charges</h2>
            <p className="text-sm text-slate-600">
              Selling charge lines for this shipping note.
            </p>
          </div>

          <SellingChargesList
            charges={sellingCharges}
            shippingNoteId={note.id}
            canMutate={canMutateCharges}
          />

          <SellingChargeSummaryView summary={sellingSummary} />

          {canMutateCharges ? (
            <SellingChargeForm shippingNoteId={note.id} />
          ) : null}
        </section>

        {canEditDraft ? (
          <section className="grid gap-6 border-t border-slate-200 pt-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Edit draft</h2>
              <p className="text-sm text-slate-600">
                Draft-only edit path. Buying charges, tax settings, and audit logs are
                intentionally unavailable in this phase.
              </p>
            </div>

            <ShippingNoteDraftForm
              action={updateShippingNoteDraftAction}
              hiddenId={note.id}
              submitLabel="Save Draft Changes"
              values={note}
            />

            <ShippingNoteSubmitForm
              action={submitShippingNoteAction}
              noteId={note.id}
              submitLabel="Submit Draft"
            />
          </section>
        ) : (
          <p className="border-t border-slate-200 pt-6 text-sm text-slate-600">
            This note is read-only in the current phase.
          </p>
        )}
      </div>
    </main>
  );
}
