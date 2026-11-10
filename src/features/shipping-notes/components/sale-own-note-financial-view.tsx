import { formatFinancialDecimal } from "../presentation";
import type { SaleOwnNoteFinancialView as SaleOwnNoteFinancialData } from "../sale-own-note-financial";

type SaleOwnNoteFinancialViewProps = {
  data: SaleOwnNoteFinancialData;
};

export function SaleOwnNoteFinancialView({
  data,
}: SaleOwnNoteFinancialViewProps) {
  return (
    <section className="grid gap-4 border-t border-border pt-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Own-note financial view
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Buying Rate &amp; Gross Profit
        </h2>
        <p className="text-sm text-muted-foreground">
          Read-only Buying Rates and Gross Profit for a Shipping Note you
          created. Gross Profit excludes VAT and uses the stored VND selling
          and buying amounts.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Charge</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Quantity / Unit</th>
              <th className="px-3 py-2 text-right">Buying Rate</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.buyingRates.length > 0 ? (
              data.buyingRates.map((charge) => (
                <tr key={charge.id}>
                  <td className="border-t border-border/60 px-3 py-2 font-medium text-foreground">
                    {charge.chargeName}
                  </td>
                  <td className="border-t border-border/60 px-3 py-2 text-muted-foreground">
                    {charge.description ?? "-"}
                  </td>
                  <td className="border-t border-border/60 px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {formatFinancialDecimal(charge.quantity)} {charge.unit ?? "-"}
                  </td>
                  <td className="border-t border-border/60 px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {formatFinancialDecimal(charge.unitPrice, 2)} {charge.currency}
                  </td>
                  <td className="border-t border-border/60 px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                    {formatFinancialDecimal(charge.amountOriginal, 2)} {charge.currency}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="border-t border-border/60 px-3 py-3 text-muted-foreground"
                  colSpan={5}
                >
                  No Buying Rates have been recorded for this Shipping Note.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <dl className="grid gap-3 sm:max-w-sm">
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Gross Profit excluding VAT (VND)
          </dt>
          <dd className="mt-2 text-lg font-semibold text-foreground">
            {formatFinancialDecimal(data.grossProfitVnd, 2)} VND
          </dd>
        </div>
      </dl>
    </section>
  );
}
