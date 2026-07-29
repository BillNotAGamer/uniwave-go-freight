import { AlertCircle, FileBox, Loader2 } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = FileBox,
  children,
}: {
  title: string;
  description: string;
  icon?: React.ElementType;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm mb-4">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 mb-6 text-sm text-slate-500 max-w-sm">{description}</p>
      {children}
    </div>
  );
}

export function InlineAlert({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function LoadingSpinner({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}
