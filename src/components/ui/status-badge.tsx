import { ShippingNoteStatus } from "@/features/shipping-notes/constants";
import { cn } from "@/lib/utils";

const statusConfig: Record<ShippingNoteStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  accounting_reviewing: {
    label: "Accounting Reviewing",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  checked: {
    label: "Checked",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium",
  },
  exported: {
    label: "Exported",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  locked: {
    label: "Locked",
    className: "bg-slate-200 text-slate-800 border-slate-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 border-red-200",
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
    className: "bg-slate-100 text-slate-600 border-slate-200",
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
