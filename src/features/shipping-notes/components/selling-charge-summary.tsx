import type { SellingChargeSummary } from "../types";

function formatNumber(value: string, decimals: number): string {
  const num = Number(value);
  return Number.isNaN(num)
    ? value
    : num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
}

type SellingChargeSummaryProps = {
  summary: SellingChargeSummary;
};

export function SellingChargeSummaryView({ summary }: SellingChargeSummaryProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Selling Summary
      </p>
      <dl className="mt-3 space-y-2 text-sm text-slate-700">
        <div className="flex justify-between">
          <dt className="font-medium text-slate-900">Charges</dt>
          <dd>{summary.chargeCount}</dd>
        </div>
        <div className="flex justify-between border-b border-slate-200 pb-2">
          <dt className="font-medium text-slate-900">Total VND</dt>
          <dd className="font-semibold text-slate-900">{formatNumber(summary.totalVnd, 2)}</dd>
        </div>
        <div className="pt-1">
          <dt className="font-medium text-slate-900 mb-1">Original totals:</dt>
          <dd>
            <ul className="space-y-1 pl-2">
              {summary.totalsByCurrency.map((t) => (
                <li key={t.currency} className="flex gap-2">
                  <span className="text-slate-500">-</span>
                  <span>{t.currency}:</span>
                  <span className="ml-auto">{formatNumber(t.amountOriginal, 4)}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </div>
  );
}
