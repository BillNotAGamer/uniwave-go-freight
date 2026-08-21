"use client";

import { useMemo, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";

import type {
  ChargeSection,
  ShippingNoteStatus,
} from "../../constants";
import type { ChargeTaxDetail } from "../types";
import type { TaxRuleDetail } from "@/features/tax-rules/types";
import {
  assignChargeTaxRuleAction,
  overrideChargeVatPercentAction,
  type ChargeTaxActionResult,
} from "../actions";
import { calculateVatAmount } from "../calculations";
import {
  canOverrideChargeTax,
  filterTaxRulesForChargeSection,
  formatTaxRuleOption,
  getChargeTaxBadges,
  getTaxTreatmentLabel,
} from "../ui-policy";
import type { Role } from "@/lib/permissions/roles";

const initialState: ChargeTaxActionResult = { ok: true };

function formatNumber(value: string): string {
  const match = value.match(/^(-?)(\d+)(?:\.(\d+))?$/);

  if (!match) {
    return value;
  }

  const [, sign, integerPart, fractionalPart = ""] = match;
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formattedFraction = fractionalPart.padEnd(2, "0").slice(0, 2);

  return `${sign}${formattedInteger}.${formattedFraction}`;
}

function SubmitButton({ label, pendingLabel }: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      type="submit"
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Badge({ children, tone = "slate" }: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber";
}) {
  const className =
    tone === "emerald"
      ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
      : tone === "amber"
        ? "rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
        : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700";

  return <span className={className}>{children}</span>;
}

function AssignTaxRulePanel({
  charge,
  rules,
}: {
  charge: ChargeTaxDetail;
  rules: TaxRuleDetail[];
}) {
  const [selectedRuleId, setSelectedRuleId] = useState(rules[0]?.id ?? "");
  const [state, formAction] = useActionState(
    assignChargeTaxRuleAction,
    initialState,
  );
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);
  const previewVat = selectedRule
    ? calculateVatAmount({
      amountVnd: charge.amountVnd,
      vatPercent: selectedRule.vatPercent,
      treatment: selectedRule.taxTreatment,
    })
    : null;

  return (
    <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-700">
        {charge.taxComplete ? "Change tax rule" : "Assign tax rule"}
      </summary>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="chargeId" value={charge.chargeId} />

        <label className="block text-sm font-medium text-slate-700">
          Tax rule
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="taxRuleId"
            value={selectedRuleId}
            onChange={(event) => setSelectedRuleId(event.target.value)}
            required
          >
            {rules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {formatTaxRuleOption(rule)}
              </option>
            ))}
          </select>
        </label>

        {selectedRule ? (
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <p>
              Charge: <span className="font-medium text-slate-900">{charge.chargeName}</span>
            </p>
            <p>
              Base excluding VAT: <span className="font-medium text-slate-900">{formatNumber(charge.amountVnd)}</span>
            </p>
            <p>
              Treatment: <span className="font-medium text-slate-900">{getTaxTreatmentLabel(selectedRule.taxTreatment)}</span>
            </p>
            <p>
              Applied VAT: <span className="font-medium text-slate-900">{selectedRule.vatPercent}%</span>
            </p>
            <p>
              Preview VAT amount: <span className="font-medium text-slate-900">{previewVat ? formatNumber(previewVat) : "-"}</span>
            </p>
            {charge.isOverride ? (
              <p className="mt-2 text-xs text-slate-500">
                Reassigning a tax rule replaces the current override with the
                rule&apos;s configured percentage.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-amber-800">
            No active rules are available for this charge section.
          </p>
        )}

        {!state.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}

        <SubmitButton label="Apply rule" pendingLabel="Applying..." />
      </form>
    </details>
  );
}

function OverrideVatPanel({ charge }: { charge: ChargeTaxDetail }) {
  const [state, formAction] = useActionState(
    overrideChargeVatPercentAction,
    initialState,
  );

  return (
    <details className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <summary className="cursor-pointer text-xs font-medium text-amber-900">
        Override VAT
      </summary>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="chargeId" value={charge.chargeId} />
        <div className="rounded-md border border-amber-200 bg-white p-3 text-sm text-slate-700">
          <p>Current rule: <span className="font-medium text-slate-900">{charge.taxRuleCodeSnapshot ?? "-"}</span></p>
          <p>Current applied percentage: <span className="font-medium text-slate-900">{charge.vatPercent}%</span></p>
          <p className="mt-2 text-amber-900">
            This changes the applied VAT percentage for this charge but
            preserves the selected tax-rule snapshot. The reason will be
            recorded in the audit log.
          </p>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Override VAT percentage
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="vatPercent"
            type="number"
            min="0"
            step="0.01"
            defaultValue={charge.vatPercent}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Reason
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="reason"
            defaultValue={charge.overrideReason ?? ""}
            required
          />
        </label>

        {!state.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}

        <SubmitButton label="Save override" pendingLabel="Saving..." />
      </form>
    </details>
  );
}

type AccountingTaxChargeTableProps = {
  title: string;
  section: ChargeSection;
  status: ShippingNoteStatus;
  role: Role;
  charges: ChargeTaxDetail[];
  activeTaxRules: TaxRuleDetail[];
  canMutateTax: boolean;
};

export function AccountingTaxChargeTable({
  title,
  section,
  status,
  role,
  charges,
  activeTaxRules,
  canMutateTax,
}: AccountingTaxChargeTableProps) {
  const sectionRules = useMemo(
    () => filterTaxRulesForChargeSection(activeTaxRules, section),
    [activeTaxRules, section],
  );

  if (charges.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
        No active {section} charges require tax classification.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {!canMutateTax ? (
          <p className="text-sm text-slate-600">
            {status === "draft"
              ? "Tax classification is available after submission."
              : status === "checked"
                ? "Tax values are read-only because this note is checked."
                : "Tax values are read-only for this status."}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
              <th className="border-b border-slate-200 px-3 py-2">Charge</th>
              <th className="border-b border-slate-200 px-3 py-2">Classification</th>
              <th className="border-b border-slate-200 px-3 py-2">Rule Snapshot</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Excl. VAT</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">VAT %</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">VAT</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Incl. VAT</th>
              <th className="border-b border-slate-200 px-3 py-2">State</th>
              {canMutateTax ? (
                <th className="border-b border-slate-200 px-3 py-2">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => {
              const badges = getChargeTaxBadges(charge);
              const canOverride = canOverrideChargeTax({ role, status, charge });

              return (
                <tr key={charge.chargeId} className="align-top">
                  <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                    {charge.chargeName}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {badges.map((badge) => (
                        <Badge
                          key={badge}
                          tone={badge === "Override" ? "amber" : charge.taxComplete ? "emerald" : "slate"}
                        >
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    <div className="max-w-56">
                      <p>{charge.taxRuleCodeSnapshot ?? "Unclassified"}</p>
                      <p className="text-xs text-slate-500">
                        {charge.taxRuleNameSnapshot ?? "-"}
                      </p>
                      {charge.overrideReason ? (
                        <p className="mt-1 text-xs text-amber-800">
                          Reason: {charge.overrideReason}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                    {formatNumber(charge.amountVnd)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                    {charge.vatPercent}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                    {formatNumber(charge.vatAmount)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-900">
                    {formatNumber(charge.lineTotalIncludingVatVnd)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <Badge tone={charge.taxComplete ? "emerald" : "slate"}>
                      {charge.taxComplete ? "Complete" : "Unclassified"}
                    </Badge>
                  </td>
                  {canMutateTax ? (
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="grid min-w-60 gap-2">
                        <AssignTaxRulePanel charge={charge} rules={sectionRules} />
                        {canOverride ? <OverrideVatPanel charge={charge} /> : null}
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
