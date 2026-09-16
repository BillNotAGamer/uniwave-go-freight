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
import { ShippingNoteHardDeleteControls } from "@/features/shipping-notes/components/shipping-note-hard-delete-controls";
import { CorrectionControls } from "@/features/shipping-notes/components/correction-controls";
import { ExportHistoryPanel } from "@/features/shipping-notes/components/export-history-panel";
import { InternalExportActions } from "@/features/shipping-notes/components/internal-export-actions";
import { AccountingTaxChargeTable } from "@/features/shipping-notes/tax/components/accounting-tax-charge-table";
import { TaxCompletenessPanel } from "@/features/shipping-notes/tax/components/tax-completeness-panel";
import {
  getCancellationMetadataForNoteForUser,
  getFinancialSummaryForNoteForUser,
  getShippingNoteDetailForUser,
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
  canMutateBuyingChargeForActor,
  canSubmitShippingNoteDraft,
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
import { getShippingModePresentation } from "@/features/shipping-notes/mode-rules";
import {
  formatDetailDateTime,
  formatDetailValue,
  formatMawbHawb,
} from "@/features/shipping-notes/presentation";

function formatCreator(createdBy: { name: string; email: string } | null): string {
  return createdBy?.name.trim() || createdBy?.email || "Unknown user";
}

export default async function ShippingNoteDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { user } = await requireAuthenticatedUser();
  const { id } = await params;
  const note = await getShippingNoteDetailForUser(id, user);

  if (!note) {
    notFound();
  }

  const canEditDraft =
    note.status === "draft" &&
    hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN) &&
    (user.role === "admin" || note.createdById === user.id);
  const canSubmitDraft =
    hasPermission(user.role, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN) &&
    canSubmitShippingNoteDraft(note, user);

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
    (hasPermission(user.role, PERMISSIONS.BUYING_CHARGES_MANAGE) ||
      hasPermission(user.role, PERMISSIONS.BUYING_CHARGES_OPS_INPUT))
      ? canMutateBuyingChargeForActor(note.status, user)
      : false;

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
  const canHardDelete = hasPermission(
    user.role,
    PERMISSIONS.ADMIN_DESTRUCTIVE_ACTIONS,
  );
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
    (user.role === "sale" || user.role === "ops") &&
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
        <section className="flex min-w-0 flex-col gap-4 sm:grid sm:grid-cols-2 sm:items-start">
          {/* Flatten stacks on mobile to preserve the interleaved card order without duplication. */}
          <div className="contents sm:flex sm:min-w-0 sm:flex-col sm:gap-4">
            <div className="order-1 min-w-0 sm:order-none rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Shipping
              </p>
              <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Mode</dt>
                  <dd className="break-words">{getShippingModePresentation(note.shippingMode).label}</dd>
                </div>
                {note.shippingMode === "custom" ? (
                  <>
                    <div>
                      <dt className="font-medium text-foreground">Custom Mode</dt>
                      <dd className="break-words">{formatDetailValue(note.customModeName)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">From</dt>
                      <dd className="break-words">{formatDetailValue(note.customOrigin)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">To</dt>
                      <dd className="break-words">{formatDetailValue(note.customDestination)}</dd>
                    </div>
                  </>
                ) : null}
                <div>
                  <dt className="font-medium text-foreground">Commidity</dt>
                  <dd className="break-words">{formatDetailValue(note.commodity ?? note.commodityHsCode)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">HS Code</dt>
                  <dd className="break-words">{formatDetailValue(note.hsCode)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Exchange Rate</dt>
                  <dd className="break-words">{formatDetailValue(note.exchangeRate)}</dd>
                </div>
              </dl>
            </div>

            {note.shippingMode === "sea_import" || note.shippingMode === "sea_export" ? (
              <div className="order-3 min-w-0 sm:order-none rounded-md border border-border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Transport Documents
                </p>
                <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div>
                    <dt className="font-medium text-foreground">MBL</dt>
                    <dd className="break-words">{formatDetailValue(note.mblNo)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">HBL</dt>
                    <dd className="break-words">{formatDetailValue(note.hblNo)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Container No.</dt>
                    <dd className="break-words">{formatDetailValue(note.containerNo)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Seal No.</dt>
                    <dd className="break-words">{formatDetailValue(note.sealNo)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Carrier Name</dt>
                    <dd className="break-words">{formatDetailValue(note.carrierName)}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {note.shippingMode === "air_import" || note.shippingMode === "air_export" || Boolean(note.mawbHawbNo) ? (
              <div className="order-3 min-w-0 sm:order-none rounded-md border border-border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Transport Documents
                </p>
                <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div>
                    <dt className="font-medium text-foreground">MAWB / HAWB</dt>
                    <dd className="break-words">{formatMawbHawb(note)}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="order-5 min-w-0 sm:order-none rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Timeline
              </p>
              <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Created</dt>
                  <dd className="break-words">{formatDetailDateTime(note.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Created by</dt>
                  <dd className="break-words">{formatCreator(note.createdBy)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Submitted</dt>
                  <dd className="break-words">{formatDetailDateTime(note.submittedAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Updated</dt>
                  <dd className="break-words">{formatDetailDateTime(note.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="contents sm:flex sm:min-w-0 sm:flex-col sm:gap-4">
            <div className="order-2 min-w-0 sm:order-none rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Parties
              </p>
              <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Shipper</dt>
                  <dd className="break-words">{formatDetailValue(note.shipperText)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Consignee</dt>
                  <dd className="break-words">{formatDetailValue(note.consigneeText)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Customer</dt>
                  <dd className="break-words">{formatDetailValue(note.customerText)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Agent</dt>
                  <dd className="break-words">{formatDetailValue(note.agentText)}</dd>
                </div>
              </dl>
            </div>

            <div className="order-4 min-w-0 sm:order-none rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Schedule & Cargo
              </p>
              <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                {note.shippingMode === "sea_import" || note.shippingMode === "sea_export" ? (
                  <>
                    <div>
                      <dt className="font-medium text-foreground">POL</dt>
                      <dd className="break-words">{formatDetailValue(note.portOfLoading)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">POD</dt>
                      <dd className="break-words">{formatDetailValue(note.portOfDischarge)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Final Destination</dt>
                      <dd className="break-words">{formatDetailValue(note.finalDestination)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Vessel / Voyage</dt>
                      <dd className="break-words">
                        {formatDetailValue(note.vesselName)} / {formatDetailValue(note.voyageNo)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Gross Weight</dt>
                      <dd className="break-words">{formatDetailValue(note.grossWeight)}</dd>
                    </div>
                  </>
                ) : null}

                {note.shippingMode === "air_import" || note.shippingMode === "air_export" ? (
                  <>
                    <div>
                      <dt className="font-medium text-foreground">AOL</dt>
                      <dd className="break-words">{formatDetailValue(note.aol)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">AOD</dt>
                      <dd className="break-words">{formatDetailValue(note.aod)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Final Destination</dt>
                      <dd className="break-words">{formatDetailValue(note.finalDestination)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Flight No.</dt>
                      <dd className="break-words">{formatDetailValue(note.flightNo)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Chargeable Weight</dt>
                      <dd className="break-words">{formatDetailValue(note.chargeableWeight)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Gross Weight</dt>
                      <dd className="break-words">{formatDetailValue(note.grossWeight)}</dd>
                    </div>
                  </>
                ) : null}

                {note.shippingMode === "domestic_truck" ? (
                  <>
                    <div>
                      <dt className="font-medium text-foreground">Origin</dt>
                      <dd className="break-words">{formatDetailValue(note.domesticOrigin)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Destination</dt>
                      <dd className="break-words">{formatDetailValue(note.domesticDestination)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">License Plate</dt>
                      <dd className="break-words">{formatDetailValue(note.licensePlate)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Driver Information</dt>
                      <dd className="whitespace-pre-wrap break-words">{formatDetailValue(note.driverInformation)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Vehicle Payload Capacity</dt>
                      <dd className="break-words">{formatDetailValue(note.vehiclePayloadCapacity)}</dd>
                    </div>
                  </>
                ) : null}

                <div>
                  <dt className="font-medium text-foreground">ETD</dt>
                  <dd className="break-words">{formatDetailDateTime(note.etd)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">ETA</dt>
                  <dd className="break-words">{formatDetailDateTime(note.eta)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Volume</dt>
                  <dd className="break-words">
                    {note.volumeValue ? `${note.volumeValue} ${note.volumeUnit ?? ""}`.trim() : "-"}
                  </dd>
                </div>
              </dl>
            </div>
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
                Buying charge lines are available to authorized operational and accounting users.
              </p>
              {financialSummary ? (
                <p className="text-sm text-muted-foreground">
                  Gross Profit is derived from stored selling and buying totals.
                </p>
              ) : null}
              {!canManageBuyingCharges ? (
                <p className="text-sm text-muted-foreground">
                  Buying charge changes are unavailable at this shipping note status.
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
                defaultExchangeRate={note.exchangeRate}
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
                <dd className="break-words">{formatDetailDateTime(cancellationMetadata.cancelledAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Cancelled By</dt>
                <dd className="break-words">{cancellationMetadata.cancelledById ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Reason</dt>
                <dd className="break-words">{cancellationMetadata.cancelReason ?? "-"}</dd>
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

        {canHardDelete ? <ShippingNoteHardDeleteControls noteId={note.id} /> : null}

        {canEditDraft ? (
          <section className="grid gap-6 border-t border-border pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Edit Shipment</h2>
                <StatusBadge status="draft" />
              </div>
              <p className="text-sm text-muted-foreground">
                Update shipment details while this shipment is still in Draft.
              </p>
            </div>

            <ShippingNoteDraftForm
              action={updateShippingNoteDraftAction}
              hiddenId={note.id}
              submitLabel="Save changes"
              values={note}
            />

            {canSubmitDraft ? (
              <ShippingNoteSubmitForm
                action={submitShippingNoteAction}
                noteId={note.id}
                submitLabel="Submit Draft"
              />
            ) : null}
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
