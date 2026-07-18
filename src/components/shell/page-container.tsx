import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
