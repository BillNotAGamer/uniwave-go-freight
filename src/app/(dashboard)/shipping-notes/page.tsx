import Link from "next/link";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";

import {
  buildShippingNotesListHref,
  parseShippingNotesListSearchParams,
} from "@/features/shipping-notes/list-filters";
import { listShippingNotesForUser } from "@/features/shipping-notes/queries";

type ShippingNotesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: Date): string {
  return new Date(value).toLocaleString();
}

export default async function ShippingNotesPage({
  searchParams,
}: ShippingNotesPageProps) {
  const { user } = await requireAuthenticatedUser();
  const parsedFilters = parseShippingNotesListSearchParams(await searchParams);
  const shippingNotes = parsedFilters.success
    ? await listShippingNotesForUser(user, parsedFilters.filters)
    : [];
  const canCreateShippingNote = hasPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_CREATE_OWN,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Shipping notes"
        description="Safe list view only. Draft creation and submission stay server-side."
      >
        {canCreateShippingNote ? (
          <Link
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 shadow-sm"
            href="/shipping-notes/new"
          >
            New Shipping Note
          </Link>
        ) : null}
      </PageHeader>

      <div className="flex w-full flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">

        <form
          className="grid gap-3 border-b border-border pb-5 lg:grid-cols-[minmax(180px,1fr)_170px_170px_auto_auto] lg:items-end"
          method="get"
        >
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-foreground" htmlFor="jobsheet">
            Jobsheet No
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue={parsedFilters.formValues.jobsheet ?? ""}
              id="jobsheet"
              maxLength={120}
              name="jobsheet"
              placeholder="Search Jobsheet..."
              type="search"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-foreground" htmlFor="etdFrom">
            ETD From
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue={parsedFilters.formValues.etdFrom ?? ""}
              id="etdFrom"
              name="etdFrom"
              type="date"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-foreground" htmlFor="etdTo">
            ETD To
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue={parsedFilters.formValues.etdTo ?? ""}
              id="etdTo"
              name="etdTo"
              type="date"
            />
          </label>
          <button
            className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="submit"
          >
            Search
          </button>
          <Link
            className="inline-flex h-10 w-fit items-center justify-center rounded-md border border-input px-4 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={buildShippingNotesListHref({})}
          >
            Clear
          </Link>
        </form>

        {!parsedFilters.success ? (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            {parsedFilters.error}
          </p>
        ) : null}

        {shippingNotes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="border-b border-border px-3 py-3">Jobsheet No</th>
                  <th className="border-b border-border px-3 py-3">Mode</th>
                  <th className="border-b border-border px-3 py-3">Shipper</th>
                  <th className="border-b border-border px-3 py-3">Consignee</th>
                  <th className="border-b border-border px-3 py-3">Status</th>
                  <th className="border-b border-border px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {shippingNotes.map((note) => (
                  <tr key={note.id} className="align-top hover:bg-muted/50 transition-colors">
                    <td className="border-b border-border/60 px-3 py-3 font-medium text-foreground">
                      <Link className="text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline" href={`/shipping-notes/${note.id}`}>
                        {note.jobsheetNo}
                      </Link>
                    </td>
                    <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                      {note.shippingMode}
                    </td>
                    <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                      {note.shipperText ?? "-"}
                    </td>
                    <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                      {note.consigneeText ?? "-"}
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <StatusBadge status={note.status} />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(note.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={parsedFilters.success && Object.values(parsedFilters.filters).some(Boolean)
              ? "No Shipping Notes match these filters"
              : "No shipping notes"}
            description={parsedFilters.success && Object.values(parsedFilters.filters).some(Boolean)
              ? "Adjust the Jobsheet or ETD filters and search again."
              : "You haven't created any shipping notes yet."}
          >
            {canCreateShippingNote && (
              <Link
                href="/shipping-notes/new"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 shadow-sm"
              >
                Create new note
              </Link>
            )}
          </EmptyState>
        )}

        <div className="text-xs text-muted-foreground mt-2">
          Charge lines, buying data, accounting review, and exports are next-phase
          work.
        </div>
      </div>
    </PageContainer>
  );
}
