import type { ShippingNoteStatus } from "../../constants";
import {
  getTaxCompletenessMessage,
  getMarkCheckedDisabledReason,
} from "../ui-policy";

type TaxCompletenessPanelProps = {
  status: ShippingNoteStatus;
  taxComplete: boolean;
  unclassifiedSellingCount: number;
  unclassifiedBuyingCount: number;
  canMarkChecked: boolean;
};

export function TaxCompletenessPanel({
  status,
  taxComplete,
  unclassifiedSellingCount,
  unclassifiedBuyingCount,
  canMarkChecked,
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
    </div>
  );
}
