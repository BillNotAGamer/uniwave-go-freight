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
    <div className="rounded-md border border-border bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Selling Summary
      </p>
      <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <dt className="font-medium text-foreground">Charges</dt>
          <dd>{summary.chargeCount}</dd>
        </div>
        <div className="flex justify-between border-b border-border pb-2">
          <dt className="font-medium text-foreground">Total VND</dt>
          <dd className="font-semibold text-foreground">{formatNumber(summary.totalVnd, 2)}</dd>
        </div>
        <div className="pt-1">
          <dt className="font-medium text-foreground mb-1">Original totals:</dt>
          <dd>
            <ul className="space-y-1 pl-2">
              {summary.totalsByCurrency.map((t) => (
                <li key={t.currency} className="flex gap-2">
                  <span className="text-muted-foreground">-</span>
                  <span>{t.currency}:</span>
                  <span className="ml-auto font-medium text-foreground">{formatNumber(t.amountOriginal, 4)}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </div>
  );
}
