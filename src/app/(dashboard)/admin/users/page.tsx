import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/feedback";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { ROLE_LABELS, ROLES } from "@/lib/permissions/roles";
import { AdminUsersTable } from "@/features/admin/users/components/admin-users-table";
import { listAdminUsersForUser } from "@/features/admin/users/read-model";
import {
  ADMIN_USER_STATUS_FILTERS,
  type AdminUserStatusFilter,
} from "@/features/admin/users/types";
import {
  adminUsersListQuerySchema,
} from "@/features/admin/users/validators";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildPageHref(input: {
  search?: string;
  role?: string;
  status?: AdminUserStatusFilter;
  page: number;
}) {
  const params = new URLSearchParams();

  if (input.search) params.set("search", input.search);
  if (input.role) params.set("role", input.role);
  if (input.status) params.set("status", input.status);
  params.set("page", String(input.page));

  return `/admin/users?${params.toString()}`;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const { user } = await requireAuthenticatedUser();

  if (!hasPermission(user.role, PERMISSIONS.USERS_MANAGE)) {
    notFound();
  }

  const rawSearchParams = await searchParams;
  const parsedQuery = adminUsersListQuerySchema.safeParse({
    search: firstValue(rawSearchParams.search),
    role: firstValue(rawSearchParams.role),
    status: firstValue(rawSearchParams.status),
    page: firstValue(rawSearchParams.page),
    limit: firstValue(rawSearchParams.limit),
  });

  if (!parsedQuery.success) {
    notFound();
  }

  const result = await listAdminUsersForUser(user, parsedQuery.data);
  const currentPage = Math.floor(result.offset / result.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  const hasPrevious = currentPage > 1;
  const hasNext = result.offset + result.limit < result.total;

  return (
    <PageContainer>
      <PageHeader
        title="Admin Users"
        description="Manage internal user access, account state, and session invalidation."
      />

      <form
        className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-sm lg:grid-cols-[1fr_180px_180px_auto] lg:items-end"
        method="get"
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Search
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.data.search ?? ""}
            name="search"
            placeholder="Name or email"
            type="search"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Role
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.data.role ?? ""}
            name="role"
          >
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Status
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            defaultValue={parsedQuery.data.status ?? ""}
            name="status"
          >
            <option value="">Active and inactive</option>
            {ADMIN_USER_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "all"
                  ? "All"
                  : `${status.slice(0, 1).toUpperCase()}${status.slice(1)}`}
              </option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          type="submit"
        >
          Apply
        </button>
      </form>

      {result.items.length > 0 ? (
        <AdminUsersTable actorUserId={user.id} users={result.items} />
      ) : (
        <EmptyState
          title="No users found"
          description="Adjust the filters or create a new internal user."
        />
      )}

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm text-slate-700 shadow-sm dark:text-slate-300">
        <span>
          Page {currentPage} of {totalPages} - {result.total} users
        </span>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={!hasPrevious}
            className={`rounded-md border border-slate-300 px-3 py-2 font-medium dark:border-slate-700 ${
              hasPrevious
                ? "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                : "pointer-events-none text-slate-400 dark:text-slate-600"
            }`}
            href={buildPageHref({
              search: parsedQuery.data.search,
              role: parsedQuery.data.role,
              status: parsedQuery.data.status,
              page: currentPage - 1,
            })}
          >
            Previous
          </Link>
          <Link
            aria-disabled={!hasNext}
            className={`rounded-md border border-slate-300 px-3 py-2 font-medium dark:border-slate-700 ${
              hasNext
                ? "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                : "pointer-events-none text-slate-400 dark:text-slate-600"
            }`}
            href={buildPageHref({
              search: parsedQuery.data.search,
              role: parsedQuery.data.role,
              status: parsedQuery.data.status,
              page: currentPage + 1,
            })}
          >
            Next
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
