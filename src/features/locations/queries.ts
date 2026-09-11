import "server-only";

import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  routingLocationApplicabilities,
  routingLocations,
  type User as DbUser,
} from "@/lib/db/schema";

import type { RoutingLocationApplicability, RoutingLocationLifecycleStatus } from "./constants";
import { assertCanMutateLocations, assertCanReadLocations } from "./permissions";
import type { ListRoutingLocationsFilter, RoutingLocationDetail } from "./types";
import { listRoutingLocationsFilterSchema, searchRoutingLocationsInputSchema } from "./validators";

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

async function appendApplicabilities<T extends Omit<RoutingLocationDetail, "applicabilities">>(
  locations: T[],
): Promise<RoutingLocationDetail[]> {
  if (locations.length === 0) return [];

  const memberships = await db
    .select({
      locationId: routingLocationApplicabilities.locationId,
      applicability: routingLocationApplicabilities.applicability,
    })
    .from(routingLocationApplicabilities)
    .where(inArray(routingLocationApplicabilities.locationId, locations.map((location) => location.id)))
    .orderBy(asc(routingLocationApplicabilities.applicability));

  const byLocationId = new Map<string, RoutingLocationApplicability[]>();
  for (const membership of memberships) {
    const current = byLocationId.get(membership.locationId) ?? [];
    current.push(membership.applicability);
    byLocationId.set(membership.locationId, current);
  }

  return locations.map((location) => ({
    ...location,
    applicabilities: byLocationId.get(location.id) ?? [],
  }));
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

  return appendApplicabilities(locations);
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

  if (!location) return null;
  const [detail] = await appendApplicabilities([location]);
  return detail ?? null;
}

export async function searchRoutingLocations(
  search: string,
  actor: DbUser,
  options: { applicability?: RoutingLocationApplicability; type?: RoutingLocationDetail["type"]; limit?: number } = {},
): Promise<RoutingLocationDetail[]> {
  assertCanReadLocations(actor);
  const parsed = searchRoutingLocationsInputSchema.parse({ search, ...options });
  const pattern = `%${escapeLike(parsed.search)}%`;
  const conditions: SQL[] = [
    eq(routingLocations.isActive, true),
    isNull(routingLocations.deletedAt),
    or(ilike(routingLocations.code, pattern), ilike(routingLocations.name, pattern))!,
  ];
  if (parsed.type) conditions.push(eq(routingLocations.type, parsed.type));
  if (parsed.applicability) {
    const applicableLocations = db
      .select({ locationId: routingLocationApplicabilities.locationId })
      .from(routingLocationApplicabilities)
      .where(eq(routingLocationApplicabilities.applicability, parsed.applicability));
    conditions.push(inArray(routingLocations.id, applicableLocations));
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
    .limit(parsed.limit);

  return appendApplicabilities(locations);
}
