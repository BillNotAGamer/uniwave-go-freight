"use client";

import Link from "next/link";

import type {
  AuditViewerCategory,
  AuditViewerItem,
} from "../types";

function valueText(value: string | null): string {
  return value ?? "-";
}

function shortenedId(value: string): string {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function entityText(item: AuditViewerItem): string {
  return item.entityLabel ?? `${item.entityType} ${shortenedId(item.entityId)}`;
}

function CategoryBadge({ category }: { category: AuditViewerCategory }) {
  const className = {
    shipping_note: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:border dark:border-sky-900/60",
    charge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-900/60",
    tax: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-900/60",
    export: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-900/60",
    user: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 dark:border dark:border-violet-900/60",
    unknown: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700",
  }[category];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {category}
    </span>
  );
}

function EntityCell({ item }: { item: AuditViewerItem }) {
  const label = entityText(item);

  if (!item.entityHref) {
    return (
      <span className="break-words text-slate-700 dark:text-slate-300">
        {label}
      </span>
    );
  }

  return (
    <Link
      className="break-words font-medium text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-400"
      href={item.entityHref}
    >
      {label}
    </Link>
  );
}

function AuditDetails({ item }: { item: AuditViewerItem }) {
  if (!item.detailsAvailable || item.changes.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        No additional safe details available.
      </span>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-400">
        Details
      </summary>
      <div className="mt-3 overflow-x-auto rounded-md border border-border bg-muted/40">
        <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="border-b border-border px-3 py-2 font-semibold">
                Field
              </th>
              <th className="border-b border-border px-3 py-2 font-semibold">
                Before
              </th>
              <th className="border-b border-border px-3 py-2 font-semibold">
                After
              </th>
            </tr>
          </thead>
          <tbody>
            {item.changes.map((change) => (
              <tr key={change.field} className="align-top">
                <td className="border-b border-border/60 px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                  {change.label}
                </td>
                <td className="max-w-[18rem] break-words border-b border-border/60 px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                  {valueText(change.before)}
                </td>
                <td className="max-w-[18rem] break-words border-b border-border/60 px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                  {valueText(change.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function AdminAuditTable({
  items,
  nextHref,
}: {
  items: AuditViewerItem[];
  nextHref: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="border-b border-border px-3 py-3">Time</th>
              <th className="border-b border-border px-3 py-3">Actor</th>
              <th className="border-b border-border px-3 py-3">Action</th>
              <th className="border-b border-border px-3 py-3">Category</th>
              <th className="border-b border-border px-3 py-3">Entity</th>
              <th className="border-b border-border px-3 py-3">Reason</th>
              <th className="border-b border-border px-3 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="align-top hover:bg-muted/40">
                <td className="whitespace-nowrap border-b border-border/60 px-3 py-3 text-slate-700 dark:text-slate-300">
                  {item.createdAtDisplay}
                </td>
                <td className="max-w-[16rem] break-words border-b border-border/60 px-3 py-3 text-slate-700 dark:text-slate-300">
                  <div className="font-medium text-foreground">
                    {item.actor.display}
                  </div>
                  {item.actor.email && item.actor.email !== item.actor.display ? (
                    <div className="text-xs text-muted-foreground">{item.actor.email}</div>
                  ) : null}
                </td>
                <td className="max-w-[18rem] break-words border-b border-border/60 px-3 py-3">
                  <div className="font-medium text-foreground">
                    {item.actionLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.action}</div>
                </td>
                <td className="border-b border-border/60 px-3 py-3">
                  <CategoryBadge category={item.category} />
                </td>
                <td className="max-w-[18rem] border-b border-border/60 px-3 py-3">
                  <EntityCell item={item} />
                </td>
                <td className="max-w-[18rem] break-words border-b border-border/60 px-3 py-3 text-slate-700 dark:text-slate-300">
                  {item.reason ?? "-"}
                </td>
                <td className="min-w-[260px] border-b border-border/60 px-3 py-3">
                  <AuditDetails item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm text-slate-700 shadow-sm dark:text-slate-300">
        <span>Newest events first. Use the browser Back button for previous pages.</span>
        {nextHref ? (
          <Link
            className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            href={nextHref}
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
