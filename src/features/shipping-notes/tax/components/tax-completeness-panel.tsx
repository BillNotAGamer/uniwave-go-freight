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
        ? "rounded-md border border-emerald-200 bg-emerald-50 p-4"
        : "rounded-md border border-amber-200 bg-amber-50 p-4"
    }>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            Tax Completeness
          </p>
          <h3 className="text-sm font-semibold text-slate-900">
            {taxComplete ? "Complete" : "Incomplete"}
          </h3>
          <p className="max-w-3xl text-sm text-slate-700">
            {getTaxCompletenessMessage({ status, taxComplete })}
          </p>
          {disabledReason ? (
            <p className="text-sm text-amber-900">{disabledReason}</p>
          ) : null}
        </div>

        <dl className="grid min-w-72 grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-white/70 bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">Selling</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {unclassifiedSellingCount}
            </dd>
          </div>
          <div className="rounded-md border border-white/70 bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">Buying</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {unclassifiedBuyingCount}
            </dd>
          </div>
          <div className="rounded-md border border-white/70 bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">Total</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {totalUnclassifiedCount}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
