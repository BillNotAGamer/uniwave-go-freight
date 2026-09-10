import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { db } from "@/lib/db/client";
import {
  shippingNoteDocuments,
  type User as DbUser,
} from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import { getShippingNoteForUser } from "../queries";
import { canMutateShippingNoteDocuments } from "./policy";
import type { ShippingNoteDocumentListItem } from "./types";
import {
  registerShippingNoteDocumentInputSchema,
  removeShippingNoteDocumentInputSchema,
  type RegisterShippingNoteDocumentInput,
  type RemoveShippingNoteDocumentInput,
} from "./validators";

const documentListColumns = {
  id: shippingNoteDocuments.id,
  shippingNoteId: shippingNoteDocuments.shippingNoteId,
  documentType: shippingNoteDocuments.documentType,
  originalFileName: shippingNoteDocuments.originalFileName,
  storageProvider: shippingNoteDocuments.storageProvider,
  mimeType: shippingNoteDocuments.mimeType,
  sizeBytes: shippingNoteDocuments.sizeBytes,
  uploadedById: shippingNoteDocuments.uploadedById,
  createdAt: shippingNoteDocuments.createdAt,
} as const;

export async function registerShippingNoteDocumentMetadata(
  input: RegisterShippingNoteDocumentInput,
  user: DbUser,
): Promise<ShippingNoteDocumentListItem> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  const normalized = registerShippingNoteDocumentInputSchema.parse(input);
  const note = await getShippingNoteForUser(normalized.shippingNoteId, user);

  if (!note || !canMutateShippingNoteDocuments(note, user)) {
    throw new AuthorizationError();
  }

  return db.transaction(async (tx) => {
    const [duplicate] = await tx
      .select({ id: shippingNoteDocuments.id })
      .from(shippingNoteDocuments)
      .where(
        and(
          eq(shippingNoteDocuments.storageProvider, normalized.storageProvider),
          eq(shippingNoteDocuments.storageKey, normalized.storageKey),
          isNull(shippingNoteDocuments.deletedAt),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new Error("Storage object is already registered.");
    }

    const [created] = await tx
      .insert(shippingNoteDocuments)
      .values({
        ...normalized,
        uploadedById: user.id,
      })
      .returning(documentListColumns);

    if (!created) {
      throw new Error("Failed to register document metadata.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note.document.add",
      entityType: "shipping_note",
      entityId: normalized.shippingNoteId,
      after: {
        documentId: created.id,
        documentType: created.documentType,
        originalFileName: created.originalFileName,
        storageProvider: created.storageProvider,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
      },
    });

    return created;
  });
}

export async function softDeleteShippingNoteDocument(
  input: RemoveShippingNoteDocumentInput,
  user: DbUser,
): Promise<void> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  const normalized = removeShippingNoteDocumentInputSchema.parse(input);
  const note = await getShippingNoteForUser(normalized.shippingNoteId, user);

  if (!note || !canMutateShippingNoteDocuments(note, user)) {
    throw new AuthorizationError();
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: shippingNoteDocuments.id,
        documentType: shippingNoteDocuments.documentType,
        originalFileName: shippingNoteDocuments.originalFileName,
        storageProvider: shippingNoteDocuments.storageProvider,
      })
      .from(shippingNoteDocuments)
      .where(
        and(
          eq(shippingNoteDocuments.id, normalized.id),
          eq(shippingNoteDocuments.shippingNoteId, normalized.shippingNoteId),
          isNull(shippingNoteDocuments.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AuthorizationError();
    }

    await tx
      .update(shippingNoteDocuments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(shippingNoteDocuments.id, normalized.id),
          isNull(shippingNoteDocuments.deletedAt),
        ),
      );

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note.document.remove",
      entityType: "shipping_note",
      entityId: normalized.shippingNoteId,
      before: {
        documentId: existing.id,
        documentType: existing.documentType,
        originalFileName: existing.originalFileName,
        storageProvider: existing.storageProvider,
      },
    });
  });
}
