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
    <div className="grid gap-4 rounded-md border border-border bg-muted/40 p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Financial Summary
        </p>
        <p className="text-sm text-muted-foreground">
          Read-only accountant and admin totals derived from stored selling and
          buying charges.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-border bg-card p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Total Selling (VND)
          </dt>
          <dd className="mt-2 text-lg font-semibold text-foreground">
            {formatDecimal(summary.totalSellingVnd, 2)}
          </dd>
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Total Buying (VND)
          </dt>
          <dd className="mt-2 text-lg font-semibold text-foreground">
            {formatDecimal(summary.totalBuyingVnd, 2)}
          </dd>
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Gross Profit (VND)
          </dt>
          <dd className="mt-2 text-lg font-semibold text-foreground">
            {formatDecimal(summary.grossProfitVnd, 2)}
          </dd>
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Selling Charges Count
          </dt>
          <dd className="mt-2 text-lg font-semibold text-foreground">
            {summary.sellingChargeCount}
          </dd>
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Buying Charges Count
          </dt>
          <dd className="mt-2 text-lg font-semibold text-foreground">
            {summary.buyingChargeCount}
          </dd>
        </div>
      </dl>

      <div className="rounded-md border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">VAT Summary</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="py-2 pr-3">Section</th>
                <th className="px-3 py-2 text-right">Subtotal excl. VAT</th>
                <th className="px-3 py-2 text-right">VAT</th>
                <th className="px-3 py-2 text-right">Total incl. VAT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-t border-border/60 py-2 pr-3 font-medium text-foreground">
                  Selling
                </td>
                <td className="border-t border-border/60 px-3 py-2 text-right text-muted-foreground">
                  {formatDecimal(summary.sellingSubtotalExcludingVatVnd, 2)}
                </td>
                <td className="border-t border-border/60 px-3 py-2 text-right text-muted-foreground">
                  {formatDecimal(summary.sellingVatVnd, 2)}
                </td>
                <td className="border-t border-border/60 px-3 py-2 text-right font-medium text-foreground">
                  {formatDecimal(summary.sellingTotalIncludingVatVnd, 2)}
                </td>
              </tr>
              <tr>
                <td className="border-t border-border/60 py-2 pr-3 font-medium text-foreground">
                  Buying
                </td>
                <td className="border-t border-border/60 px-3 py-2 text-right text-muted-foreground">
                  {formatDecimal(summary.buyingSubtotalExcludingVatVnd, 2)}
                </td>
                <td className="border-t border-border/60 px-3 py-2 text-right text-muted-foreground">
                  {formatDecimal(summary.buyingVatVnd, 2)}
                </td>
                <td className="border-t border-border/60 px-3 py-2 text-right font-medium text-foreground">
                  {formatDecimal(summary.buyingTotalIncludingVatVnd, 2)}
                </td>
              </tr>
              <tr>
                <td className="border-t border-border/60 py-2 pr-3 font-medium text-foreground">
                  Gross profit excluding VAT
                </td>
                <td className="border-t border-border/60 px-3 py-2 text-right font-medium text-foreground" colSpan={3}>
                  {formatDecimal(summary.grossProfitExcludingVatVnd, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Selling Original Totals</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {summary.sellingTotalsByCurrency.map((total) => (
              <li key={`selling-${total.currency}`} className="flex justify-between gap-3">
                <span>{total.currency}</span>
                <span className="font-medium text-foreground">
                  {formatDecimal(total.amountOriginal, 4)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Buying Original Totals</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {summary.buyingTotalsByCurrency.map((total) => (
              <li key={`buying-${total.currency}`} className="flex justify-between gap-3">
                <span>{total.currency}</span>
                <span className="font-medium text-foreground">
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
