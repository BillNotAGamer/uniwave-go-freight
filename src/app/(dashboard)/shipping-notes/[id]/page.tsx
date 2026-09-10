import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

import {
  submitShippingNoteAction,
  updateShippingNoteDraftAction,
} from "@/features/shipping-notes/actions";
import { BuyingChargeForm } from "@/features/shipping-notes/components/buying-charge-form";
import { BuyingChargesList } from "@/features/shipping-notes/components/buying-charges-list";
import { FinancialSummaryView } from "@/features/shipping-notes/components/financial-summary";
import { ShippingNoteDraftForm } from "@/features/shipping-notes/components/shipping-note-draft-form";
import { ShippingNoteSubmitForm } from "@/features/shipping-notes/components/shipping-note-submit-form";
import { SellingChargesList } from "@/features/shipping-notes/components/selling-charges-list";
import { SellingChargeForm } from "@/features/shipping-notes/components/selling-charge-form";
import { SellingChargeSummaryView } from "@/features/shipping-notes/components/selling-charge-summary";
import { AccountingReviewControls } from "@/features/shipping-notes/components/accounting-review-controls";
import { CancellationControls } from "@/features/shipping-notes/components/cancellation-controls";
import { CorrectionControls } from "@/features/shipping-notes/components/correction-controls";
import { ExportHistoryPanel } from "@/features/shipping-notes/components/export-history-panel";
import { InternalExportActions } from "@/features/shipping-notes/components/internal-export-actions";
import { AccountingTaxChargeTable } from "@/features/shipping-notes/tax/components/accounting-tax-charge-table";
import { TaxCompletenessPanel } from "@/features/shipping-notes/tax/components/tax-completeness-panel";
import { CustomsDeclarationsPanel } from "@/features/shipping-notes/customs-declarations/components/customs-declarations-panel";
import {
  canReadCustomsDeclarations,
  canManageCustomsDeclarations,
} from "@/features/shipping-notes/customs-declarations/ui-policy";
import { listCustomsDeclarationsForNoteForUser } from "@/features/shipping-notes/customs-declarations/queries";
import {
  getCancellationMetadataForNoteForUser,
  getFinancialSummaryForNoteForUser,
  getShippingNoteForUser,
  listBuyingChargesForNoteForUser,
  getSellingChargesAndSummaryForNoteForUser,
} from "@/features/shipping-notes/queries";
import { listChargeTaxDetailsForNoteForUser } from "@/features/shipping-notes/tax/queries";
import { listShippingNoteExportHistoryForUser } from "@/features/shipping-notes/export/history";
import {
  canShowTaxMutationControls,
  getMarkCheckedDisabledReason,
  getTaxCompletenessCounts,
} from "@/features/shipping-notes/tax/ui-policy";
import {
  canCancelFinalizedShippingNoteStatus,
  canCancelShippingNoteStatus,
  canReopenShippingNoteForCorrectionStatus,
  isInternalXlsxExportEligibleStatus,
} from "@/features/shipping-notes/status-policy";
import { listTaxRulesForUser } from "@/features/tax-rules/queries";
import { ShippingNoteDocumentsPanel } from "@/features/shipping-notes/documents/components/shipping-note-documents-panel";
import {
  canMutateShippingNoteDocuments,
  canReadShippingNoteDocuments,
} from "@/features/shipping-notes/documents/policy";
import { listShippingNoteDocumentsForUser } from "@/features/shipping-notes/documents/queries";
import { getStorageAvailability } from "@/features/shipping-notes/documents/service";

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
  const canReadBuyingCharges = hasPermission(
    user.role,
    PERMISSIONS.BUYING_CHARGES_READ,
  );
  const canReadFinancialSummary = hasPermission(
    user.role,
    PERMISSIONS.FINANCIAL_SUMMARY_READ,
  );
  const canReadTaxSummary = hasPermission(
    user.role,
    PERMISSIONS.TAX_SUMMARY_READ,
  );
  const canOpenInternalExports =
    isInternalXlsxExportEligibleStatus(note.status) &&
    hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL);
  const canReadExportHistory = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL,
  );
  const canManageBuyingCharges =
    hasPermission(user.role, PERMISSIONS.BUYING_CHARGES_MANAGE) &&
    (note.status === "submitted" || note.status === "accounting_reviewing");

  const canStartAccountingReview = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_ACCOUNTING_REVIEW,
  );
  const canMarkChecked = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_MARK_CHECKED,
  );
  const canApprove = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_APPROVE,
  );
  const canLock = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_LOCK,
  );
  const canUnlock = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_UNLOCK,
  );
  const canReopenForCorrection =
    canReopenShippingNoteForCorrectionStatus(note.status) &&
    hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_REOPEN_FOR_CORRECTION);
  const hasNormalCancelPermission = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_CANCEL,
  );
  const hasFinalizedCancelPermission = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_CANCEL_FINALIZED,
  );
  const canCancelOwnDraft =
    note.status === "draft" &&
    user.role === "sale" &&
    note.createdById === user.id &&
    hasNormalCancelPermission;
  const canCancelDraftAsAdmin =
    note.status === "draft" &&
    user.role === "admin" &&
    hasNormalCancelPermission;
  const canCancelActiveAccountingStatus =
    canCancelShippingNoteStatus(note.status) &&
    note.status !== "draft" &&
    (user.role === "accountant" || user.role === "admin") &&
    hasNormalCancelPermission;
  const canCancelNormal =
    canCancelOwnDraft || canCancelDraftAsAdmin || canCancelActiveAccountingStatus;
  const canCancelFinalized =
    canCancelFinalizedShippingNoteStatus(note.status) &&
    hasFinalizedCancelPermission;
  const cancelReasonRequired = !canCancelOwnDraft;
  const showCancellationControls =
    canCancelNormal ||
    canCancelFinalized ||
    (note.status === "locked" && user.role === "admin");
  const canMutateTax = canShowTaxMutationControls({
    role: user.role,
    status: note.status,
  });
  const showAccountingReviewPanel =
    (canStartAccountingReview || canMarkChecked || canApprove || canLock || canUnlock) &&
    (note.status === "submitted" ||
      note.status === "accounting_reviewing" ||
      note.status === "checked" ||
      note.status === "approved" ||
      note.status === "locked");
  const canViewFinancialArea = canReadBuyingCharges || canReadFinancialSummary;
  const shouldFetchFinancialSummary =
    canReadFinancialSummary &&
    note.status !== "draft";

  const { charges: sellingCharges, summary: sellingSummary } = await getSellingChargesAndSummaryForNoteForUser(id, user);
  const buyingCharges = canReadBuyingCharges
    ? await listBuyingChargesForNoteForUser(id, user)
    : null;
  const taxDetails = canReadTaxSummary
    ? await listChargeTaxDetailsForNoteForUser(id, user)
    : [];
  const activeTaxRules = canReadTaxSummary
    ? await listTaxRulesForUser(user)
    : [];
  const taxCounts = getTaxCompletenessCounts(taxDetails);
  const markCheckedDisabledReason = canReadTaxSummary
    ? getMarkCheckedDisabledReason({
      status: note.status,
      canMarkChecked,
      taxComplete: taxCounts.taxComplete,
    })
    : null;
  const sellingTaxDetails = taxDetails.filter(
    (charge) => charge.section === "selling",
  );
  const buyingTaxDetails = taxDetails.filter(
    (charge) => charge.section === "buying",
  );
  const financialSummary = shouldFetchFinancialSummary
    ? await getFinancialSummaryForNoteForUser(id, user)
    : null;
  const cancellationMetadata =
    note.status === "cancelled" &&
    hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_READ_ALL)
      ? await getCancellationMetadataForNoteForUser(id, user)
      : null;
  const exportHistory = canReadExportHistory
    ? await listShippingNoteExportHistoryForUser(id, user)
    : [];
  const canReadCustoms = canReadCustomsDeclarations(user.role);
  const canManageCustoms = canManageCustomsDeclarations({
    role: user.role,
    status: note.status,
  });
  const customsDeclarations = canReadCustoms
    ? await listCustomsDeclarationsForNoteForUser(id, user)
    : [];

  const canReadDocs = canReadShippingNoteDocuments(note, user);
  const canMutateDocs = canMutateShippingNoteDocuments(note, user);
  const documents = canReadDocs
    ? await listShippingNoteDocumentsForUser(id, user)
    : [];
  const storageAvailability = getStorageAvailability();

  return (
    <PageContainer>
      <PageHeader
        title={note.jobsheetNo}
        description={
          <div className="flex items-center gap-2">
            <span>Status:</span>
            <StatusBadge status={note.status} />
          </div>
        }
      >
        <div className="flex items-center gap-2">
          {canOpenInternalExports ? (
            <InternalExportActions
              noteId={note.id}
              printHref={`/shipping-notes/${note.id}/print/internal`}
            />
          ) : null}
          <Link
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline px-2"
            href="/shipping-notes"
          >
            Back to list
          </Link>
        </div>
      </PageHeader>

      <div className="flex w-full flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Shipping
            </p>
            <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Mode</dt>
                <dd>{note.shippingMode}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">MAWB / HAWB</dt>
                <dd>{note.mawbHawbNo ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">AOL</dt>
                <dd>{note.aol ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">AOD</dt>
                <dd>{note.aod ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Final Destination</dt>
                <dd>{note.finalDestination ?? "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Parties
            </p>
            <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Shipper</dt>
                <dd>{note.shipperText ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Consignee</dt>
                <dd>{note.consigneeText ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Customer</dt>
                <dd>{note.customerText ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Agent</dt>
                <dd>{note.agentText ?? "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Shipment
            </p>
            <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">ETD</dt>
                <dd>{formatDateTime(note.etd)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">ETA</dt>
                <dd>{formatDateTime(note.eta)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Volume</dt>
                <dd>
                  {note.volumeValue ?? "-"} {note.volumeUnit ?? ""}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Exchange Rate</dt>
                <dd>{note.exchangeRate}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Timeline
            </p>
            <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Created</dt>
                <dd>{formatDateTime(note.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Submitted</dt>
                <dd>{formatDateTime(note.submittedAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Updated</dt>
                <dd>{formatDateTime(note.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Selling Charges Section */}
        <section className="grid gap-4 border-t border-border pt-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Selling Charges</h2>
            <p className="text-sm text-muted-foreground">
              Selling charge lines for this shipping note.
            </p>
          </div>

          <SellingChargesList
            charges={sellingCharges}
            shippingNoteId={note.id}
            canMutate={canMutateCharges}
          />

          <SellingChargeSummaryView summary={sellingSummary} />

          {canReadTaxSummary ? (
            <AccountingTaxChargeTable
              title="Selling Charge Tax Classification"
              section="selling"
              status={note.status}
              role={user.role}
              charges={sellingTaxDetails}
              activeTaxRules={activeTaxRules}
              canMutateTax={canMutateTax}
            />
          ) : null}

          {canMutateCharges ? (
            <SellingChargeForm shippingNoteId={note.id} />
          ) : null}
        </section>

        {canViewFinancialArea ? (
          <section className="grid gap-4 border-t border-border pt-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Financial Area
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Buying Charges</h2>
              <p className="text-sm text-muted-foreground">
                Accountant and admin users can review buying charge lines here.
              </p>
              {financialSummary ? (
                <p className="text-sm text-muted-foreground">
                  Gross Profit is derived from stored selling and buying totals.
                </p>
              ) : null}
              {!canManageBuyingCharges ? (
                <p className="text-sm text-muted-foreground">
                  Buying charge changes are available only when the shipping note
                  status is submitted or accounting reviewing.
                </p>
              ) : null}
            </div>

            {canReadTaxSummary ? (
              <TaxCompletenessPanel
                status={note.status}
                taxComplete={taxCounts.taxComplete}
                unclassifiedSellingCount={taxCounts.unclassifiedSellingCount}
                unclassifiedBuyingCount={taxCounts.unclassifiedBuyingCount}
                canMarkChecked={canMarkChecked}
              />
            ) : null}

            {showAccountingReviewPanel ? (
              <AccountingReviewControls
                noteId={note.id}
                status={note.status}
                canStartReview={canStartAccountingReview}
                canMarkChecked={canMarkChecked}
                canApprove={canApprove}
                canLock={canLock}
                canUnlock={canUnlock}
                markCheckedDisabledReason={markCheckedDisabledReason}
              />
            ) : null}

            {financialSummary ? (
              <FinancialSummaryView summary={financialSummary} />
            ) : null}

            {canReadBuyingCharges ? (
              <BuyingChargesList
                charges={buyingCharges ?? []}
                canManageBuyingCharges={canManageBuyingCharges}
              />
            ) : null}

            {canReadTaxSummary ? (
              <AccountingTaxChargeTable
                title="Buying Charge Tax Classification"
                section="buying"
                status={note.status}
                role={user.role}
                charges={buyingTaxDetails}
                activeTaxRules={activeTaxRules}
                canMutateTax={canMutateTax}
              />
            ) : null}

            {canReadBuyingCharges ? (
              <BuyingChargeForm
                shippingNoteId={note.id}
                canManageBuyingCharges={canManageBuyingCharges}
              />
            ) : null}

            {canReadCustoms ? (
              <CustomsDeclarationsPanel
                shippingNoteId={note.id}
                declarations={customsDeclarations}
                canManage={canManageCustoms}
              />
            ) : null}
          </section>
        ) : null}

        {canReadExportHistory ? (
          <ExportHistoryPanel rows={exportHistory} viewerRole={user.role} />
        ) : null}

        {canReadDocs ? (
          <ShippingNoteDocumentsPanel
            shippingNoteId={note.id}
            documents={documents}
            canMutate={canMutateDocs}
            storageAvailable={storageAvailability.available}
          />
        ) : null}

        {cancellationMetadata ? (
          <section className="grid gap-4 border-t border-border pt-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Cancellation
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Cancellation History</h2>
            </div>
            <dl className="grid gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <dt className="font-medium text-foreground">Cancelled</dt>
                <dd>{formatDateTime(cancellationMetadata.cancelledAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Cancelled By</dt>
                <dd>{cancellationMetadata.cancelledById ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Reason</dt>
                <dd>{cancellationMetadata.cancelReason ?? "-"}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {canReopenForCorrection &&
        (note.status === "checked" || note.status === "approved") ? (
          <CorrectionControls
            noteId={note.id}
            status={note.status}
          />
        ) : null}

        {showCancellationControls ? (
          <CancellationControls
            noteId={note.id}
            status={note.status}
            canCancelNormal={canCancelNormal}
            canCancelFinalized={canCancelFinalized}
            reasonRequired={cancelReasonRequired}
            showLockedGuidance={note.status === "locked" && user.role === "admin"}
          />
        ) : null}

        {canEditDraft ? (
          <section className="grid gap-6 border-t border-border pt-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Edit draft</h2>
              <p className="text-sm text-muted-foreground">
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
          <p className="border-t border-border pt-6 text-sm text-muted-foreground">
            This note is read-only in the current phase.
          </p>
        )}
      </div>
    </PageContainer>
  );
}
