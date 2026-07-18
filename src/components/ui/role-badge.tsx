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
        role === "admin" && "bg-red-100 text-red-800",
        role === "accountant" && "bg-blue-100 text-blue-800",
        role === "sale" && "bg-slate-100 text-slate-800",
        className,
      )}
      {...props}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
