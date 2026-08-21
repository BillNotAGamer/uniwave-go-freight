import type { FinancialSummary } from "../types";

function formatDecimal(value: string, decimals: number): string {
  const match = value.match(/^(-?)(\d+)(?:\.(\d+))?$/);

  if (!match) {
    return value;
  }

  const [, sign, integerPart, fractionalPart = ""] = match;
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formattedFraction = fractionalPart.padEnd(decimals, "0").slice(0, decimals);

  return `${sign}${formattedInteger}.${formattedFraction}`;
}

type FinancialSummaryProps = {
  summary: FinancialSummary;
};

export function FinancialSummaryView({ summary }: FinancialSummaryProps) {
  return (
    <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Financial Summary
        </p>
        <p className="text-sm text-slate-600">
          Read-only accountant and admin totals derived from stored selling and
          buying charges.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total Selling (VND)
          </dt>
          <dd className="mt-2 text-lg font-semibold text-slate-900">
            {formatDecimal(summary.totalSellingVnd, 2)}
          </dd>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total Buying (VND)
          </dt>
          <dd className="mt-2 text-lg font-semibold text-slate-900">
            {formatDecimal(summary.totalBuyingVnd, 2)}
          </dd>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Gross Profit (VND)
          </dt>
          <dd className="mt-2 text-lg font-semibold text-slate-900">
            {formatDecimal(summary.grossProfitVnd, 2)}
          </dd>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Selling Charges Count
          </dt>
          <dd className="mt-2 text-lg font-semibold text-slate-900">
            {summary.sellingChargeCount}
          </dd>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Buying Charges Count
          </dt>
          <dd className="mt-2 text-lg font-semibold text-slate-900">
            {summary.buyingChargeCount}
          </dd>
        </div>
      </dl>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-900">VAT Summary</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="py-2 pr-3">Section</th>
                <th className="px-3 py-2 text-right">Subtotal excl. VAT</th>
                <th className="px-3 py-2 text-right">VAT</th>
                <th className="px-3 py-2 text-right">Total incl. VAT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-t border-slate-100 py-2 pr-3 font-medium text-slate-900">
                  Selling
                </td>
                <td className="border-t border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatDecimal(summary.sellingSubtotalExcludingVatVnd, 2)}
                </td>
                <td className="border-t border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatDecimal(summary.sellingVatVnd, 2)}
                </td>
                <td className="border-t border-slate-100 px-3 py-2 text-right font-medium text-slate-900">
                  {formatDecimal(summary.sellingTotalIncludingVatVnd, 2)}
                </td>
              </tr>
              <tr>
                <td className="border-t border-slate-100 py-2 pr-3 font-medium text-slate-900">
                  Buying
                </td>
                <td className="border-t border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatDecimal(summary.buyingSubtotalExcludingVatVnd, 2)}
                </td>
                <td className="border-t border-slate-100 px-3 py-2 text-right text-slate-700">
                  {formatDecimal(summary.buyingVatVnd, 2)}
                </td>
                <td className="border-t border-slate-100 px-3 py-2 text-right font-medium text-slate-900">
                  {formatDecimal(summary.buyingTotalIncludingVatVnd, 2)}
                </td>
              </tr>
              <tr>
                <td className="border-t border-slate-100 py-2 pr-3 font-medium text-slate-900">
                  Gross profit excluding VAT
                </td>
                <td className="border-t border-slate-100 px-3 py-2 text-right font-medium text-slate-900" colSpan={3}>
                  {formatDecimal(summary.grossProfitExcludingVatVnd, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">Selling Original Totals</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {summary.sellingTotalsByCurrency.map((total) => (
              <li key={`selling-${total.currency}`} className="flex justify-between gap-3">
                <span>{total.currency}</span>
                <span className="font-medium text-slate-900">
                  {formatDecimal(total.amountOriginal, 4)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">Buying Original Totals</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {summary.buyingTotalsByCurrency.map((total) => (
              <li key={`buying-${total.currency}`} className="flex justify-between gap-3">
                <span>{total.currency}</span>
                <span className="font-medium text-slate-900">
                  {formatDecimal(total.amountOriginal, 4)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
