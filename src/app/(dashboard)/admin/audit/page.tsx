import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { AdminAuditTable } from "@/features/admin/audit/components/admin-audit-table";
import {
  AUDIT_VIEWER_ACTION_OPTIONS,
  AUDIT_VIEWER_ENTITY_TYPE_OPTIONS,
  buildAuditViewerHref,
  parseAuditViewerPageSearchParams,
} from "@/features/admin/audit/ui";
import { listAuditViewerForUser } from "@/features/admin/audit/queries";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

type AdminAuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAuditPage({
  searchParams,
}: AdminAuditPageProps) {
  const { user } = await requireAuthenticatedUser();

  if (!hasPermission(user.role, PERMISSIONS.AUDIT_LOGS_READ)) {
    notFound();
  }

  const parsedQuery = parseAuditViewerPageSearchParams(await searchParams);

  if (!parsedQuery.success) {
    notFound();
  }

  const result = await listAuditViewerForUser(user, parsedQuery.filters);
  const nextHref = result.hasNextPage && result.nextCursor
    ? buildAuditViewerHref({
      formValues: parsedQuery.formValues,
      cursor: result.nextCursor,
    })
    : null;

  return (
    <PageContainer>
      <PageHeader
        title="Audit Log"
        description="Review administrative and workflow events through safe, allowlisted audit details."
      />

      <form
        className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-sm lg:grid-cols-[minmax(180px,1.4fr)_180px_minmax(180px,1fr)_minmax(180px,1fr)_150px_150px_auto_auto] lg:items-end"
        method="get"
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Action
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.formValues.action ?? ""}
            name="action"
          >
            <option value="">All actions</option>
            {AUDIT_VIEWER_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Entity type
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.formValues.entityType ?? ""}
            name="entityType"
          >
            <option value="">All entity types</option>
            {AUDIT_VIEWER_ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Entity ID
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.formValues.entityId ?? ""}
            name="entityId"
            placeholder="Exact UUID"
            type="text"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Actor ID
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.formValues.actorId ?? ""}
            name="actorId"
            placeholder="Exact UUID"
            type="text"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          From date
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.formValues.from ?? ""}
            name="from"
            type="date"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          To date
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.formValues.to ?? ""}
            name="to"
            type="date"
          />
        </label>

        <button
          className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          type="submit"
        >
          Apply
        </button>

        <Link
          className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          href="/admin/audit"
        >
          Clear filters
        </Link>
      </form>

      {result.items.length > 0 ? (
        <AdminAuditTable items={result.items} nextHref={nextHref} />
      ) : (
        <EmptyState
          title="No audit events found"
          description="No audit events match these filters."
        />
      )}
    </PageContainer>
  );
}
