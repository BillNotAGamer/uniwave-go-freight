import type { ShippingMode, ShippingNoteStatus } from "../../constants";
import type { ChargeTaxDetail } from "../types";
import {
  getRequiredAccountingAction,
  getTaxCompletenessMessage,
  getMarkCheckedDisabledReason,
} from "../ui-policy";

type TaxCompletenessPanelProps = {
  status: ShippingNoteStatus;
  taxComplete: boolean;
  unclassifiedSellingCount: number;
  unclassifiedBuyingCount: number;
  canMarkChecked: boolean;
  jobsheetNo: string;
  shippingMode: ShippingMode;
  incompleteCharges: ChargeTaxDetail[];
};

export function TaxCompletenessPanel({
  status,
  taxComplete,
  unclassifiedSellingCount,
  unclassifiedBuyingCount,
  canMarkChecked,
  jobsheetNo,
  shippingMode,
  incompleteCharges,
}: TaxCompletenessPanelProps) {
  const totalUnclassifiedCount =
    unclassifiedSellingCount + unclassifiedBuyingCount;
  const disabledReason = getMarkCheckedDisabledReason({
    status,
    canMarkChecked,
    taxComplete,
  });

  return (
    <div className={
      taxComplete
        ? "rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40"
        : "rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40"
    }>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
            Tax Completeness
          </p>
          <h3 className={
            taxComplete
              ? "text-sm font-semibold text-slate-900 dark:text-emerald-300"
              : "text-sm font-semibold text-slate-900 dark:text-amber-300"
          }>
            {taxComplete ? "Complete" : "Incomplete"}
          </h3>
          <p className="max-w-3xl text-sm text-slate-700 dark:text-slate-300">
            {getTaxCompletenessMessage({ status, taxComplete })}
          </p>
          {disabledReason ? (
            <p className="text-sm text-amber-900 dark:text-amber-300">{disabledReason}</p>
          ) : null}
        </div>

        <dl className="grid min-w-72 grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-white/70 bg-white px-3 py-2 dark:border-slate-800/80 dark:bg-slate-900/80">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Selling</dt>
            <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {unclassifiedSellingCount}
            </dd>
          </div>
          <div className="rounded-md border border-white/70 bg-white px-3 py-2 dark:border-slate-800/80 dark:bg-slate-900/80">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Buying</dt>
            <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {unclassifiedBuyingCount}
            </dd>
          </div>
          <div className="rounded-md border border-white/70 bg-white px-3 py-2 dark:border-slate-800/80 dark:bg-slate-900/80">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Total</dt>
            <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {totalUnclassifiedCount}
            </dd>
          </div>
        </dl>
      </div>
      {!taxComplete && incompleteCharges.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-amber-200 bg-white dark:border-amber-900/60 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <th className="border-b border-border px-3 py-2">Shipping Note</th>
                <th className="border-b border-border px-3 py-2">Mode</th>
                <th className="border-b border-border px-3 py-2">Section</th>
                <th className="border-b border-border px-3 py-2">Charge</th>
                <th className="border-b border-border px-3 py-2">Blocker</th>
                <th className="border-b border-border px-3 py-2">Required action</th>
              </tr>
            </thead>
            <tbody>
              {incompleteCharges.map((charge) => (
                <tr key={charge.chargeId} className="align-top">
                  <td className="border-b border-border/60 px-3 py-2 font-medium">{jobsheetNo}</td>
                  <td className="border-b border-border/60 px-3 py-2">{shippingMode}</td>
                  <td className="border-b border-border/60 px-3 py-2 capitalize">{charge.section}</td>
                  <td className="border-b border-border/60 px-3 py-2">
                    <div>{charge.chargeName}</div>
                    {charge.catalogCodeSnapshot ? (
                      <div className="text-xs text-muted-foreground">{charge.catalogCodeSnapshot}</div>
                    ) : null}
                  </td>
                  <td className="border-b border-border/60 px-3 py-2 text-amber-900 dark:text-amber-300">
                    {charge.incompleteReason ?? "Tax classification is incomplete."}
                  </td>
                  <td className="border-b border-border/60 px-3 py-2">
                    {getRequiredAccountingAction(charge)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
