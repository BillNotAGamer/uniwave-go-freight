import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import type { ArtifactStorage } from "@/lib/artifact-storage/types";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { db } from "@/lib/db/client";
import {
  shippingNoteDocuments,
  shippingNoteExports,
  shippingNotes,
  type User as DbUser,
} from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/permissions/require-permission";

import { deleteExactArtifactKeys } from "./artifact-cleanup";
import { getShippingNoteForUser } from "./queries";
import {
  hardDeleteShippingNoteInputSchema,
  type HardDeleteShippingNoteInput,
} from "./validators";

export type HardDeleteShippingNoteResult = {
  id: string;
  documentArtifactCount: number;
  exportArtifactCount: number;
};

export type HardDeleteShippingNoteDependencies = {
  storage?: ArtifactStorage;
};

export async function hardDeleteShippingNote(
  input: HardDeleteShippingNoteInput,
  user: DbUser,
  dependencies: HardDeleteShippingNoteDependencies = {},
): Promise<HardDeleteShippingNoteResult> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }
  requirePermission(user.role, PERMISSIONS.ADMIN_DESTRUCTIVE_ACTIONS);

  const normalized = hardDeleteShippingNoteInputSchema.parse(input);
  const authorizedNote = await getShippingNoteForUser(normalized.id, user);
  if (!authorizedNote) {
    throw new AuthorizationError();
  }

  let result: {
    id: string;
    documentKeys: string[];
    exportKeys: string[];
  };

  try {
    result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: shippingNotes.id,
        jobsheetNo: shippingNotes.jobsheetNo,
        shippingMode: shippingNotes.shippingMode,
      })
      .from(shippingNotes)
      .where(eq(shippingNotes.id, normalized.id))
      .limit(1);

    if (!current) {
      throw new AuthorizationError();
    }

    const documents = await tx
      .select({ storageKey: shippingNoteDocuments.storageKey })
      .from(shippingNoteDocuments)
      .where(
        and(
          eq(shippingNoteDocuments.shippingNoteId, current.id),
          eq(shippingNoteDocuments.storageProvider, "r2"),
        ),
      );
    const exports = await tx
      .select({ storageKey: shippingNoteExports.artifactStorageKey })
      .from(shippingNoteExports)
      .where(
        and(
          eq(shippingNoteExports.shippingNoteId, current.id),
          isNotNull(shippingNoteExports.artifactStorageKey),
        ),
      );

    const [deleted] = await tx
      .delete(shippingNotes)
      .where(eq(shippingNotes.id, current.id))
      .returning({ id: shippingNotes.id });

    if (!deleted) {
      throw new Error("Failed to delete shipping note.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note.hard_delete",
      entityType: "shipping_note",
      entityId: deleted.id,
      before: {
        jobsheetNo: current.jobsheetNo,
        shippingMode: current.shippingMode,
        documentArtifactCount: documents.length,
        exportArtifactCount: exports.length,
      },
      reason: normalized.reason,
    });

    return {
      id: deleted.id,
      documentKeys: documents.map((document) => document.storageKey),
      exportKeys: exports.flatMap((artifact) =>
        artifact.storageKey ? [artifact.storageKey] : []),
    };
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }
    throw new Error("Shipping Note deletion failed.");
  }

  const cleanup = await deleteExactArtifactKeys(
    [...result.documentKeys, ...result.exportKeys],
    dependencies.storage,
  );

  if (cleanup.failedKeyCount > 0) {
    try {
      await logAuditEvent(db, {
        actorUserId: user.id,
        action: "shipping_note.hard_delete.cleanup_failed",
        entityType: "shipping_note",
        entityId: result.id,
        after: {
          attemptedKeyCount: cleanup.attemptedKeyCount,
          failedKeyCount: cleanup.failedKeyCount,
        },
        reason: normalized.reason,
      });
    } catch {
      // The completed hard-delete audit event remains durable from its DB transaction.
    }

    throw new Error(
      "Shipping Note was deleted, but private artifact cleanup failed. An audit event was recorded.",
    );
  }

  return {
    id: result.id,
    documentArtifactCount: result.documentKeys.length,
    exportArtifactCount: result.exportKeys.length,
  };
}
