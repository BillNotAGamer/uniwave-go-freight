import "server-only";

import { and, asc, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  routingLocations,
  type User as DbUser,
} from "@/lib/db/schema";

import type { RoutingLocationLifecycleStatus } from "./constants";
import { assertCanMutateLocations, assertCanReadLocations } from "./permissions";
import type { ListRoutingLocationsFilter, RoutingLocationDetail } from "./types";
import { listRoutingLocationsFilterSchema, searchRoutingLocationsInputSchema } from "./validators";

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function lifecycleCondition(status: RoutingLocationLifecycleStatus): SQL | undefined {
  switch (status) {
    case "active":
      return and(isNull(routingLocations.deletedAt), eq(routingLocations.isActive, true));
    case "inactive":
      return and(isNull(routingLocations.deletedAt), eq(routingLocations.isActive, false));
    case "deleted":
      return isNotNull(routingLocations.deletedAt);
    case "all":
      return undefined;
  }
}

export async function listRoutingLocationsForAdmin(
  filter: ListRoutingLocationsFilter,
  actor: DbUser,
): Promise<RoutingLocationDetail[]> {
  assertCanMutateLocations(actor);
  const parsed = listRoutingLocationsFilterSchema.parse(filter);
  const conditions: SQL[] = [];
  const lifecycle = lifecycleCondition(parsed.status);
  if (lifecycle) conditions.push(lifecycle);
  if (parsed.type) conditions.push(eq(routingLocations.type, parsed.type));
  if (parsed.search) {
    const pattern = `%${escapeLike(parsed.search)}%`;
    const searchCondition = or(
      ilike(routingLocations.code, pattern),
      ilike(routingLocations.name, pattern),
      ilike(routingLocations.countryCode, pattern),
      ilike(routingLocations.subdivision, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const locations = await db
    .select({
      id: routingLocations.id,
      code: routingLocations.code,
      name: routingLocations.name,
      type: routingLocations.type,
      countryCode: routingLocations.countryCode,
      subdivision: routingLocations.subdivision,
      isActive: routingLocations.isActive,
      createdAt: routingLocations.createdAt,
      updatedAt: routingLocations.updatedAt,
      deletedAt: routingLocations.deletedAt,
    })
    .from(routingLocations)
    .where(and(...conditions))
    .orderBy(asc(routingLocations.code), asc(routingLocations.name), asc(routingLocations.id))
    .limit(parsed.limit)
    .offset(parsed.offset);

  return locations;
}

export async function getRoutingLocationByIdForAdmin(
  id: string,
  actor: DbUser,
): Promise<RoutingLocationDetail | null> {
  assertCanMutateLocations(actor);
  const [location] = await db
    .select({
      id: routingLocations.id,
      code: routingLocations.code,
      name: routingLocations.name,
      type: routingLocations.type,
      countryCode: routingLocations.countryCode,
      subdivision: routingLocations.subdivision,
      isActive: routingLocations.isActive,
      createdAt: routingLocations.createdAt,
      updatedAt: routingLocations.updatedAt,
      deletedAt: routingLocations.deletedAt,
    })
    .from(routingLocations)
    .where(eq(routingLocations.id, id))
    .limit(1);

  return location ?? null;
}

export async function searchRoutingLocations(
  search: string,
  actor: DbUser,
  options: { limit?: number } = {},
): Promise<RoutingLocationDetail[]> {
  assertCanReadLocations(actor);
  const parsed = searchRoutingLocationsInputSchema.parse({ search, ...options });
  const pattern = `%${escapeLike(parsed.search)}%`;
  const conditions: SQL[] = [
    eq(routingLocations.isActive, true),
    isNull(routingLocations.deletedAt),
    or(ilike(routingLocations.code, pattern), ilike(routingLocations.name, pattern))!,
  ];

  const locations = await db
    .select({
      id: routingLocations.id,
      code: routingLocations.code,
      name: routingLocations.name,
      type: routingLocations.type,
      countryCode: routingLocations.countryCode,
      subdivision: routingLocations.subdivision,
      isActive: routingLocations.isActive,
      createdAt: routingLocations.createdAt,
      updatedAt: routingLocations.updatedAt,
      deletedAt: routingLocations.deletedAt,
    })
    .from(routingLocations)
    .where(and(...conditions))
    .orderBy(asc(routingLocations.code), asc(routingLocations.name), asc(routingLocations.id))
    .limit(parsed.limit);

  return locations;
}
