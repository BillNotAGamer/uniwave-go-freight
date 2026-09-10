"use client";

import { useActionState, useState } from "react";

import {
  softDeleteBuyingChargeAction,
  updateBuyingChargeAction,
} from "../actions";
import { CURRENCY_CODES } from "../constants";
import type { BuyingChargeActionState, BuyingChargeDetail } from "../types";
import { ChargeCatalogSelector } from "./charge-catalog-selector";

function formatNumber(value: string): string {
  const num = Number(value);
  return Number.isNaN(num) ? value : num.toLocaleString();
}

const actionInitialState: BuyingChargeActionState = { ok: true };

type DeleteBuyingChargeButtonProps = {
  chargeId: string;
};

function DeleteBuyingChargeButton({ chargeId }: DeleteBuyingChargeButtonProps) {
  const [state, formAction] = useActionState(
    softDeleteBuyingChargeAction,
    actionInitialState,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={chargeId} />
      <button
        className="text-xs text-red-600 dark:text-red-400 underline-offset-4 hover:underline"
        type="submit"
      >
        Delete
      </button>
      {!state.ok ? (
        <span className="ml-2 text-xs text-red-700 dark:text-red-400">{state.error}</span>
      ) : null}
    </form>
  );
}

type EditBuyingChargeRowProps = {
  charge: BuyingChargeDetail;
  onCancel: () => void;
};

function EditBuyingChargeRow({
  charge,
  onCancel,
}: EditBuyingChargeRowProps) {
  const [state, formAction] = useActionState(
    updateBuyingChargeAction,
    actionInitialState,
  );
  const [unit, setUnit] = useState(charge.unit ?? "");

  const initialItem = charge.serviceCatalogItemId
    ? {
        id: charge.serviceCatalogItemId,
        code: charge.catalogCodeSnapshot,
        name: charge.catalogNameSnapshot ?? charge.chargeName,
        primaryUnit: charge.catalogUnitSnapshot,
        vatRate: charge.catalogVatRateSnapshot,
      }
    : null;

  return (
    <tr className="bg-slate-50 dark:bg-slate-900/60">
      <td colSpan={11} className="border-b border-slate-200 dark:border-slate-800 px-3 py-3">
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="id" value={charge.id} />

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Edit Buying Charge
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4">
              <ChargeCatalogSelector
                initialItem={initialItem}
                initialChargeName={charge.chargeName}
                onUnitSelect={(newUnit) => setUnit(newUnit)}
              />
            </div>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Description
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                name="description"
                type="text"
                defaultValue={charge.description ?? ""}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Quantity
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                defaultValue={charge.quantity}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Unit
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                name="unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Unit Price
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                name="unitPrice"
                type="number"
                min="0"
                step="0.0001"
                defaultValue={charge.unitPrice}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Currency
              <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
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

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Exchange Rate (Required for USD)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                name="exchangeRate"
                type="number"
                min="0.000001"
                step="0.000001"
                defaultValue={charge.exchangeRate}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Vendor / Agent
              <input
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                name="vendorOrAgentText"
                type="text"
                defaultValue={charge.vendorOrAgentText ?? ""}
              />
            </label>
          </div>

          {!state.ok ? (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              type="submit"
            >
              Save
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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

type BuyingChargesListProps = {
  charges: BuyingChargeDetail[];
  canManageBuyingCharges: boolean;
};

export function BuyingChargesList({
  charges,
  canManageBuyingCharges,
}: BuyingChargesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (charges.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No buying charges yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2">Charge</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2">Description</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 text-right">Qty</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2">Unit</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 text-right">Unit Price</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2">Curr</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 text-right">Rate</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 text-right">Amount</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 text-right">VND</th>
            <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2">
              Vendor / Agent
            </th>
            {canManageBuyingCharges ? (
              <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2" />
            ) : null}
          </tr>
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

            return (
              <tr key={charge.id} className="align-top hover:bg-muted/50 transition-colors">
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                  <div>{charge.catalogNameSnapshot ?? charge.chargeName}</div>
                  {charge.catalogCodeSnapshot ? (
                    <div className="text-xs text-muted-foreground font-normal">
                      [{charge.catalogCodeSnapshot}]
                    </div>
                  ) : null}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-slate-700 dark:text-slate-300">
                  {charge.description ?? "-"}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatNumber(charge.quantity)}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-slate-700 dark:text-slate-300">
                  {charge.unit ?? "-"}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatNumber(charge.unitPrice)}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-slate-700 dark:text-slate-300">
                  {charge.currency}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatNumber(charge.exchangeRate)}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatNumber(charge.amountOriginal)}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                  {formatNumber(charge.amountVnd)}
                </td>
                <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 text-slate-700 dark:text-slate-300">
                  {charge.vendorOrAgentText ?? "-"}
                </td>
                {canManageBuyingCharges ? (
                  <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 whitespace-nowrap">
                    <button
                      className="text-xs text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 underline-offset-4 hover:underline"
                      type="button"
                      onClick={() => setEditingId(charge.id)}
                    >
                      Edit
                    </button>
                    <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
                    <DeleteBuyingChargeButton chargeId={charge.id} />
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
