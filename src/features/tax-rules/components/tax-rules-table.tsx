"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  CHARGE_SECTIONS,
  SHIPPING_MODES,
  TAX_TREATMENTS,
  type TaxTreatment,
} from "@/features/shipping-notes/constants";
import {
  getTaxRuleDeactivateConfirmationText,
  getTaxTreatmentLabel,
} from "@/features/shipping-notes/tax/ui-policy";

import {
  createTaxRuleAction,
  deactivateTaxRuleAction,
  updateTaxRuleAction,
  type TaxRuleActionResult,
} from "../actions";
import type { TaxRuleDetail } from "../types";

const initialState: TaxRuleActionResult = { ok: true };

function formatDate(value: Date | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function formatDateTime(value: Date): string {
  return new Date(value).toLocaleString();
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

type TaxRuleFormProps = {
  mode: "create" | "edit";
  rule?: TaxRuleDetail;
  onCancel: () => void;
};

function TaxRuleForm({ mode, rule, onCancel }: TaxRuleFormProps) {
  const [treatment, setTreatment] = useState<TaxTreatment>(
    rule?.taxTreatment ?? "taxable",
  );
  const [state, formAction] = useActionState(
    mode === "create" ? createTaxRuleAction : updateTaxRuleAction,
    initialState,
  );
  const vatLocked = treatment === "zero_rated" || treatment === "non_taxable";

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
      {vatLocked ? <input type="hidden" name="vatPercent" value="0" /> : null}

      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">
          {mode === "create" ? "Create Tax Rule" : `Edit ${rule?.code}`}
        </h2>
        <p className="text-sm text-slate-600">
          Rule definitions are used only for new assignments. Existing charge
          snapshots remain unchanged.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-medium text-slate-700">
          Code
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="code"
            type="text"
            defaultValue={rule?.code ?? ""}
            maxLength={40}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="name"
            type="text"
            defaultValue={rule?.name ?? ""}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Treatment
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="taxTreatment"
            value={treatment}
            onChange={(event) => setTreatment(event.target.value as TaxTreatment)}
            required
          >
            {TAX_TREATMENTS.map((value) => (
              <option key={value} value={value}>
                {getTaxTreatmentLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          VAT percentage
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
            name="vatPercent"
            type="number"
            min="0"
            step="0.01"
            defaultValue={vatLocked ? "0" : rule?.vatPercent ?? "0"}
            disabled={vatLocked}
            aria-describedby="vat-percent-help"
            required={!vatLocked}
          />
          <span id="vat-percent-help" className="mt-1 block text-xs text-slate-500">
            Zero-rated and non-taxable rules use 0%.
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Charge section
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="chargeSection"
            defaultValue={rule?.chargeSection ?? "selling"}
            required
          >
            {CHARGE_SECTIONS.map((section) => (
              <option key={section} value={section}>
                {section === "selling" ? "Selling" : "Buying"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Shipping mode
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="shippingMode"
            defaultValue={rule?.shippingMode ?? "sea_export"}
            required
          >
            {SHIPPING_MODES.map((modeValue) => (
              <option key={modeValue} value={modeValue}>
                {modeValue}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Effective from
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="effectiveFrom"
            type="date"
            defaultValue={rule?.effectiveFrom?.toISOString().slice(0, 10) ?? ""}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Effective to
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            name="effectiveTo"
            type="date"
            defaultValue={rule?.effectiveTo?.toISOString().slice(0, 10) ?? ""}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Charge name pattern
        <input
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          name="chargeNamePattern"
          type="text"
          defaultValue={rule?.chargeNamePattern ?? "*"}
          required
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Description
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          name="description"
          defaultValue={rule?.description ?? ""}
        />
      </label>

      {!state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton
          label={mode === "create" ? "Create rule" : "Save rule"}
          pendingLabel={mode === "create" ? "Creating..." : "Saving..."}
        />
        <button
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeactivateTaxRuleForm({ rule }: { rule: TaxRuleDetail }) {
  const [state, formAction] = useActionState(
    deactivateTaxRuleAction,
    initialState,
  );

  return (
    <details className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <summary className="cursor-pointer text-sm font-medium text-amber-900">
        Deactivate
      </summary>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="id" value={rule.id} />
        <p className="text-sm text-amber-900">
          {getTaxRuleDeactivateConfirmationText()}
        </p>
        {!state.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
        <SubmitButton label="Confirm deactivate" pendingLabel="Deactivating..." />
      </form>
    </details>
  );
}

type TaxRulesTableProps = {
  rules: TaxRuleDetail[];
  canManage: boolean;
};

export function TaxRulesTable({ rules, canManage }: TaxRulesTableProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {canManage
            ? "Admin view includes active and inactive tax rules."
            : "Read-only view. Only active tax rules are shown."}
        </p>
        {canManage ? (
          <button
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            type="button"
            onClick={() => setShowCreate((value) => !value)}
          >
            {showCreate ? "Close form" : "Create tax rule"}
          </button>
        ) : null}
      </div>

      {showCreate ? (
        <TaxRuleForm mode="create" onCancel={() => setShowCreate(false)} />
      ) : null}

      {rules.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No tax rules are available for this view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2">Code</th>
                <th className="border-b border-slate-200 px-3 py-2">Name</th>
                <th className="border-b border-slate-200 px-3 py-2">Treatment</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">VAT %</th>
                <th className="border-b border-slate-200 px-3 py-2">Section</th>
                <th className="border-b border-slate-200 px-3 py-2">Mode</th>
                <th className="border-b border-slate-200 px-3 py-2">Effective</th>
                <th className="border-b border-slate-200 px-3 py-2">Active</th>
                <th className="border-b border-slate-200 px-3 py-2">Updated</th>
                {canManage ? (
                  <th className="border-b border-slate-200 px-3 py-2">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                editingId === rule.id ? (
                  <tr key={rule.id} className="bg-slate-50">
                    <td colSpan={canManage ? 10 : 9} className="border-b border-slate-200 p-3">
                      <TaxRuleForm
                        mode="edit"
                        rule={rule}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={rule.id} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                      {rule.code}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      <div className="max-w-72">
                        <p className="font-medium text-slate-900">{rule.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {rule.description ?? "-"}
                        </p>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {getTaxTreatmentLabel(rule.taxTreatment)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                      {rule.vatPercent}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {rule.chargeSection}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {rule.shippingMode}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {formatDate(rule.effectiveFrom)} to {formatDate(rule.effectiveTo)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <span className={
                        rule.isActive
                          ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                      }>
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {formatDateTime(rule.updatedAt)}
                    </td>
                    {canManage ? (
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="flex min-w-36 flex-col gap-2">
                          <button
                            className="w-fit text-xs text-slate-700 underline-offset-4 hover:underline"
                            type="button"
                            onClick={() => setEditingId(rule.id)}
                          >
                            Edit
                          </button>
                          {rule.isActive ? <DeactivateTaxRuleForm rule={rule} /> : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
