import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  shippingNoteExports,
  shippingNotes,
  users,
  type ShippingNoteExport,
  type User as DbUser,
} from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import { getShippingNoteForUser } from "../queries";
import {
  getDriveArtifactEligibility,
  type DriveUploadNoteContract,
} from "./drive/policy";
import { isDriveUploadStale } from "./drive/service";

export type ExportHistoryItem = {
  id: string;
  exportType: ShippingNoteExport["exportType"];
  version: number;
  status: ShippingNoteExport["status"];
  fileName: string | null;
  checksum: string | null;
  generatedAt: Date | null;
  generatedByDisplay: string | null;
  artifactAvailable: boolean;
  artifactSizeBytes: number | null;
  driveUploadStatus: ShippingNoteExport["driveUploadStatus"];
  driveUploadedAt: Date | null;
  driveUrl: string | null;
  driveErrorCode: string | null;
  isDriveUploadStale: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ExportHistorySourceRow = {
  exportRecord: ShippingNoteExport;
  generatedBy: {
    name: string | null;
    email: string | null;
  } | null;
};

export function toExportHistoryItem(input: {
  row: ExportHistorySourceRow;
  note: DriveUploadNoteContract;
  viewer: DbUser;
  now?: Date;
}): ExportHistoryItem {
  const eligibility = getDriveArtifactEligibility({
    exportRecord: input.row.exportRecord,
    note: input.note,
  });
  const generatedByDisplay = input.row.generatedBy?.name ||
    input.row.generatedBy?.email ||
    null;

  return {
    id: input.row.exportRecord.id,
    exportType: input.row.exportRecord.exportType,
    version: input.row.exportRecord.version,
    status: input.row.exportRecord.status,
    fileName: input.row.exportRecord.fileName,
    checksum: input.row.exportRecord.checksum,
    generatedAt: input.row.exportRecord.generatedAt,
    generatedByDisplay,
    artifactAvailable: eligibility.eligible,
    artifactSizeBytes: input.row.exportRecord.artifactSizeBytes,
    driveUploadStatus: input.row.exportRecord.driveUploadStatus,
    driveUploadedAt: input.row.exportRecord.driveUploadedAt,
    driveUrl: input.row.exportRecord.driveUrl,
    driveErrorCode: input.viewer.role === "admin"
      ? input.row.exportRecord.driveErrorMessage
      : null,
    isDriveUploadStale: isDriveUploadStale({
      driveUploadStatus: input.row.exportRecord.driveUploadStatus,
      updatedAt: input.row.exportRecord.updatedAt,
      now: input.now,
    }),
    createdAt: input.row.exportRecord.createdAt,
    updatedAt: input.row.exportRecord.updatedAt,
  };
}

export async function listShippingNoteExportHistoryForUser(
  noteId: string,
  user: DbUser,
  options: { now?: Date } = {},
): Promise<ExportHistoryItem[]> {
  requireAnyPermission(user.role, PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL);

  const note = await getShippingNoteForUser(noteId, user);

  if (!note) {
    return [];
  }

  const rows = await db
    .select({
      exportRecord: shippingNoteExports,
      generatedBy: {
        name: users.name,
        email: users.email,
      },
    })
    .from(shippingNoteExports)
    .leftJoin(users, eq(users.id, shippingNoteExports.generatedById))
    .innerJoin(
      shippingNotes,
      eq(shippingNotes.id, shippingNoteExports.shippingNoteId),
    )
    .where(
      and(
        eq(shippingNoteExports.shippingNoteId, noteId),
        isNull(shippingNotes.deletedAt),
      ),
    )
    .orderBy(
      sql`${shippingNoteExports.generatedAt} desc nulls last`,
      desc(shippingNoteExports.createdAt),
    );

  return rows.map((row) => toExportHistoryItem({
    row,
    note: {
      id: note.id,
      status: note.status,
      deletedAt: null,
    },
    viewer: user,
    now: options.now,
  }));
}
