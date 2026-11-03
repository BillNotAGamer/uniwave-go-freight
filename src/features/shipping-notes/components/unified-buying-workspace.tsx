"use client";

import React, { useMemo, useState } from "react";

import type { Role } from "@/lib/permissions/roles";
import { addDecimalStrings } from "@/lib/calculations/decimal";
import { summarizeBuyingCharges } from "@/lib/calculations/shipping-note";
import type { ShippingNoteStatus } from "../constants";
import { formatFinancialDecimal } from "../presentation";
import type { BuyingChargeDetail, SellingChargeSummary } from "../types";
import type { ChargeTaxDetail, ChargeTaxRuleOption } from "../tax/types";
import {
  canOverrideChargeTax,
  filterTaxRulesForChargeSection,
  getChargeTaxBadges,
  getTaxTreatmentLabel,
} from "../tax/ui-policy";
import {
  AssignTaxRulePanel,
  Badge,
  OverrideVatPanel,
} from "../tax/components/accounting-tax-charge-table";
import {
  DeleteBuyingChargeButton,
  EditBuyingChargeRow,
} from "./buying-charges-list";

export type UnifiedBuyingTotals = {
  subtotalExcludingVatVnd: string;
  totalVatVnd: string | null;
  totalIncludingVatVnd: string | null;
  completeTaxCount: number;
  totalsByCurrency: SellingChargeSummary["totalsByCurrency"];
};

/**
 * Pure Decimal-based aggregation for the Unified Buying Workspace.
 * Never adds original amounts across currencies (USD, EUR, VND) and never uses floating-point arithmetic.
 * All aggregated totals are computed strictly from canonical VND decimal strings at scale 2.
 */
export function computeUnifiedBuyingTotals(
  charges: readonly BuyingChargeDetail[],
  taxDetails: readonly ChargeTaxDetail[],
  canReadTaxSummary: boolean,
): UnifiedBuyingTotals {
  const summary = summarizeBuyingCharges(charges);

  if (!canReadTaxSummary) {
    return {
      subtotalExcludingVatVnd: summary.totalVnd,
      totalVatVnd: null,
      totalIncludingVatVnd: null,
      completeTaxCount: 0,
      totalsByCurrency: summary.totalsByCurrency,
    };
  }

  const taxByChargeId = new Map(taxDetails.map((t) => [t.chargeId, t]));
  const vatValuesVnd: string[] = [];
  let completeTaxCount = 0;

  for (const charge of charges) {
    const tax = taxByChargeId.get(charge.id);
    if (tax) {
      vatValuesVnd.push(tax.vatAmount);
      if (tax.taxComplete) {
        completeTaxCount += 1;
      }
    }
  }

  const totalVatVnd = addDecimalStrings(vatValuesVnd, 2);
  const totalIncludingVatVnd = addDecimalStrings(
    [summary.totalVnd, totalVatVnd],
    2,
  );

  return {
    subtotalExcludingVatVnd: summary.totalVnd,
    totalVatVnd,
    totalIncludingVatVnd,
    completeTaxCount,
    totalsByCurrency: summary.totalsByCurrency,
  };
}

export type UnifiedBuyingWorkspaceProps = {
  charges: BuyingChargeDetail[];
  canManageBuyingCharges: boolean;
  canReadTaxSummary: boolean;
  canMutateTax: boolean;
  taxDetails: ChargeTaxDetail[];
  activeTaxRules: ChargeTaxRuleOption[];
  status: ShippingNoteStatus;
  role: Role;
  initialEditingId?: string | null;
};

export function UnifiedBuyingWorkspace({
  charges,
  canManageBuyingCharges,
  canReadTaxSummary,
  canMutateTax,
  taxDetails,
  activeTaxRules,
  status,
  role,
  initialEditingId = null,
}: UnifiedBuyingWorkspaceProps) {
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);

  const safeTaxDetails = useMemo(
    () => (canReadTaxSummary ? taxDetails : []),
    [canReadTaxSummary, taxDetails],
  );

  const sectionRules = useMemo(
    () =>
      canReadTaxSummary
        ? filterTaxRulesForChargeSection(activeTaxRules, "buying")
        : [],
    [canReadTaxSummary, activeTaxRules],
  );

  if (charges.length === 0) {
    return (
      <div className="space-y-1" data-testid="unified-buying-workspace-empty">
        <h3 className="text-sm font-semibold text-foreground">
          {canReadTaxSummary
            ? "Buying Charges & Tax Classification"
            : "Buying Charges"}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No buying charges yet.
        </p>
        {canReadTaxSummary ? (
          <p className="text-xs text-muted-foreground">
            No active buying charges require tax classification.
          </p>
        ) : null}
      </div>
    );
  }

  const totals = computeUnifiedBuyingTotals(
    charges,
    safeTaxDetails,
    canReadTaxSummary,
  );

  const effectiveCanMutateTax = canReadTaxSummary && canMutateTax;
  const showActionsColumn = canManageBuyingCharges || effectiveCanMutateTax;
  const columnCount = canReadTaxSummary
    ? showActionsColumn
      ? 10
      : 9
    : canManageBuyingCharges
      ? 11
      : 10;

  return (
    <div className="grid gap-3" data-testid="unified-buying-workspace">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {canReadTaxSummary
              ? "Buying Charges & Tax Classification"
              : "Buying Charges"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {canReadTaxSummary
              ? "Unified commercial costs, tax classification, and VAT reconciliation."
              : "Operational buying charges summary."}
          </p>
          {canReadTaxSummary && !effectiveCanMutateTax ? (
            <p className="text-xs text-muted-foreground">
              {status === "draft"
                ? "Tax classification is available after submission."
                : status === "checked"
                  ? "Tax values are read-only because this note is checked."
                  : "Tax values are read-only for this status."}
            </p>
          ) : null}
        </div>

        {canReadTaxSummary ? (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Subtotal (Excl. VAT):{" "}
              <strong className="text-foreground font-semibold">
                {formatFinancialDecimal(totals.subtotalExcludingVatVnd)} VND
              </strong>
            </span>
            <span className="text-muted-foreground">
              VAT:{" "}
              <strong className="text-foreground font-semibold">
                {formatFinancialDecimal(totals.totalVatVnd ?? "0.00")} VND
              </strong>
            </span>
            <span className="text-muted-foreground">
              Total (Incl. VAT):{" "}
              <strong className="text-foreground font-semibold">
                {formatFinancialDecimal(
                  totals.totalIncludingVatVnd ?? totals.subtotalExcludingVatVnd,
                )}{" "}
                VND
              </strong>
            </span>
            <Badge
              tone={
                totals.completeTaxCount === charges.length ? "emerald" : "amber"
              }
            >
              {totals.completeTaxCount}/{charges.length} tax-classified
            </Badge>
          </div>
        ) : (
          <p className="text-sm font-medium text-foreground">
            Buying subtotal:{" "}
            {formatFinancialDecimal(totals.subtotalExcludingVatVnd)} VND
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            {canReadTaxSummary ? (
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="border-b border-border px-3 py-2.5">Charge</th>
                <th className="border-b border-border px-3 py-2.5">
                  Description
                </th>
                <th className="border-b border-border px-3 py-2.5 text-right">
                  Qty / Unit
                </th>
                <th className="border-b border-border px-3 py-2.5 text-right">
                  Unit Price
                </th>
                <th className="border-b border-border px-3 py-2.5 text-right">
                  Excl. VAT (VND)
                </th>
                <th className="border-b border-border px-3 py-2.5">
                  Tax Rule
                </th>
                <th className="border-b border-border px-3 py-2.5 text-right">
                  VAT (VND)
                </th>
                <th className="border-b border-border px-3 py-2.5 text-right">
                  Incl. VAT (VND)
                </th>
                <th className="border-b border-border px-3 py-2.5">
                  Vendor / Agent
                </th>
                {showActionsColumn ? (
                  <th className="border-b border-border px-3 py-2.5 text-right">
                    Actions
                  </th>
                ) : null}
              </tr>
            ) : (
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="border-b border-border px-3 py-2">Charge</th>
                <th className="border-b border-border px-3 py-2">
                  Description
                </th>
                <th className="border-b border-border px-3 py-2 text-right">
                  Qty
                </th>
                <th className="border-b border-border px-3 py-2">Unit</th>
                <th className="border-b border-border px-3 py-2 text-right">
                  Unit Price
                </th>
                <th className="border-b border-border px-3 py-2">Curr</th>
                <th className="border-b border-border px-3 py-2 text-right">
                  Rate
                </th>
                <th className="border-b border-border px-3 py-2 text-right">
                  Amount
                </th>
                <th className="border-b border-border px-3 py-2 text-right">
                  VND
                </th>
                <th className="border-b border-border px-3 py-2">
                  Vendor / Agent
                </th>
                {canManageBuyingCharges ? (
                  <th className="border-b border-border px-3 py-2 text-right">
                    Actions
                  </th>
                ) : null}
              </tr>
            )}
          </thead>
          <tbody>
            {charges.map((charge) => {
              const isEditing = editingId === charge.id;
              if (isEditing && canManageBuyingCharges) {
                return (
                  <EditBuyingChargeRow
                    key={charge.id}
                    charge={charge}
                    colSpan={columnCount}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }

              const taxDetail = canReadTaxSummary
                ? safeTaxDetails.find((t) => t.chargeId === charge.id) ?? null
                : null;

              const taxBadges = taxDetail ? getChargeTaxBadges(taxDetail) : [];
              const canOverride =
                Boolean(taxDetail) &&
                effectiveCanMutateTax &&
                canOverrideChargeTax({ role, status, charge: taxDetail! });

              return (
                <tr
                  key={charge.id}
                  className="align-top hover:bg-muted/40 transition-colors"
                >
                  {/* Charge Name & Catalog Snapshot */}
                  <td className="border-b border-border/60 px-3 py-2 font-medium text-foreground">
                    <div>
                      {charge.catalogNameSnapshot ?? charge.chargeName}
                    </div>
                    {charge.catalogCodeSnapshot ? (
                      <div className="text-xs text-muted-foreground font-normal">
                        [{charge.catalogCodeSnapshot}]
                      </div>
                    ) : null}
                    {canReadTaxSummary ? (
                      <div className="mt-0.5 text-xs text-muted-foreground font-normal">
                        Catalog VAT:{" "}
                        {charge.catalogVatRateSnapshot
                          ? `${Number(charge.catalogVatRateSnapshot)}%`
                          : "Unspecified"}
                      </div>
                    ) : null}
                  </td>

                  {/* Description */}
                  <td className="border-b border-border/60 px-3 py-2 text-muted-foreground">
                    {charge.description ?? "-"}
                  </td>

                  {canReadTaxSummary ? (
                    <>
                      {/* Qty / Unit */}
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {formatFinancialDecimal(charge.quantity)}{" "}
                        <span className="text-xs font-normal">
                          {charge.unit ?? ""}
                        </span>
                      </td>

                      {/* Unit Price & Currency / Rate */}
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        <div>
                          {formatFinancialDecimal(charge.unitPrice)}{" "}
                          <span className="text-xs font-normal">
                            {charge.currency}
                          </span>
                        </div>
                        {charge.currency !== "VND" ? (
                          <div className="text-xs text-muted-foreground/80">
                            @ {formatFinancialDecimal(charge.exchangeRate)}
                          </div>
                        ) : null}
                      </td>

                      {/* Excl. VAT (VND) */}
                      <td className="border-b border-border/60 px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                        <div>{formatFinancialDecimal(charge.amountVnd)}</div>
                        {charge.currency !== "VND" ? (
                          <div className="text-xs text-muted-foreground font-normal">
                            {formatFinancialDecimal(charge.amountOriginal)}{" "}
                            {charge.currency}
                          </div>
                        ) : null}
                      </td>

                      {/* Tax Rule Snapshot, Badges & Treatment */}
                      <td className="border-b border-border/60 px-3 py-2">
                        {taxDetail ? (
                          <div className="max-w-56 space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              {taxBadges.map((badge) => (
                                <Badge
                                  key={badge}
                                  tone={
                                    badge === "Override"
                                      ? "amber"
                                      : taxDetail.taxComplete
                                        ? "emerald"
                                        : "slate"
                                  }
                                >
                                  {badge}
                                </Badge>
                              ))}
                              <Badge
                                tone={
                                  taxDetail.taxComplete ? "emerald" : "slate"
                                }
                              >
                                {taxDetail.taxComplete
                                  ? "Complete"
                                  : "Unclassified"}
                              </Badge>
                            </div>
                            {taxDetail.taxRuleCodeSnapshot ? (
                              <div>
                                <div className="flex items-center gap-1 font-medium text-foreground">
                                  <span>{taxDetail.taxRuleCodeSnapshot}</span>
                                  <span className="text-xs font-normal text-muted-foreground">
                                    (
                                    {Number(
                                      taxDetail.effectiveAccountingVatRate ??
                                        taxDetail.vatPercent,
                                    )}
                                    %)
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {taxDetail.taxRuleNameSnapshot ??
                                    getTaxTreatmentLabel(
                                      taxDetail.taxTreatmentSnapshot,
                                    )}
                                </div>
                              </div>
                            ) : null}
                            {taxDetail.overrideReason ? (
                              <p className="text-xs text-amber-800 dark:text-amber-300">
                                Reason: {taxDetail.overrideReason}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <Badge tone="slate">Unclassified</Badge>
                        )}
                      </td>

                      {/* VAT Amount (VND) */}
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {taxDetail
                          ? formatFinancialDecimal(taxDetail.vatAmount)
                          : "-"}
                      </td>

                      {/* Total Incl. VAT (VND) */}
                      <td className="border-b border-border/60 px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">
                        {taxDetail
                          ? formatFinancialDecimal(
                              taxDetail.lineTotalIncludingVatVnd,
                            )
                          : formatFinancialDecimal(charge.amountVnd)}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* OPS Commercial Fields */}
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground">
                        {formatFinancialDecimal(charge.quantity)}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-muted-foreground">
                        {charge.unit ?? "-"}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground">
                        {formatFinancialDecimal(charge.unitPrice)}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-muted-foreground">
                        {charge.currency}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground">
                        {formatFinancialDecimal(charge.exchangeRate)}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground">
                        {formatFinancialDecimal(charge.amountOriginal)}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right font-medium text-foreground">
                        {formatFinancialDecimal(charge.amountVnd)}
                      </td>
                    </>
                  )}

                  {/* Vendor / Agent */}
                  <td className="border-b border-border/60 px-3 py-2 text-muted-foreground">
                    {charge.vendorOrAgentText ?? "-"}
                  </td>

                  {/* Unified Actions Cell */}
                  {(canReadTaxSummary ? showActionsColumn : canManageBuyingCharges) ? (
                    <td className="border-b border-border/60 px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-2">
                        {canManageBuyingCharges ? (
                          <div className="flex items-center justify-end gap-1.5 text-xs whitespace-nowrap">
                            <button
                              className="text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline"
                              type="button"
                              onClick={() => setEditingId(charge.id)}
                            >
                              Edit
                            </button>
                            <span className="text-border">|</span>
                            <DeleteBuyingChargeButton chargeId={charge.id} />
                          </div>
                        ) : null}

                        {effectiveCanMutateTax && taxDetail ? (
                          <div className="grid min-w-60 gap-2 text-left">
                            <AssignTaxRulePanel
                              charge={taxDetail}
                              rules={sectionRules}
                            />
                            {canOverride ? (
                              <OverrideVatPanel charge={taxDetail} />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
