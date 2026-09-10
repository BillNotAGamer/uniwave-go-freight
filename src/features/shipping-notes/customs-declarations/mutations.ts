import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  shippingNoteCustomsDeclarations,
  type User as DbUser,
} from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";

import { getShippingNoteForUser } from "../queries";
import { canMutateBuyingChargeAtStatus } from "../status-policy";
import type { CustomsDeclarationDetail } from "./types";
import {
  addCustomsDeclarationInputSchema,
  removeCustomsDeclarationInputSchema,
  type AddCustomsDeclarationInput,
  type RemoveCustomsDeclarationInput,
} from "./validators";

const declarationColumns = {
  id: shippingNoteCustomsDeclarations.id,
  shippingNoteId: shippingNoteCustomsDeclarations.shippingNoteId,
  declarationNo: shippingNoteCustomsDeclarations.declarationNo,
  createdAt: shippingNoteCustomsDeclarations.createdAt,
  updatedAt: shippingNoteCustomsDeclarations.updatedAt,
} as const;

function requireAccountingActor(user: DbUser): void {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }
  requireAnyPermission(user.role, PERMISSIONS.BUYING_CHARGES_MANAGE);
}

async function requireMutableAccountingNote(
  shippingNoteId: string,
  user: DbUser,
): Promise<void> {
  const note = await getShippingNoteForUser(shippingNoteId, user);
  if (!note || !canMutateBuyingChargeAtStatus(note.status)) {
    throw new AuthorizationError();
  }
}

export async function addCustomsDeclaration(
  input: AddCustomsDeclarationInput,
  user: DbUser,
): Promise<CustomsDeclarationDetail> {
  requireAccountingActor(user);
  const normalized = addCustomsDeclarationInputSchema.parse(input);
  await requireMutableAccountingNote(normalized.shippingNoteId, user);

  return db.transaction(async (tx) => {
    const [duplicate] = await tx
      .select({ id: shippingNoteCustomsDeclarations.id })
      .from(shippingNoteCustomsDeclarations)
      .where(
        and(
          eq(
            shippingNoteCustomsDeclarations.shippingNoteId,
            normalized.shippingNoteId,
          ),
          eq(
            shippingNoteCustomsDeclarations.declarationNo,
            normalized.declarationNo,
          ),
          isNull(shippingNoteCustomsDeclarations.deletedAt),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new Error("Customs Declaration No already exists for this Shipping Note.");
    }

    const [created] = await tx
      .insert(shippingNoteCustomsDeclarations)
      .values(normalized)
      .returning(declarationColumns);

    if (!created) {
      throw new Error("Failed to add Customs Declaration No.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note.customs_declaration.add",
      entityType: "shipping_note",
      entityId: normalized.shippingNoteId,
      after: created,
    });

    return created;
  });
}

export async function removeCustomsDeclaration(
  input: RemoveCustomsDeclarationInput,
  user: DbUser,
): Promise<void> {
  requireAccountingActor(user);
  const normalized = removeCustomsDeclarationInputSchema.parse(input);
  await requireMutableAccountingNote(normalized.shippingNoteId, user);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select(declarationColumns)
      .from(shippingNoteCustomsDeclarations)
      .where(
        and(
          eq(shippingNoteCustomsDeclarations.id, normalized.id),
          eq(
            shippingNoteCustomsDeclarations.shippingNoteId,
            normalized.shippingNoteId,
          ),
          isNull(shippingNoteCustomsDeclarations.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AuthorizationError();
    }

    const [removed] = await tx
      .update(shippingNoteCustomsDeclarations)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(shippingNoteCustomsDeclarations.id, normalized.id),
          isNull(shippingNoteCustomsDeclarations.deletedAt),
        ),
      )
      .returning({ id: shippingNoteCustomsDeclarations.id });

    if (!removed) {
      throw new AuthorizationError();
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note.customs_declaration.remove",
      entityType: "shipping_note",
      entityId: normalized.shippingNoteId,
      before: existing,
    });
  });
}

