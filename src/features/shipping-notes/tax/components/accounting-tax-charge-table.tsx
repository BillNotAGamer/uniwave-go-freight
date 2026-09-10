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
      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
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
      ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-900/60"
      : tone === "amber"
        ? "rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-900/60"
        : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700";

  return <span className={className}>{children}</span>;
}

function AssignTaxRulePanel({
  charge,
  rules,
}: {
  charge: ChargeTaxDetail;
  rules: TaxRuleDetail[];
}) {
  if (rules.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50">
        Chưa có Tax Rule khả dụng
      </div>
    );
  }

  return <AssignTaxRuleForm charge={charge} rules={rules} />;
}

function AssignTaxRuleForm({
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
    <details className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
      <summary className="cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
        {charge.taxComplete ? "Change tax rule" : "Assign tax rule"}
      </summary>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="chargeId" value={charge.chargeId} />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Tax rule
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
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
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <p>
              Charge: <span className="font-medium text-slate-900 dark:text-slate-100">{charge.chargeName}</span>
            </p>
            <p>
              Base excluding VAT: <span className="font-medium text-slate-900 dark:text-slate-100">{formatNumber(charge.amountVnd)}</span>
            </p>
            <p>
              Treatment: <span className="font-medium text-slate-900 dark:text-slate-100">{getTaxTreatmentLabel(selectedRule.taxTreatment)}</span>
            </p>
            <p>
              Applied VAT: <span className="font-medium text-slate-900 dark:text-slate-100">{selectedRule.vatPercent}%</span>
            </p>
            <p>
              Preview VAT amount: <span className="font-medium text-slate-900 dark:text-slate-100">{previewVat ? formatNumber(previewVat) : "-"}</span>
            </p>
            {charge.isOverride ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Reassigning a tax rule replaces the current override with the
                rule&apos;s configured percentage.
              </p>
            ) : null}
          </div>
        ) : null}

        {!state.ok ? (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
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
  const currentOverrideVal =
    charge.isOverride && charge.vatOverrideRate !== null
      ? String(Number(charge.vatOverrideRate))
      : charge.isOverride
        ? String(Number(charge.vatPercent))
        : "none";
  const [selectedVal, setSelectedVal] = useState(currentOverrideVal);

  return (
    <details className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
      <summary className="cursor-pointer text-xs font-medium text-amber-900 dark:text-amber-300">
        Override VAT
      </summary>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="chargeId" value={charge.chargeId} />
        <div className="rounded-md border border-amber-200 bg-white p-3 text-sm text-slate-700 dark:border-amber-900/50 dark:bg-slate-900 dark:text-slate-300">
          <p>Current rule: <span className="font-medium text-slate-900 dark:text-slate-100">{charge.taxRuleCodeSnapshot ?? "-"}</span></p>
          <p>Current applied percentage: <span className="font-medium text-slate-900 dark:text-slate-100">{charge.effectiveAccountingVatRate ? `${Number(charge.effectiveAccountingVatRate)}%` : `${Number(charge.vatPercent)}%`}</span></p>
          <p className="mt-2 text-amber-900 dark:text-amber-300">
            This changes the applied VAT percentage for this charge but
            preserves the selected tax-rule snapshot. The reason will be
            recorded in the audit log.
          </p>
        </div>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Override VAT percentage
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
            name="vatPercent"
            value={selectedVal}
            onChange={(e) => setSelectedVal(e.target.value)}
            required
          >
            <option value="none">Không override</option>
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="8">8%</option>
            <option value="10">10%</option>
          </select>
        </label>

        {selectedVal !== "none" ? (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Reason
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
              name="reason"
              defaultValue={charge.overrideReason ?? ""}
              placeholder="Nhập lý do override..."
              required
            />
          </label>
        ) : null}

        {!state.ok ? (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
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
      <div className="rounded-md border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        No active {section} charges require tax classification.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {!canMutateTax ? (
          <p className="text-sm text-muted-foreground">
            {status === "draft"
              ? "Tax classification is available after submission."
              : status === "checked"
                ? "Tax values are read-only because this note is checked."
                : "Tax values are read-only for this status."}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="border-b border-border px-3 py-2">Charge</th>
              <th className="border-b border-border px-3 py-2">Classification</th>
              <th className="border-b border-border px-3 py-2">Rule Snapshot</th>
              <th className="border-b border-border px-3 py-2 text-right">Excl. VAT</th>
              <th className="border-b border-border px-3 py-2 text-right">VAT %</th>
              <th className="border-b border-border px-3 py-2 text-right">VAT</th>
              <th className="border-b border-border px-3 py-2 text-right">Incl. VAT</th>
              <th className="border-b border-border px-3 py-2">State</th>
              {canMutateTax ? (
                <th className="border-b border-border px-3 py-2">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => {
              const badges = getChargeTaxBadges(charge);
              const canOverride = canOverrideChargeTax({ role, status, charge });

              return (
                <tr key={charge.chargeId} className="align-top hover:bg-muted/40">
                  <td className="border-b border-border/60 px-3 py-2 font-medium text-foreground">
                    <div>{charge.chargeName}</div>
                    {charge.catalogCodeSnapshot ? (
                      <div className="text-xs text-muted-foreground font-normal">
                        [{charge.catalogCodeSnapshot}]
                      </div>
                    ) : null}
                    <div className="mt-0.5 text-xs text-muted-foreground font-normal">
                      VAT danh mục: {charge.catalogVatRateSnapshot ? `${Number(charge.catalogVatRateSnapshot)}%` : "Chưa xác định"}
                    </div>
                  </td>
                  <td className="border-b border-border/60 px-3 py-2">
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
                  <td className="border-b border-border/60 px-3 py-2 text-slate-700 dark:text-slate-300">
                    <div className="max-w-56">
                      <p>{charge.taxRuleCodeSnapshot ?? "Unclassified"}</p>
                      <p className="text-xs text-muted-foreground">
                        {charge.taxRuleNameSnapshot ?? "-"}
                      </p>
                      {charge.overrideReason ? (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                          Reason: {charge.overrideReason}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b border-border/60 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {formatNumber(charge.amountVnd)}
                  </td>
                  <td className="border-b border-border/60 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {charge.effectiveAccountingVatRate ? `${Number(charge.effectiveAccountingVatRate)}%` : `${Number(charge.vatPercent)}%`}
                  </td>
                  <td className="border-b border-border/60 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {formatNumber(charge.vatAmount)}
                  </td>
                  <td className="border-b border-border/60 px-3 py-2 text-right font-medium text-foreground">
                    {formatNumber(charge.lineTotalIncludingVatVnd)}
                  </td>
                  <td className="border-b border-border/60 px-3 py-2">
                    <Badge tone={charge.taxComplete ? "emerald" : "slate"}>
                      {charge.taxComplete ? "Complete" : "Unclassified"}
                    </Badge>
                  </td>
                  {canMutateTax ? (
                    <td className="border-b border-border/60 px-3 py-2">
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
