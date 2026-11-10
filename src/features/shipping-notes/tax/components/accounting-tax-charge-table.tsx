"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";

import type {
  ChargeSection,
  InputVatInvoiceStatus,
  ShippingNoteStatus,
} from "../../constants";
import type { ChargeTaxDetail, ChargeTaxRuleOption } from "../types";
import {
  assignChargeTaxRuleAction,
  classifyChargeTaxManuallyAction,
  decideMissingInvoiceExceptionAction,
  overrideChargeVatPercentAction,
  requestMissingInvoiceExceptionAction,
  revokeMissingInvoiceExceptionAction,
  type ChargeTaxActionResult,
} from "../actions";
import { calculateVatAmount } from "../calculations";
import {
  canOverrideChargeTax,
  filterTaxRulesForChargeSection,
  formatTaxRuleOption,
  getTaxCapability,
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

function SubmitButton({ label, pendingLabel, disabled = false }: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
      type="submit"
      disabled={pending || disabled}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function InputVatEvidenceFields({
  charge,
  canFinalize,
}: {
  charge: ChargeTaxDetail;
  canFinalize: boolean;
}) {
  const [status, setStatus] = useState<InputVatInvoiceStatus | "">(
    charge.inputVatInvoiceStatus ?? "",
  );

  if (charge.section !== "buying") {
    return null;
  }

  return (
    <fieldset className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
        Input VAT invoice evidence
      </legend>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Invoice status
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          name="inputVatInvoiceStatus"
          value={status}
          onChange={(event) => setStatus(event.target.value as InputVatInvoiceStatus | "")}
          required
        >
          <option value="">Select status</option>
          <option value="available">Available</option>
          <option value="missing">Missing</option>
        </select>
      </label>
      {status === "available" ? (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Invoice reference
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            name="inputVatInvoiceReference"
            defaultValue={charge.inputVatInvoiceReference ?? ""}
            maxLength={200}
            required
          />
        </label>
      ) : null}
      {canFinalize ? (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Input VAT deductible
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            name="inputVatDeductible"
            defaultValue={
              charge.inputVatDeductible === null
                ? ""
                : String(charge.inputVatDeductible)
            }
            required
          >
            <option value="">Select decision</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">
          Accounting must confirm deduction eligibility before tax review is complete.
        </p>
      )}
      {status === "missing" ? (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          A missing invoice remains incomplete because no closure exception is configured.
        </p>
      ) : null}
    </fieldset>
  );
}

function formatEvidenceTimestamp(value: Date | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

export function MissingInvoiceExceptionPanel({
  charge,
  role,
  financialReviewRevision,
}: {
  charge: ChargeTaxDetail;
  role: Role;
  financialReviewRevision: string | null;
}) {
  const capability = getTaxCapability(role);
  const exception = charge.missingInvoiceException;

  if (
    charge.section !== "buying" ||
    charge.inputVatInvoiceStatus !== "missing" ||
    (!capability.canRequestMissingInvoiceException &&
      !capability.canDecideMissingInvoiceException)
  ) {
    return null;
  }

  return (
    <div className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/30">
      <div className="text-xs text-amber-950 dark:text-amber-200">
        <p className="font-semibold">Input invoice: Missing</p>
        <p>Input VAT deductible: No</p>
        <p>
          Closure exception: {exception
            ? exception.status === "approved"
              ? "Approved operational closure exception"
              : exception.status
            : "None"}
        </p>
        {exception ? (
          <div className="mt-2 grid gap-1 border-t border-amber-200 pt-2 dark:border-amber-900/60">
            <p>Requested by: {exception.requestedById}</p>
            <p>Requested at: {formatEvidenceTimestamp(exception.requestedAt)}</p>
            <p>Request reason: {exception.requestReason}</p>
            {exception.decisionById ? <p>Decided by: {exception.decisionById}</p> : null}
            {exception.decidedAt ? <p>Decided at: {formatEvidenceTimestamp(exception.decidedAt)}</p> : null}
            {exception.decisionReason ? <p>Decision reason: {exception.decisionReason}</p> : null}
            {exception.selfApproved ? <p className="font-semibold">Admin self-approval recorded</p> : null}
            {exception.invalidationReason ? <p>End reason: {exception.invalidationReason}</p> : null}
          </div>
        ) : null}
      </div>

      {(!exception || ["rejected", "revoked", "invalidated"].includes(exception.status)) &&
      capability.canRequestMissingInvoiceException ? (
        <MissingInvoiceExceptionRequestForm
          chargeId={charge.chargeId}
          financialReviewRevision={financialReviewRevision}
        />
      ) : null}

      {exception?.status === "pending" && capability.canDecideMissingInvoiceException ? (
        <MissingInvoiceExceptionDecisionForm
          exceptionId={exception.id}
          financialReviewRevision={financialReviewRevision}
        />
      ) : null}

      {exception?.status === "approved" && capability.canDecideMissingInvoiceException ? (
        <MissingInvoiceExceptionRevokeForm
          exceptionId={exception.id}
          financialReviewRevision={financialReviewRevision}
        />
      ) : null}
    </div>
  );
}

function MissingInvoiceExceptionRequestForm({
  chargeId,
  financialReviewRevision,
}: {
  chargeId: string;
  financialReviewRevision: string | null;
}) {
  const [state, formAction] = useActionState(
    requestMissingInvoiceExceptionAction,
    initialState,
  );
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="chargeId" value={chargeId} />
      <input type="hidden" name="expectedFinancialRevision" value={financialReviewRevision ?? ""} />
      <label className="text-xs font-medium">
        Mandatory business justification
        <textarea className="mt-1 min-h-20 w-full rounded-md border bg-white px-2 py-1.5 dark:bg-slate-950" name="reason" maxLength={500} required />
      </label>
      {!state.ok ? <p className="text-xs text-red-700" role="alert">{state.error}</p> : null}
      <SubmitButton label="Request closure exception" pendingLabel="Requesting..." disabled={!financialReviewRevision} />
    </form>
  );
}

function MissingInvoiceExceptionDecisionForm({
  exceptionId,
  financialReviewRevision,
}: {
  exceptionId: string;
  financialReviewRevision: string | null;
}) {
  const [state, formAction] = useActionState(
    decideMissingInvoiceExceptionAction,
    initialState,
  );
  return (
    <form action={formAction} className="grid gap-2 border-t border-amber-200 pt-2 dark:border-amber-900/60">
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <input type="hidden" name="expectedFinancialRevision" value={financialReviewRevision ?? ""} />
      <label className="text-xs font-medium">
        Admin decision
        <select className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 dark:bg-slate-950" name="decision" required>
          <option value="approved">Approve</option>
          <option value="rejected">Reject</option>
        </select>
      </label>
      <label className="text-xs font-medium">
        Decision reason
        <textarea className="mt-1 min-h-20 w-full rounded-md border bg-white px-2 py-1.5 dark:bg-slate-950" name="reason" maxLength={500} required />
      </label>
      {!state.ok ? <p className="text-xs text-red-700" role="alert">{state.error}</p> : null}
      <SubmitButton label="Record Admin decision" pendingLabel="Saving..." disabled={!financialReviewRevision} />
    </form>
  );
}

function MissingInvoiceExceptionRevokeForm({
  exceptionId,
  financialReviewRevision,
}: {
  exceptionId: string;
  financialReviewRevision: string | null;
}) {
  const [state, formAction] = useActionState(
    revokeMissingInvoiceExceptionAction,
    initialState,
  );
  return (
    <form action={formAction} className="grid gap-2 border-t border-amber-200 pt-2 dark:border-amber-900/60">
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <input type="hidden" name="expectedFinancialRevision" value={financialReviewRevision ?? ""} />
      <label className="text-xs font-medium">
        Revocation reason
        <textarea className="mt-1 min-h-20 w-full rounded-md border bg-white px-2 py-1.5 dark:bg-slate-950" name="reason" maxLength={500} required />
      </label>
      {!state.ok ? <p className="text-xs text-red-700" role="alert">{state.error}</p> : null}
      <SubmitButton label="Revoke exception" pendingLabel="Revoking..." disabled={!financialReviewRevision} />
    </form>
  );
}

export function ManualTaxDecisionPanel({
  charge,
  role,
  financialReviewRevision,
}: {
  charge: ChargeTaxDetail;
  role: Role;
  financialReviewRevision: string | null;
}) {
  if (!getTaxCapability(role).canClassifyManually) {
    return null;
  }

  return (
    <ManualTaxDecisionForm
      charge={charge}
      financialReviewRevision={financialReviewRevision}
    />
  );
}

function ManualTaxDecisionForm({
  charge,
  financialReviewRevision,
}: {
  charge: ChargeTaxDetail;
  financialReviewRevision: string | null;
}) {
  const [state, formAction] = useActionState(
    classifyChargeTaxManuallyAction,
    initialState,
  );
  const [treatment, setTreatment] = useState("taxable");

  return (
    <details className="rounded-md border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/30">
      <summary className="cursor-pointer text-xs font-medium text-indigo-900 dark:text-indigo-300">
        Record manual tax decision
      </summary>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="chargeId" value={charge.chargeId} />
        <input
          type="hidden"
          name="expectedFinancialRevision"
          value={financialReviewRevision ?? ""}
        />
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Tax treatment
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            name="taxTreatment"
            value={treatment}
            onChange={(event) => setTreatment(event.target.value)}
            required
          >
            <option value="taxable">Taxable</option>
            <option value="zero_rated">Zero-rated</option>
            <option value="non_taxable">Non-taxable</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          VAT rate
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            name="vatPercent"
            defaultValue={treatment === "taxable" ? "8" : "0"}
            key={treatment}
            required
          >
            {treatment === "taxable" ? (
              <>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="8">8%</option>
                <option value="10">10%</option>
              </>
            ) : (
              <option value="0">0%</option>
            )}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Business justification
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            name="reason"
            maxLength={500}
            required
          />
        </label>
        <InputVatEvidenceFields charge={charge} canFinalize />
        {!financialReviewRevision ? (
          <p className="text-sm text-amber-800 dark:text-amber-300" role="alert">
            Refresh the shipping note before recording a manual decision.
          </p>
        ) : null}
        {!state.ok ? (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            {state.error}
          </p>
        ) : null}
        <SubmitButton
          label="Save manual decision"
          pendingLabel="Saving..."
          disabled={!financialReviewRevision}
        />
      </form>
    </details>
  );
}

export function Badge({ children, tone = "slate" }: {
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

export function AssignTaxRulePanel({
  charge,
  rules,
  role,
}: {
  charge: ChargeTaxDetail;
  rules: ChargeTaxRuleOption[];
  role: Role;
}) {
  if (rules.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50">
        No applicable Tax Rules available
      </div>
    );
  }

  return <AssignTaxRuleForm charge={charge} rules={rules} role={role} />;
}

function AssignTaxRuleForm({
  charge,
  rules,
  role,
}: {
  charge: ChargeTaxDetail;
  rules: ChargeTaxRuleOption[];
  role: Role;
}) {
  const [selectedRuleId, setSelectedRuleId] = useState(rules[0]?.id ?? "");
  const [state, formAction] = useActionState(
    assignChargeTaxRuleAction,
    initialState,
  );
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);
  const canFinalizeInputVatEvidence = getTaxCapability(role).canClassifyManually;
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

        <InputVatEvidenceFields
          charge={charge}
          canFinalize={canFinalizeInputVatEvidence}
        />

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

export function OverrideVatPanel({ charge }: { charge: ChargeTaxDetail }) {
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
            <option value="none">No override</option>
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
              placeholder="Enter override reason..."
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
  activeTaxRules: ChargeTaxRuleOption[];
  canMutateTax: boolean;
  financialReviewRevision: string | null;
};

export function AccountingTaxChargeTable({
  title,
  section,
  status,
  role,
  charges,
  activeTaxRules,
  canMutateTax,
  financialReviewRevision,
}: AccountingTaxChargeTableProps) {
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
              const applicableRules = filterTaxRulesForChargeSection(
                activeTaxRules,
                section,
                charge.chargeId,
              );

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
                      Catalog VAT: {charge.catalogVatRateSnapshot ? `${Number(charge.catalogVatRateSnapshot)}%` : "Unspecified"}
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
                      <p>
                        {charge.taxDecisionSource === "manual"
                          ? "Manual Accounting decision"
                          : charge.taxRuleCodeSnapshot ?? "Unclassified"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {charge.taxRuleNameSnapshot ?? "-"}
                      </p>
                      {charge.overrideReason ? (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                          Reason: {charge.overrideReason}
                        </p>
                      ) : null}
                      {charge.taxDecisionReason ? (
                        <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-300">
                          Decision reason: {charge.taxDecisionReason}
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
                      {charge.taxComplete ? "Complete" : "Review required"}
                    </Badge>
                    {!charge.taxComplete && charge.incompleteReason ? (
                      <p className="mt-2 max-w-60 text-xs text-amber-800 dark:text-amber-300">
                        {charge.incompleteReason}
                      </p>
                    ) : null}
                  </td>
                  {canMutateTax ? (
                    <td className="border-b border-border/60 px-3 py-2">
                      <div className="grid min-w-60 gap-2">
                        <AssignTaxRulePanel charge={charge} rules={applicableRules} role={role} />
                        <ManualTaxDecisionPanel
                          charge={charge}
                          role={role}
                          financialReviewRevision={financialReviewRevision}
                        />
                        <MissingInvoiceExceptionPanel
                          charge={charge}
                          role={role}
                          financialReviewRevision={financialReviewRevision}
                        />
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
