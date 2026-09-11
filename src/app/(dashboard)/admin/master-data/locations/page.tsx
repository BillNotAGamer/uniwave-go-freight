import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/feedback";
import {
  ROUTING_LOCATION_TYPES,
  type RoutingLocationApplicability,
} from "@/features/locations/constants";
import { canMutateLocations } from "@/features/locations/permissions";
import { listRoutingLocationsForAdmin } from "@/features/locations/queries";
import { adminRoutingLocationListQuerySchema } from "@/features/locations/validators";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type LocationListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 50;

const typeLabels = {
  airport: "Airport",
  seaport: "Seaport",
  inland: "Inland",
  other: "Other",
} as const;

const applicabilityLabels: Record<RoutingLocationApplicability, string> = {
  sea_pol: "Ocean POL",
  sea_pod: "Ocean POD",
  sea_final_destination: "Ocean Final Destination",
  air_aol: "Air AOL",
  air_aod: "Air AOD",
  air_final_destination: "Air Final Destination",
  domestic_origin: "Domestic From",
  domestic_destination: "Domestic To",
  custom_origin: "Custom From",
  custom_destination: "Custom To",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(input: {
  search?: string;
  type?: string;
  status: string;
  page: number;
}): string {
  const params = new URLSearchParams({
    status: input.status,
    page: String(input.page),
  });
  if (input.search) params.set("search", input.search);
  if (input.type) params.set("type", input.type);
  return `/admin/master-data/locations?${params}`;
}

function StatusBadge({
  isActive,
  deletedAt,
}: {
  isActive: boolean;
  deletedAt: Date | null;
}) {
  const label = deletedAt ? "Deactivated" : isActive ? "Active" : "Inactive";
  const style = deletedAt
    ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    : isActive
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";

  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

export default async function LocationListPage({ searchParams }: LocationListPageProps) {
  const { user } = await requireAuthenticatedUser();
  if (!canMutateLocations(user)) notFound();

  const raw = await searchParams;
  const parsed = adminRoutingLocationListQuerySchema.safeParse({
    search: firstValue(raw.search),
    type: firstValue(raw.type),
    status: firstValue(raw.status),
    page: firstValue(raw.page),
  });
  if (!parsed.success) notFound();

  const result = await listRoutingLocationsForAdmin({
    search: parsed.data.search,
    type: parsed.data.type,
    status: parsed.data.status,
    limit: PAGE_SIZE + 1,
    offset: (parsed.data.page - 1) * PAGE_SIZE,
  }, user);
  const locations = result.slice(0, PAGE_SIZE);
  const hasNext = result.length > PAGE_SIZE;

  return (
    <>
      <PageHeader
        title="Master Data - Locations"
        description="Manage reusable routing Locations and explicit Shipping Note usage contexts."
      >
        <Link
          className="rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          href="/admin/master-data/locations/new"
        >
          New Location
        </Link>
      </PageHeader>

      <form
        className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-5 shadow-sm lg:grid-cols-[1fr_160px_180px_auto_auto] lg:items-end"
        method="get"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Search
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            defaultValue={parsed.data.search ?? ""}
            name="search"
            placeholder="Code, name, country, or subdivision"
            type="search"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Type
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            defaultValue={parsed.data.type ?? ""}
            name="type"
          >
            <option value="">All types</option>
            {ROUTING_LOCATION_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Status
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            defaultValue={parsed.data.status}
            name="status"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deleted">Deactivated</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <button
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          type="submit"
        >
          Apply
        </button>
        <Link
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          href="/admin/master-data/locations"
        >
          Clear filters
        </Link>
      </form>

      {locations.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="border-b border-border px-3 py-3">Code</th>
                <th className="border-b border-border px-3 py-3">Name</th>
                <th className="border-b border-border px-3 py-3">Type</th>
                <th className="border-b border-border px-3 py-3">Country</th>
                <th className="border-b border-border px-3 py-3">Subdivision</th>
                <th className="border-b border-border px-3 py-3">Applicabilities</th>
                <th className="border-b border-border px-3 py-3">Status</th>
                <th className="border-b border-border px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr className="align-top hover:bg-muted/40" key={location.id}>
                  <td className="border-b border-border/60 px-3 py-3 font-medium text-foreground">{location.code}</td>
                  <td className="border-b border-border/60 px-3 py-3 text-foreground">{location.name}</td>
                  <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">{typeLabels[location.type]}</td>
                  <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">{location.countryCode ?? "-"}</td>
                  <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">{location.subdivision ?? "-"}</td>
                  <td className="max-w-xs border-b border-border/60 px-3 py-3 text-muted-foreground">
                    {location.applicabilities.map((applicability) => applicabilityLabels[applicability]).join(", ")}
                  </td>
                  <td className="border-b border-border/60 px-3 py-3"><StatusBadge deletedAt={location.deletedAt} isActive={location.isActive} /></td>
                  <td className="border-b border-border/60 px-3 py-3">
                    <Link className="font-medium text-indigo-700 hover:underline dark:text-indigo-300" href={`/admin/master-data/locations/${location.id}`}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState title="No Locations found" description="Adjust the filters or create a reusable routing Location.">
            <Link
              className="rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              href="/admin/master-data/locations/new"
            >
              New Location
            </Link>
          </EmptyState>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <span>Page {parsed.data.page}</span>
        <div className="flex gap-2">
          <Link
            aria-disabled={parsed.data.page <= 1}
            className={`rounded-md border border-border px-3 py-2 font-medium ${parsed.data.page > 1 ? "hover:bg-muted" : "pointer-events-none opacity-50"}`}
            href={pageHref({
              search: parsed.data.search,
              type: parsed.data.type,
              status: parsed.data.status,
              page: parsed.data.page - 1,
            })}
          >
            Previous
          </Link>
          <Link
            aria-disabled={!hasNext}
            className={`rounded-md border border-border px-3 py-2 font-medium ${hasNext ? "hover:bg-muted" : "pointer-events-none opacity-50"}`}
            href={pageHref({
              search: parsed.data.search,
              type: parsed.data.type,
              status: parsed.data.status,
              page: parsed.data.page + 1,
            })}
          >
            Next
          </Link>
        </div>
      </div>
    </>
  );
}
