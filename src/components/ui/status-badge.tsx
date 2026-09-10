import { ShippingNoteStatus } from "@/features/shipping-notes/constants";
import { cn } from "@/lib/utils";

const statusConfig: Record<ShippingNoteStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60",
  },
  accounting_reviewing: {
    label: "Accounting Reviewing",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
  },
  checked: {
    label: "Checked",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800/80",
  },
  exported: {
    label: "Exported",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/60",
  },
  locked: {
    label: "Closed",
    className: "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800/90 dark:text-slate-200 dark:border-slate-700",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = statusConfig[status as ShippingNoteStatus] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
