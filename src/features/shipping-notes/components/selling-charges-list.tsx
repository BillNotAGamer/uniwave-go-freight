"use client";

import { useState, useActionState } from "react";

import type { ShippingNoteActionResult } from "../actions";
import {
  softDeleteSellingChargeAction,
  updateSellingChargeAction,
} from "../actions";
import { CURRENCY_CODES } from "../constants";
import type { SellingChargeDetail } from "../types";

function formatNumber(value: string): string {
  const num = Number(value);
  return Number.isNaN(num) ? value : num.toLocaleString();
}

const actionInitialState: ShippingNoteActionResult = { ok: true };

// ---------------------------------------------------------------------------
// Delete button
// ---------------------------------------------------------------------------

type DeleteChargeButtonProps = {
  chargeId: string;
  shippingNoteId: string;
};

function DeleteChargeButton({ chargeId, shippingNoteId }: DeleteChargeButtonProps) {
  const [state, formAction] = useActionState(softDeleteSellingChargeAction, actionInitialState);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={chargeId} />
      <input type="hidden" name="shippingNoteId" value={shippingNoteId} />
      <button
        className="text-xs text-red-600 underline-offset-4 hover:underline"
        type="submit"
      >
        Delete
      </button>
      {!state.ok ? (
        <span className="ml-2 text-xs text-red-700">{state.error}</span>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline edit form (shown per-row when user clicks Edit)
// ---------------------------------------------------------------------------

type EditChargeRowProps = {
  charge: SellingChargeDetail;
  shippingNoteId: string;
  onCancel: () => void;
};

function EditChargeRow({ charge, shippingNoteId, onCancel }: EditChargeRowProps) {
  const [state, formAction] = useActionState(updateSellingChargeAction, actionInitialState);

  return (
    <tr className="bg-slate-50">
      <td colSpan={10} className="border-b border-slate-200 px-3 py-3">
        <form action={formAction} className="grid gap-3">
          {/* Stable identifiers — verified server-side, not trusted for auth */}
          <input type="hidden" name="id" value={charge.id} />
          <input type="hidden" name="shippingNoteId" value={shippingNoteId} />

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Edit Charge
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium text-slate-700">
              Charge Name
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                name="chargeName"
                type="text"
                defaultValue={charge.chargeName}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Description
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                name="description"
                type="text"
                defaultValue={charge.description ?? ""}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Quantity
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                defaultValue={charge.quantity}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Unit
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                name="unit"
                type="text"
                defaultValue={charge.unit ?? ""}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Unit Price
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                name="unitPrice"
                type="number"
                min="0"
                step="0.0001"
                defaultValue={charge.unitPrice}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Currency
              <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                name="currency"
                defaultValue={charge.currency}
                required
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Exchange Rate
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                name="exchangeRate"
                type="number"
                min="0.000001"
                step="0.000001"
                defaultValue={charge.exchangeRate}
              />
            </label>
          </div>

          {!state.ok ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
              type="submit"
            >
              Save
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main list component
// ---------------------------------------------------------------------------

type SellingChargesListProps = {
  charges: SellingChargeDetail[];
  shippingNoteId: string;
  canMutate: boolean;
};

export function SellingChargesList({
  charges,
  shippingNoteId,
  canMutate,
}: SellingChargesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (charges.length === 0) {
    return <p className="text-sm text-slate-500">No selling charges yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
            <th className="border-b border-slate-200 px-3 py-2">Charge</th>
            <th className="border-b border-slate-200 px-3 py-2">Description</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">Qty</th>
            <th className="border-b border-slate-200 px-3 py-2">Unit</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">Unit Price</th>
            <th className="border-b border-slate-200 px-3 py-2">Curr</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">Rate</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">Amount</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">VND</th>
            {canMutate ? (
              <th className="border-b border-slate-200 px-3 py-2" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {charges.map((charge) => {
            const isEditing = editingId === charge.id;

            if (isEditing) {
              return (
                <EditChargeRow
                  key={charge.id}
                  charge={charge}
                  shippingNoteId={shippingNoteId}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            return (
              <tr key={charge.id} className="align-top">
                <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                  {charge.chargeName}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                  {charge.description ?? "-"}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatNumber(charge.quantity)}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                  {charge.unit ?? "-"}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatNumber(charge.unitPrice)}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                  {charge.currency}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatNumber(charge.exchangeRate)}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatNumber(charge.amountOriginal)}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-right font-medium text-slate-900">
                  {formatNumber(charge.amountVnd)}
                </td>
                {canMutate ? (
                  <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap">
                    <button
                      className="text-xs text-slate-600 underline-offset-4 hover:underline"
                      type="button"
                      onClick={() => setEditingId(charge.id)}
                    >
                      Edit
                    </button>
                    <span className="mx-1 text-slate-300">|</span>
                    <DeleteChargeButton
                      chargeId={charge.id}
                      shippingNoteId={shippingNoteId}
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
