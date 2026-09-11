import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { canMutatePartners } from "@/features/partners/permissions";
import { listPartnersForAdmin } from "@/features/partners/queries";
import { adminPartnerListQuerySchema } from "@/features/partners/validators";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type PartnerListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 50;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildPageHref(input: { search?: string; status: string; page: number }): string {
  const params = new URLSearchParams({ status: input.status, page: String(input.page) });
  if (input.search) params.set("search", input.search);
  return `/admin/master-data/partners?${params.toString()}`;
}

function PartnerStatusBadge({ isActive, deletedAt }: { isActive: boolean; deletedAt: Date | null }) {
  const status = deletedAt ? "Deactivated" : isActive ? "Active" : "Inactive";
  const className = deletedAt
    ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    : isActive
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{status}</span>;
}

export default async function PartnerListPage({ searchParams }: PartnerListPageProps) {
  const { user } = await requireAuthenticatedUser();
  if (!canMutatePartners(user)) notFound();

  const rawSearchParams = await searchParams;
  const parsed = adminPartnerListQuerySchema.safeParse({
    search: firstValue(rawSearchParams.search),
    status: firstValue(rawSearchParams.status),
    page: firstValue(rawSearchParams.page),
  });
  if (!parsed.success) notFound();

  const offset = (parsed.data.page - 1) * PAGE_SIZE;
  const result = await listPartnersForAdmin({
    search: parsed.data.search,
    status: parsed.data.status,
    limit: PAGE_SIZE + 1,
    offset,
  }, user);
  const hasNext = result.length > PAGE_SIZE;
  const partners = result.slice(0, PAGE_SIZE);

  return (
    <PageContainer>
      <PageHeader
        title="Master Data — Partners"
        description="Manage reusable legal and business entities for Shipping Notes. Historical Shipping Notes remain unchanged."
      >
        <Link className="inline-flex rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500" href="/admin/master-data/partners/new">New Partner</Link>
      </PageHeader>

      <form className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-sm lg:grid-cols-[1fr_180px_auto_auto] lg:items-end" method="get">
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Search
          <input className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" defaultValue={parsed.data.search ?? ""} name="search" placeholder="Company name, vendor code, or Tax ID" type="search" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Status
          <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" defaultValue={parsed.data.status} name="status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deleted">Deactivated</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <button className="inline-flex w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" type="submit">Apply</button>
        <Link className="inline-flex w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" href="/admin/master-data/partners">Clear filters</Link>
      </form>

      {partners.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground"><th className="border-b border-border px-3 py-3">Company Name</th><th className="border-b border-border px-3 py-3">Vendor Code</th><th className="border-b border-border px-3 py-3">Tax ID / MST</th><th className="border-b border-border px-3 py-3">Address</th><th className="border-b border-border px-3 py-3">Status</th><th className="border-b border-border px-3 py-3">Categories</th><th className="border-b border-border px-3 py-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{partners.map((partner) => <tr className="align-top hover:bg-muted/40" key={partner.id}><td className="border-b border-border/60 px-3 py-3 font-medium text-foreground">{partner.companyName}</td><td className="border-b border-border/60 px-3 py-3 text-muted-foreground">{partner.vendorCode ?? "—"}</td><td className="border-b border-border/60 px-3 py-3 text-muted-foreground">{partner.taxId ?? "—"}</td><td className="max-w-xs border-b border-border/60 px-3 py-3 text-muted-foreground">{partner.address ?? "—"}</td><td className="border-b border-border/60 px-3 py-3"><PartnerStatusBadge deletedAt={partner.deletedAt} isActive={partner.isActive} /></td><td className="border-b border-border/60 px-3 py-3 text-muted-foreground">{partner.categories.map((category) => category.name).join(", ") || "—"}</td><td className="border-b border-border/60 px-3 py-3"><Link className="font-medium text-indigo-700 hover:underline dark:text-indigo-300" href={`/admin/master-data/partners/${partner.id}`}>Manage</Link></td></tr>)}</tbody>
          </table>
        </div>
      ) : <EmptyState title="No Partners found" description="Adjust the filters or create an official reusable Partner record."><Link className="rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500" href="/admin/master-data/partners/new">New Partner</Link></EmptyState>}

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <span>Page {parsed.data.page}</span>
        <div className="flex gap-2"><Link aria-disabled={parsed.data.page <= 1} className={`rounded-md border border-border px-3 py-2 font-medium ${parsed.data.page > 1 ? "hover:bg-muted" : "pointer-events-none opacity-50"}`} href={buildPageHref({ search: parsed.data.search, status: parsed.data.status, page: parsed.data.page - 1 })}>Previous</Link><Link aria-disabled={!hasNext} className={`rounded-md border border-border px-3 py-2 font-medium ${hasNext ? "hover:bg-muted" : "pointer-events-none opacity-50"}`} href={buildPageHref({ search: parsed.data.search, status: parsed.data.status, page: parsed.data.page + 1 })}>Next</Link></div>
      </div>
    </PageContainer>
  );
}
