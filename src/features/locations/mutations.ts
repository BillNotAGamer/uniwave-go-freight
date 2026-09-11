import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import { db, type Database } from "@/lib/db/client";
import {
  routingLocationApplicabilities,
  routingLocations,
  type User as DbUser,
} from "@/lib/db/schema";

import { assertCanMutateLocations } from "./permissions";
import type { RoutingLocationDetail } from "./types";
import {
  createRoutingLocationInputSchema,
  routingLocationIdInputSchema,
  updateRoutingLocationInputSchema,
  type CreateRoutingLocationInput,
  type UpdateRoutingLocationInput,
} from "./validators";

export class RoutingLocationConflictError extends Error {
  readonly code = "ROUTING_LOCATION_TYPE_CODE_DUPLICATE";

  constructor() {
    super("A Location with this type and code already exists.");
    this.name = "RoutingLocationConflictError";
  }
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}

function mapLocationWriteError(error: unknown): never {
  if (isUniqueConstraintError(error)) throw new RoutingLocationConflictError();
  throw error;
}

async function loadDetail(
  tx: Transaction,
  location: Omit<RoutingLocationDetail, "applicabilities">,
): Promise<RoutingLocationDetail> {
  const memberships = await tx
    .select({ applicability: routingLocationApplicabilities.applicability })
    .from(routingLocationApplicabilities)
    .where(eq(routingLocationApplicabilities.locationId, location.id));

  return { ...location, applicabilities: memberships.map((membership) => membership.applicability) };
}

async function replaceApplicabilities(
  tx: Transaction,
  locationId: string,
  applicabilities: RoutingLocationDetail["applicabilities"],
  now: Date,
): Promise<void> {
  await tx.delete(routingLocationApplicabilities)
    .where(eq(routingLocationApplicabilities.locationId, locationId));
  for (const applicability of applicabilities) {
    await tx.insert(routingLocationApplicabilities).values({
      id: randomUUID(),
      locationId,
      applicability,
      createdAt: now,
    });
  }
}

export async function createRoutingLocation(
  input: CreateRoutingLocationInput,
  actor: DbUser,
): Promise<RoutingLocationDetail> {
  assertCanMutateLocations(actor);
  const parsed = createRoutingLocationInputSchema.parse(input);

  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const [location] = await tx.insert(routingLocations).values({
        id: randomUUID(),
        code: parsed.code,
        name: parsed.name,
        type: parsed.type,
        countryCode: parsed.countryCode ?? null,
        subdivision: parsed.subdivision ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).returning();
      if (!location) throw new Error("Failed to create routing Location.");

      for (const applicability of parsed.applicabilities) {
        await tx.insert(routingLocationApplicabilities).values({
          id: randomUUID(),
          locationId: location.id,
          applicability,
          createdAt: now,
        });
      }

      const detail = await loadDetail(tx, location);
      await logAuditEvent(tx, {
        actorUserId: actor.id,
        action: "routing_location.create",
        entityType: "routing_location",
        entityId: detail.id,
        after: detail,
      });
      return detail;
    });
  } catch (error) {
    return mapLocationWriteError(error);
  }
}

export async function updateRoutingLocation(
  id: string,
  input: UpdateRoutingLocationInput,
  actor: DbUser,
): Promise<RoutingLocationDetail> {
  assertCanMutateLocations(actor);
  const parsed = updateRoutingLocationInputSchema.parse({ ...input, id });

  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(routingLocations)
        .where(and(eq(routingLocations.id, id), isNull(routingLocations.deletedAt))).limit(1);
      if (!current) throw new Error("Routing Location not found or has been deactivated.");
      const before = await loadDetail(tx, current);
      const now = new Date();
      const [updated] = await tx.update(routingLocations).set({
        code: parsed.code,
        name: parsed.name,
        type: parsed.type,
        countryCode: parsed.countryCode ?? null,
        subdivision: parsed.subdivision ?? null,
        updatedAt: now,
      }).where(eq(routingLocations.id, id)).returning();
      if (!updated) throw new Error("Failed to update routing Location.");

      await replaceApplicabilities(tx, id, parsed.applicabilities, now);
      const detail = await loadDetail(tx, updated);
      await logAuditEvent(tx, {
        actorUserId: actor.id,
        action: "routing_location.update",
        entityType: "routing_location",
        entityId: id,
        before,
        after: detail,
      });
      return detail;
    });
  } catch (error) {
    return mapLocationWriteError(error);
  }
}

export async function deactivateRoutingLocation(
  id: string,
  actor: DbUser,
): Promise<RoutingLocationDetail> {
  assertCanMutateLocations(actor);
  routingLocationIdInputSchema.parse({ id });

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(routingLocations)
      .where(and(eq(routingLocations.id, id), isNull(routingLocations.deletedAt))).limit(1);
    if (!current) throw new Error("Routing Location not found or already deactivated.");
    const before = await loadDetail(tx, current);
    const now = new Date();
    const [updated] = await tx.update(routingLocations).set({
      isActive: false,
      deletedAt: now,
      updatedAt: now,
    }).where(eq(routingLocations.id, id)).returning();
    if (!updated) throw new Error("Failed to deactivate routing Location.");
    const detail = await loadDetail(tx, updated);
    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "routing_location.deactivate",
      entityType: "routing_location",
      entityId: id,
      before,
      after: detail,
    });
    return detail;
  });
}

export async function restoreRoutingLocation(
  id: string,
  actor: DbUser,
): Promise<RoutingLocationDetail> {
  assertCanMutateLocations(actor);
  routingLocationIdInputSchema.parse({ id });

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(routingLocations)
      .where(eq(routingLocations.id, id)).limit(1);
    if (!current) throw new Error("Routing Location not found.");
    const before = await loadDetail(tx, current);
    const now = new Date();
    const [updated] = await tx.update(routingLocations).set({
      isActive: true,
      deletedAt: null,
      updatedAt: now,
    }).where(eq(routingLocations.id, id)).returning();
    if (!updated) throw new Error("Failed to restore routing Location.");
    const detail = await loadDetail(tx, updated);
    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "routing_location.restore",
      entityType: "routing_location",
      entityId: id,
      before,
      after: detail,
    });
    return detail;
  });
}
