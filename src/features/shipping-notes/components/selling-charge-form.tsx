"use client";

import { useActionState } from "react";

import type { ShippingNoteActionResult } from "../actions";
import { createSellingChargeAction } from "../actions";
import { CURRENCY_CODES } from "../constants";

function inputClassName() {
  return "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
}

function labelClassName() {
  return "block text-sm font-medium text-slate-700";
}

type SellingChargeFormProps = {
  shippingNoteId: string;
};

const initialState: ShippingNoteActionResult = { ok: true };

export function SellingChargeForm({ shippingNoteId }: SellingChargeFormProps) {
  const [state, formAction] = useActionState(createSellingChargeAction, initialState);

  return (
    <form className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4" action={formAction}>
      <input type="hidden" name="shippingNoteId" value={shippingNoteId} />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Add Selling Charge
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClassName()} htmlFor="chargeName">
          Charge Name
          <input
            className={inputClassName()}
            id="chargeName"
            name="chargeName"
            type="text"
            required
          />
        </label>

        <label className={labelClassName()} htmlFor="description">
          Description
          <input
            className={inputClassName()}
            id="description"
            name="description"
            type="text"
          />
        </label>

        <label className={labelClassName()} htmlFor="quantity">
          Quantity
          <input
            className={inputClassName()}
            id="quantity"
            name="quantity"
            type="number"
            min="0.001"
            step="0.001"
            required
          />
        </label>

        <label className={labelClassName()} htmlFor="unit">
          Unit
          <input
            className={inputClassName()}
            id="unit"
            name="unit"
            type="text"
            required
          />
        </label>

        <label className={labelClassName()} htmlFor="unitPrice">
          Unit Price
          <input
            className={inputClassName()}
            id="unitPrice"
            name="unitPrice"
            type="number"
            min="0"
            step="0.0001"
            required
          />
        </label>

        <label className={labelClassName()} htmlFor="currency">
          Currency
          <select
            className={inputClassName()}
            id="currency"
            name="currency"
            defaultValue="VND"
            required
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClassName()} htmlFor="exchangeRate">
          Exchange Rate
          <input
            className={inputClassName()}
            id="exchangeRate"
            name="exchangeRate"
            type="number"
            min="0.000001"
            step="0.000001"
            defaultValue="1"
          />
        </label>
      </div>

      {!state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <div>
        <button
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          type="submit"
        >
          Add Charge
        </button>
      </div>
    </form>
  );
}
