import "server-only";

import { and, eq, inArray, lte, type SQL } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  shippingNoteExports,
  shippingNotes,
  type ShippingNoteExport,
} from "@/lib/db/schema";
import type { User as DbUser } from "@/lib/db/schema";
import type { DriveErrorCode } from "@/lib/drive/errors";
import type { DriveFileRecord } from "@/lib/drive/types";
import type {
  DriveUploadExportContract,
  DriveUploadNoteContract,
} from "./policy";

export type DriveUploadLoadedExport = {
  exportRecord: ShippingNoteExport;
  note: DriveUploadNoteContract;
};

export type DriveUploadSuccessInput = {
  exportRecord: DriveUploadExportContract;
  note: DriveUploadNoteContract;
  user: DbUser;
  file: DriveFileRecord;
  folderId: string;
  uploadedAt: Date;
  reconciledFromDrive: boolean;
  retryCount: number;
  staleCutoff?: Date;
};

export type DriveUploadFailureInput = {
  exportRecord: DriveUploadExportContract;
  note: DriveUploadNoteContract;
  user: DbUser;
  code: DriveErrorCode;
  folderId: string;
  failedAt: Date;
  retryCount: number;
  staleCutoff?: Date;
};

export interface DriveUploadRepository {
  loadExportForDriveUpload(exportId: string): Promise<DriveUploadLoadedExport | null>;
  claimDriveUpload(exportId: string, claimTime?: Date): Promise<boolean>;
  markDriveUploadSucceeded(
    input: DriveUploadSuccessInput,
  ): Promise<ShippingNoteExport>;
  markDriveUploadFailed(
    input: DriveUploadFailureInput,
  ): Promise<ShippingNoteExport>;
}

function buildDriveAuditSnapshot(input: {
  exportRecord: DriveUploadExportContract;
  note: DriveUploadNoteContract;
  driveFileId?: string | null;
  driveFolderId: string;
  driveUploadStatus: "uploaded" | "upload_failed";
  driveErrorMessage?: DriveErrorCode | null;
  reconciledFromDrive: boolean;
  retryCount: number;
}) {
  return {
    exportId: input.exportRecord.id,
    shippingNoteId: input.exportRecord.shippingNoteId,
    exportType: input.exportRecord.exportType,
    version: input.exportRecord.version,
    checksum: input.exportRecord.checksum,
    driveUploadStatus: input.driveUploadStatus,
    driveFileId: input.driveFileId ?? null,
    driveFolderId: input.driveFolderId,
    driveErrorMessage: input.driveErrorMessage ?? null,
    currentShippingNoteStatus: input.note.status,
    reconciledFromDrive: input.reconciledFromDrive,
    retryCount: input.retryCount,
  };
}

function driveUploadingConditions(
  exportId: string,
  staleCutoff?: Date,
): SQL[] {
  const conditions = [
    eq(shippingNoteExports.id, exportId),
    eq(shippingNoteExports.driveUploadStatus, "uploading"),
  ];

  if (staleCutoff) {
    conditions.push(lte(shippingNoteExports.updatedAt, staleCutoff));
  }

  return conditions;
}

export const productionDriveUploadRepository: DriveUploadRepository = {
  async loadExportForDriveUpload(exportId) {
    const [row] = await db
      .select({
        exportRecord: shippingNoteExports,
        note: {
          id: shippingNotes.id,
          status: shippingNotes.status,
          deletedAt: shippingNotes.deletedAt,
        },
      })
      .from(shippingNoteExports)
      .innerJoin(
        shippingNotes,
        eq(shippingNotes.id, shippingNoteExports.shippingNoteId),
      )
      .where(eq(shippingNoteExports.id, exportId))
      .limit(1);

    return row ?? null;
  },

  async claimDriveUpload(exportId, claimTime = new Date()) {
    const [claimed] = await db
      .update(shippingNoteExports)
      .set({
        driveUploadStatus: "uploading",
        driveErrorMessage: null,
        updatedAt: claimTime,
      })
      .where(
        and(
          eq(shippingNoteExports.id, exportId),
          inArray(shippingNoteExports.driveUploadStatus, [
            "not_uploaded",
            "upload_failed",
          ]),
        ),
      )
      .returning({ id: shippingNoteExports.id });

    return Boolean(claimed);
  },

  async markDriveUploadSucceeded(input) {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNoteExports)
        .set({
          driveUploadStatus: "uploaded",
          driveFileId: input.file.id,
          driveUrl: input.file.webViewLink,
          driveUploadedAt: input.uploadedAt,
          driveFolderId: input.folderId,
          driveErrorMessage: null,
          updatedAt: input.uploadedAt,
        })
        .where(and(
          ...driveUploadingConditions(
            input.exportRecord.id,
            input.staleCutoff,
          ),
        ))
        .returning();

      if (!updated) {
        throw new Error("Failed to update Drive upload metadata.");
      }

      await logAuditEvent(tx, {
        actorUserId: input.user.id,
        action: "shipping_note.export.drive.uploaded",
        entityType: "shipping_note_export",
        entityId: input.exportRecord.id,
        after: buildDriveAuditSnapshot({
          exportRecord: input.exportRecord,
          note: input.note,
          driveFileId: input.file.id,
          driveFolderId: input.folderId,
          driveUploadStatus: "uploaded",
          reconciledFromDrive: input.reconciledFromDrive,
          retryCount: input.retryCount,
        }),
      });

      return updated;
    });
  },

  async markDriveUploadFailed(input) {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNoteExports)
        .set({
          driveUploadStatus: "upload_failed",
          driveErrorMessage: input.code,
          updatedAt: input.failedAt,
        })
        .where(and(
          ...driveUploadingConditions(
            input.exportRecord.id,
            input.staleCutoff,
          ),
        ))
        .returning();

      if (!updated) {
        throw new Error("Failed to update Drive upload failure metadata.");
      }

      await logAuditEvent(tx, {
        actorUserId: input.user.id,
        action: "shipping_note.export.drive.failed",
        entityType: "shipping_note_export",
        entityId: input.exportRecord.id,
        after: buildDriveAuditSnapshot({
          exportRecord: input.exportRecord,
          note: input.note,
          driveFolderId: input.folderId,
          driveUploadStatus: "upload_failed",
          driveErrorMessage: input.code,
          reconciledFromDrive: false,
          retryCount: input.retryCount,
        }),
      });

      return updated;
    });
  },
};
