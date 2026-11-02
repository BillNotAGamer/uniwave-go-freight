"use client";

import React, { Fragment, useMemo, useState } from "react";

import type { Role } from "@/lib/permissions/roles";
import { addDecimalStrings } from "@/lib/calculations/decimal";
import { summarizeBuyingCharges } from "@/lib/calculations/shipping-note";
import type { ShippingNoteStatus } from "../constants";
import { formatFinancialDecimal } from "../presentation";
import type { BuyingChargeDetail } from "../types";
import type { ChargeTaxDetail } from "../tax/types";
import type { TaxRuleDetail } from "@/features/tax-rules/types";
import {
  canOverrideChargeTax,
  filterTaxRulesForChargeSection,
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

export type UnifiedBuyingWorkspaceProps = {
  charges: BuyingChargeDetail[];
  canManageBuyingCharges: boolean;
  canReadTaxSummary: boolean;
  canMutateTax: boolean;
  taxDetails: ChargeTaxDetail[];
  activeTaxRules: TaxRuleDetail[];
  status: ShippingNoteStatus;
  role: Role;
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
}: UnifiedBuyingWorkspaceProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTaxPanelId, setActiveTaxPanelId] = useState<string | null>(null);
  const [activeOverrideId, setActiveOverrideId] = useState<string | null>(null);

  const sectionRules = useMemo(
    () => filterTaxRulesForChargeSection(activeTaxRules, "buying"),
    [activeTaxRules],
  );

  if (charges.length === 0) {
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Buying Charges</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No buying charges yet.
        </p>
      </div>
    );
  }

  const summary = summarizeBuyingCharges(charges);

  // Compute aggregated tax totals only when authorized
  const totalVatVnd = canReadTaxSummary
    ? charges.reduce((acc, charge) => {
        const tax = taxDetails.find((t) => t.chargeId === charge.id);
        return tax ? addDecimalStrings([acc, tax.vatAmount], 2) : acc;
      }, "0.00")
    : null;

  const totalInclVatVnd =
    canReadTaxSummary && totalVatVnd !== null
      ? addDecimalStrings([summary.totalVnd, totalVatVnd], 2)
      : null;

  const completeTaxCount = canReadTaxSummary
    ? charges.filter(
        (c) => taxDetails.find((t) => t.chargeId === c.id)?.taxComplete,
      ).length
    : 0;

  return (
    <div className="grid gap-3" data-testid="unified-buying-workspace">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
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
        </div>

        {canReadTaxSummary ? (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Subtotal:{" "}
              <strong className="text-foreground font-semibold">
                {formatFinancialDecimal(summary.totalVnd)} VND
              </strong>
            </span>
            <span className="text-muted-foreground">
              VAT:{" "}
              <strong className="text-foreground font-semibold">
                {formatFinancialDecimal(totalVatVnd ?? "0.00")} VND
              </strong>
            </span>
            <span className="text-muted-foreground">
              Total:{" "}
              <strong className="text-foreground font-semibold">
                {formatFinancialDecimal(totalInclVatVnd ?? summary.totalVnd)} VND
              </strong>
            </span>
            <Badge tone={completeTaxCount === charges.length ? "emerald" : "amber"}>
              {completeTaxCount}/{charges.length} tax-classified
            </Badge>
          </div>
        ) : (
          <p className="text-sm font-medium text-foreground">
            Buying subtotal: {formatFinancialDecimal(summary.totalVnd)} VND
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            {canReadTaxSummary ? (
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="border-b border-border px-3 py-2.5">Charge</th>
                <th className="border-b border-border px-3 py-2.5">Description</th>
                <th className="border-b border-border px-3 py-2.5 text-right">Qty / Unit</th>
                <th className="border-b border-border px-3 py-2.5 text-right">Unit Price</th>
                <th className="border-b border-border px-3 py-2.5 text-right">Excl. VAT</th>
                <th className="border-b border-border px-3 py-2.5">Tax Rule</th>
                <th className="border-b border-border px-3 py-2.5 text-right">VAT</th>
                <th className="border-b border-border px-3 py-2.5 text-right">Incl. VAT</th>
                <th className="border-b border-border px-3 py-2.5">Vendor / Agent</th>
                <th className="border-b border-border px-3 py-2.5 text-right">Actions</th>
              </tr>
            ) : (
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="border-b border-border px-3 py-2">Charge</th>
                <th className="border-b border-border px-3 py-2">Description</th>
                <th className="border-b border-border px-3 py-2 text-right">Qty</th>
                <th className="border-b border-border px-3 py-2">Unit</th>
                <th className="border-b border-border px-3 py-2 text-right">Unit Price</th>
                <th className="border-b border-border px-3 py-2">Curr</th>
                <th className="border-b border-border px-3 py-2 text-right">Rate</th>
                <th className="border-b border-border px-3 py-2 text-right">Amount</th>
                <th className="border-b border-border px-3 py-2 text-right">VND</th>
                <th className="border-b border-border px-3 py-2">Vendor / Agent</th>
                {canManageBuyingCharges ? (
                  <th className="border-b border-border px-3 py-2 text-right">Actions</th>
                ) : null}
              </tr>
            )}
          </thead>
          <tbody>
            {charges.map((charge) => {
              const isEditing = editingId === charge.id;
              if (isEditing) {
                return (
                  <EditBuyingChargeRow
                    key={charge.id}
                    charge={charge}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }

              const taxDetail = canReadTaxSummary
                ? taxDetails.find((t) => t.chargeId === charge.id)
                : null;

              const isTaxOpen = activeTaxPanelId === charge.id;
              const isOverrideOpen = activeOverrideId === charge.id;
              const canOverride =
                taxDetail &&
                canOverrideChargeTax({ role, status, charge: taxDetail });

              return (
                <React.Fragment key={charge.id}>
                  <tr className="align-top hover:bg-muted/40 transition-colors">
                    {/* Charge Name & Catalog Snapshot */}
                    <td className="border-b border-border/60 px-3 py-2 font-medium text-foreground">
                      <div>{charge.catalogNameSnapshot ?? charge.chargeName}</div>
                      {charge.catalogCodeSnapshot ? (
                        <div className="text-xs text-muted-foreground font-normal">
                          [{charge.catalogCodeSnapshot}]
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

                        {/* Tax Rule Snapshot & Treatment */}
                        <td className="border-b border-border/60 px-3 py-2">
                          {taxDetail?.taxRuleCodeSnapshot ? (
                            <div className="max-w-44">
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
                                {getTaxTreatmentLabel(
                                  taxDetail.taxTreatmentSnapshot,
                                )}
                              </div>
                              {taxDetail.isOverride ? (
                                <div className="mt-0.5">
                                  <Badge tone="amber">Override</Badge>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <Badge tone="slate">Unclassified</Badge>
                          )}
                        </td>

                        {/* VAT Amount */}
                        <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                          {taxDetail
                            ? formatFinancialDecimal(taxDetail.vatAmount)
                            : "-"}
                        </td>

                        {/* Total Incl. VAT */}
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
                    <td className="border-b border-border/60 px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 text-xs">
                        {canManageBuyingCharges ? (
                          <>
                            <button
                              className="text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline"
                              type="button"
                              onClick={() => {
                                setEditingId(charge.id);
                                setActiveTaxPanelId(null);
                                setActiveOverrideId(null);
                              }}
                            >
                              Edit
                            </button>
                            <span className="text-border">|</span>
                            <DeleteBuyingChargeButton chargeId={charge.id} />
                          </>
                        ) : null}

                        {canReadTaxSummary && canMutateTax && taxDetail ? (
                          <>
                            {canManageBuyingCharges ? (
                              <span className="text-border">|</span>
                            ) : null}
                            <button
                              className="text-slate-700 dark:text-slate-300 underline-offset-4 hover:underline"
                              type="button"
                              onClick={() => {
                                setActiveTaxPanelId(
                                  isTaxOpen ? null : charge.id,
                                );
                                setActiveOverrideId(null);
                              }}
                            >
                              {isTaxOpen
                                ? "Close Tax"
                                : taxDetail.taxComplete
                                  ? "Change Rule"
                                  : "Assign Rule"}
                            </button>

                            {canOverride ? (
                              <>
                                <span className="text-border">|</span>
                                <button
                                  className="text-amber-700 dark:text-amber-400 underline-offset-4 hover:underline"
                                  type="button"
                                  onClick={() => {
                                    setActiveOverrideId(
                                      isOverrideOpen ? null : charge.id,
                                    );
                                    setActiveTaxPanelId(null);
                                  }}
                                >
                                  {isOverrideOpen ? "Close Override" : "Override"}
                                </button>
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Tax Assignment Panel */}
                  {isTaxOpen && taxDetail ? (
                    <tr className="bg-slate-50/80 dark:bg-slate-900/50">
                      <td
                        colSpan={canReadTaxSummary ? 10 : 11}
                        className="border-b border-border p-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="w-full max-w-xl">
                            <AssignTaxRulePanel
                              charge={taxDetail}
                              rules={sectionRules}
                            />
                          </div>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            type="button"
                            onClick={() => setActiveTaxPanelId(null)}
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}

                  {/* Expandable VAT Override Panel */}
                  {isOverrideOpen && taxDetail ? (
                    <tr className="bg-amber-50/60 dark:bg-amber-950/30">
                      <td
                        colSpan={canReadTaxSummary ? 10 : 11}
                        className="border-b border-border p-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="w-full max-w-xl">
                            <OverrideVatPanel charge={taxDetail} />
                          </div>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            type="button"
                            onClick={() => setActiveOverrideId(null)}
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
