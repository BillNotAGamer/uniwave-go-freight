"use client";

import { useState } from "react";

import {
  formatPositiveChargeExchangeRate,
  getExchangeRateAfterCurrencyChange,
} from "../charge-currency";
import { CURRENCY_CODES, type CurrencyCode } from "../constants";

const controlClassName =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20";
const labelClassName =
  "block text-sm font-medium text-slate-700 dark:text-slate-200";

export function ChargeCurrencyFields({
  idPrefix,
  initialCurrency = "VND",
  initialExchangeRate = "1",
  usdDefaultExchangeRate,
}: {
  idPrefix: string;
  initialCurrency?: CurrencyCode;
  initialExchangeRate?: string;
  usdDefaultExchangeRate?: string | null;
}) {
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [exchangeRate, setExchangeRate] = useState(() =>
    initialCurrency === "VND"
      ? "1"
      : (formatPositiveChargeExchangeRate(initialExchangeRate) ?? ""),
  );

  function handleCurrencyChange(nextCurrency: CurrencyCode) {
    setExchangeRate((currentExchangeRate) =>
      getExchangeRateAfterCurrencyChange({
        previousCurrency: currency,
        nextCurrency,
        currentExchangeRate,
        usdDefaultExchangeRate,
      }),
    );
    setCurrency(nextCurrency);
  }

  const isVnd = currency === "VND";

  return (
    <>
      <label className={labelClassName} htmlFor={`${idPrefix}-currency`}>
        Currency
        <select
          className={controlClassName}
          id={`${idPrefix}-currency`}
          name="currency"
          value={currency}
          onChange={(event) =>
            handleCurrencyChange(event.target.value as CurrencyCode)
          }
          required
        >
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName} htmlFor={`${idPrefix}-exchange-rate`}>
        {isVnd
          ? "Exchange Rate (VND fixed at 1)"
          : `${currency}/VND Exchange Rate (Required)`}
        <input
          className={controlClassName}
          id={`${idPrefix}-exchange-rate`}
          name="exchangeRate"
          type="number"
          min="0.000001"
          step="0.000001"
          value={exchangeRate}
          onChange={(event) => setExchangeRate(event.target.value)}
          readOnly={isVnd}
          required={!isVnd}
        />
      </label>
    </>
  );
}
