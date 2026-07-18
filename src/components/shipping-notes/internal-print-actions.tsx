"use client";

type InternalPrintActionsProps = {
  backHref: string;
};

export function InternalPrintActions({ backHref }: InternalPrintActionsProps) {
  return (
    <div className="print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <a
          className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          href={backHref}
        >
          Back
        </a>
        <button
          className="inline-flex rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          onClick={() => window.print()}
          type="button"
        >
          Print
        </button>
      </div>
    </div>
  );
}
