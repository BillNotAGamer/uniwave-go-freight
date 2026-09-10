import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import { sessions, users, type User as DbUser } from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-permission";

import {
  adminUsersListQuerySchema,
  type AdminUsersListQueryInput,
} from "./validators";
import {
  getAdminUserAccountStatus,
} from "./policy";
import type {
  AdminUserListItem,
  AdminUserListResult,
  AdminUserStatusFilter,
} from "./types";

const adminUserListColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  deletedAt: users.deletedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  activeSessionCount: sql<number>`
    coalesce((
      select count(*)::int
      from ${sessions}
      where ${sessions.userId} = ${users.id}
        and ${sessions.expiresAt} > now()
    ), 0)
  `.mapWith(Number),
} as const;

type AdminUserListRow = {
  id: string;
  name: string;
  email: string;
  role: DbUser["role"];
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  activeSessionCount: number;
};

export function toAdminUserListItem(row: AdminUserListRow): AdminUserListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    accountStatus: getAdminUserAccountStatus(row),
    activeSessionCount: row.activeSessionCount,
  };
}

function searchPattern(search: string): string {
  return `%${search}%`;
}

export function buildAdminUsersListWhere(
  query: AdminUsersListQueryInput,
): SQL | undefined {
  const conditions: SQL[] = [];

  switch (query.status satisfies AdminUserStatusFilter | undefined) {
    case "active":
      conditions.push(eq(users.isActive, true), isNull(users.deletedAt));
      break;
    case "inactive":
      conditions.push(eq(users.isActive, false), isNull(users.deletedAt));
      break;
    case "deleted":
      conditions.push(isNotNull(users.deletedAt));
      break;
    case "all":
      break;
    case undefined:
      conditions.push(isNull(users.deletedAt));
      break;
  }

  if (query.role) {
    conditions.push(eq(users.role, query.role));
  }

  if (query.search) {
    const pattern = searchPattern(query.search);
    const searchCondition = or(
      ilike(users.name, pattern),
      ilike(users.email, pattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listAdminUsersForUser(
  actor: DbUser,
  input: Partial<AdminUsersListQueryInput> = {},
): Promise<AdminUserListResult> {
  requireAnyPermission(actor.role, PERMISSIONS.USERS_MANAGE);

  const query = adminUsersListQuerySchema.parse(input);
  const where = buildAdminUsersListWhere(query);

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int`.mapWith(Number) })
    .from(users)
    .where(where);

  const rows = await db
    .select(adminUserListColumns)
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), asc(users.id))
    .limit(query.limit)
    .offset(query.offset);

  return {
    items: rows.map(toAdminUserListItem),
    total: totalRow?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

