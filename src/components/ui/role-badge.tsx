import { type Role, ROLE_LABELS } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

interface RoleBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  role: Role;
}

export function RoleBadge({ role, className, ...props }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        role === "admin" && "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-900/60",
        role === "accountant" && "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-900/60",
        role === "sale" && "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:border dark:border-slate-700",
        className,
      )}
      {...props}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
