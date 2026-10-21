import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  shippingNoteEditGrants,
  shippingNotes,
  users,
  type User as DbUser,
} from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";

import {
  canIssuePostSubmitEditGrantAtStatus,
  POST_SUBMIT_EDIT_GRANT_STATUSES,
} from "./status-policy";
import type {
  ShippingNoteEditGrantRecipient,
  ShippingNoteEditGrantView,
} from "./types";
import {
  issueShippingNoteEditGrantInputSchema,
  revokeShippingNoteEditGrantInputSchema,
  type IssueShippingNoteEditGrantInput,
  type RevokeShippingNoteEditGrantInput,
} from "./validators";

const recipient = alias(users, "edit_grant_recipient");
const grantIssuer = alias(users, "edit_grant_issuer");
const grantRevoker = alias(users, "edit_grant_revoker");

function requireGrantIssuer(user: DbUser): void {
  requireAnyPermission(user.role, PERMISSIONS.SHIPPING_NOTES_MANAGE_EDIT_GRANTS);
  if (user.role !== "admin" && user.role !== "accountant") {
    throw new AuthorizationError();
  }
}

export async function listEligibleEditGrantRecipients(
  shippingNoteId: string,
  actor: DbUser,
): Promise<ShippingNoteEditGrantRecipient[]> {
  requireGrantIssuer(actor);

  const [note] = await db
    .select({ createdById: shippingNotes.createdById, status: shippingNotes.status })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, shippingNoteId), isNull(shippingNotes.deletedAt)))
    .limit(1);

  if (!note || !canIssuePostSubmitEditGrantAtStatus(note.status) || !note.createdById) {
    return [];
  }

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.id, note.createdById),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(users.name));

  return rows.filter(
    (row): row is ShippingNoteEditGrantRecipient =>
      row.role === "sale" || row.role === "ops",
  );
}

export async function listShippingNoteEditGrantHistory(
  shippingNoteId: string,
  actor: DbUser,
): Promise<ShippingNoteEditGrantView[]> {
  requireGrantIssuer(actor);

  const rows = await db
    .select({
      id: shippingNoteEditGrants.id,
      shippingNoteId: shippingNoteEditGrants.shippingNoteId,
      recipientUserId: shippingNoteEditGrants.recipientUserId,
      recipientName: recipient.name,
      recipientRole: recipient.role,
      grantedById: shippingNoteEditGrants.grantedById,
      grantedByName: grantIssuer.name,
      status: shippingNoteEditGrants.status,
      reason: shippingNoteEditGrants.reason,
      grantedAt: shippingNoteEditGrants.grantedAt,
      revokedAt: shippingNoteEditGrants.revokedAt,
      revokedById: shippingNoteEditGrants.revokedById,
      revokedByName: grantRevoker.name,
      revokeReason: shippingNoteEditGrants.revokeReason,
    })
    .from(shippingNoteEditGrants)
    .innerJoin(recipient, eq(recipient.id, shippingNoteEditGrants.recipientUserId))
    .innerJoin(grantIssuer, eq(grantIssuer.id, shippingNoteEditGrants.grantedById))
    .leftJoin(grantRevoker, eq(grantRevoker.id, shippingNoteEditGrants.revokedById))
    .where(eq(shippingNoteEditGrants.shippingNoteId, shippingNoteId))
    .orderBy(desc(shippingNoteEditGrants.grantedAt));

  return rows.filter(
    (row): row is ShippingNoteEditGrantView =>
      row.recipientRole === "sale" || row.recipientRole === "ops",
  );
}

export async function hasActivePostSubmitEditGrant(
  shippingNoteId: string,
  actor: DbUser,
): Promise<boolean> {
  if (actor.role !== "sale" && actor.role !== "ops") {
    return false;
  }

  const [grant] = await db
    .select({ id: shippingNoteEditGrants.id })
    .from(shippingNoteEditGrants)
    .innerJoin(shippingNotes, eq(shippingNotes.id, shippingNoteEditGrants.shippingNoteId))
    .innerJoin(users, eq(users.id, shippingNoteEditGrants.recipientUserId))
    .where(
      and(
        eq(shippingNoteEditGrants.shippingNoteId, shippingNoteId),
        eq(shippingNoteEditGrants.recipientUserId, actor.id),
        eq(shippingNoteEditGrants.status, "active"),
        eq(shippingNotes.createdById, actor.id),
        inArray(shippingNotes.status, [...POST_SUBMIT_EDIT_GRANT_STATUSES]),
        isNull(shippingNotes.deletedAt),
        eq(users.isActive, true),
        isNull(users.deletedAt),
        eq(users.role, actor.role),
      ),
    )
    .limit(1);

  return Boolean(grant);
}

export async function issueShippingNoteEditGrant(
  input: IssueShippingNoteEditGrantInput,
  actor: DbUser,
): Promise<{ id: string; shippingNoteId: string; recipientUserId: string }> {
  requireGrantIssuer(actor);
  const parsed = issueShippingNoteEditGrantInputSchema.parse(input);

  return db.transaction(async (tx) => {
    const [note] = await tx
      .select({ id: shippingNotes.id, createdById: shippingNotes.createdById, status: shippingNotes.status })
      .from(shippingNotes)
      .where(and(eq(shippingNotes.id, parsed.shippingNoteId), isNull(shippingNotes.deletedAt)))
      .limit(1)
      .for("update");

    if (!note || !canIssuePostSubmitEditGrantAtStatus(note.status)) {
      throw new AuthorizationError();
    }

    const [targetUser] = await tx
      .select({ id: users.id, role: users.role, isActive: users.isActive, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, parsed.recipientUserId))
      .limit(1)
      .for("share");

    if (
      !targetUser ||
      !targetUser.isActive ||
      targetUser.deletedAt ||
      (targetUser.role !== "sale" && targetUser.role !== "ops") ||
      targetUser.id === actor.id ||
      note.createdById !== targetUser.id
    ) {
      throw new AuthorizationError();
    }

    const [created] = await tx
      .insert(shippingNoteEditGrants)
      .values({
        shippingNoteId: note.id,
        recipientUserId: targetUser.id,
        grantedById: actor.id,
        reason: parsed.reason ?? null,
      })
      .onConflictDoNothing()
      .returning({
        id: shippingNoteEditGrants.id,
        shippingNoteId: shippingNoteEditGrants.shippingNoteId,
        recipientUserId: shippingNoteEditGrants.recipientUserId,
      });

    if (!created) {
      throw new Error("This user already has an active edit grant for this Shipping Note.");
    }

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "shipping_note.edit_grant_issued",
      entityType: "shipping_note",
      entityId: note.id,
      after: { grantId: created.id, recipientUserId: created.recipientUserId, status: "active" },
      reason: parsed.reason ?? null,
    });

    return created;
  });
}

export async function revokeShippingNoteEditGrant(
  input: RevokeShippingNoteEditGrantInput,
  actor: DbUser,
): Promise<void> {
  requireGrantIssuer(actor);
  const parsed = revokeShippingNoteEditGrantInputSchema.parse(input);

  await db.transaction(async (tx) => {
    const [grant] = await tx
      .select({
        id: shippingNoteEditGrants.id,
        shippingNoteId: shippingNoteEditGrants.shippingNoteId,
        recipientUserId: shippingNoteEditGrants.recipientUserId,
        status: shippingNoteEditGrants.status,
        grantedById: shippingNoteEditGrants.grantedById,
        grantedAt: shippingNoteEditGrants.grantedAt,
      })
      .from(shippingNoteEditGrants)
      .where(
        and(
          eq(shippingNoteEditGrants.id, parsed.grantId),
          eq(shippingNoteEditGrants.shippingNoteId, parsed.shippingNoteId),
        ),
      )
      .limit(1)
      .for("update");

    if (!grant) {
      throw new AuthorizationError();
    }

    if (grant.status === "revoked") {
      return;
    }

    const revokedAt = new Date();
    const [revoked] = await tx
      .update(shippingNoteEditGrants)
      .set({
        status: "revoked",
        revokedAt,
        revokedById: actor.id,
        revokeReason: parsed.reason ?? null,
      })
      .where(
        and(
          eq(shippingNoteEditGrants.id, grant.id),
          eq(shippingNoteEditGrants.status, "active"),
        ),
      )
      .returning({ id: shippingNoteEditGrants.id });

    if (!revoked) {
      throw new AuthorizationError();
    }

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "shipping_note.edit_grant_revoked",
      entityType: "shipping_note",
      entityId: grant.shippingNoteId,
      before: { ...grant, status: "active" },
      after: { grantId: grant.id, recipientUserId: grant.recipientUserId, status: "revoked", revokedAt },
      reason: parsed.reason ?? null,
    });
  });
}
