import "server-only";

import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { db } from "@/lib/db/client";
import { serviceCatalogItems, type User as DbUser } from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";

import type { ServiceCatalogLookupItem } from "./types";

export const SERVICE_CATALOG_LOOKUP_LIMIT = 12;

const serviceCatalogLookupSchema = z.object({
  search: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(20),
});

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function requireCatalogLookupAccess(user: DbUser): void {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  requireAnyPermission(user.role, [
    PERMISSIONS.SHIPPING_NOTES_EDIT_OWN,
    PERMISSIONS.BUYING_CHARGES_MANAGE,
  ]);
}

export async function searchServiceCatalogItems(
  search: string,
  user: DbUser,
  limit = SERVICE_CATALOG_LOOKUP_LIMIT,
): Promise<ServiceCatalogLookupItem[]> {
  requireCatalogLookupAccess(user);
  const input = serviceCatalogLookupSchema.parse({ search, limit });
  const pattern = `%${escapeLikePattern(input.search)}%`;

  return db
    .select({
      id: serviceCatalogItems.id,
      code: serviceCatalogItems.code,
      name: serviceCatalogItems.name,
      primaryUnit: serviceCatalogItems.primaryUnit,
      vatRate: serviceCatalogItems.vatRate,
    })
    .from(serviceCatalogItems)
    .where(
      and(
        eq(serviceCatalogItems.isActive, true),
        isNull(serviceCatalogItems.deletedAt),
        or(
          ilike(serviceCatalogItems.code, pattern),
          ilike(serviceCatalogItems.name, pattern),
        ),
      ),
    )
    .orderBy(asc(serviceCatalogItems.code), asc(serviceCatalogItems.id))
    .limit(input.limit);
}
