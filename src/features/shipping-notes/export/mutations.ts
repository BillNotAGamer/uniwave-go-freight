import "server-only";

import { eq } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  shippingNoteExports,
  type ShippingNoteExport,
  type User as DbUser,
} from "@/lib/db/schema";

import {
  INTERNAL_XLSX_METADATA_VERSION,
  INTERNAL_XLSX_TEMPLATE_VERSION,
} from "./constants";
import type { ExportErrorCode } from "./errors";

function buildGeneratedExportAuditSnapshot(input: {
  exportId: string;
  fileName: string;
  checksum: string;
  sellingChargeCount: number;
  buyingChargeCount: number;
}) {
  return {
    exportId: input.exportId,
    format: "xlsx" as const,
    templateVersion: INTERNAL_XLSX_TEMPLATE_VERSION,
    fileName: input.fileName,
    checksum: input.checksum,
    sellingChargeCount: input.sellingChargeCount,
    buyingChargeCount: input.buyingChargeCount,
  };
}

function buildFailedExportAuditSnapshot(input: {
  exportId: string;
  errorCode: ExportErrorCode;
}) {
  return {
    exportId: input.exportId,
    format: "xlsx" as const,
    templateVersion: INTERNAL_XLSX_TEMPLATE_VERSION,
    errorCode: input.errorCode,
  };
}

export async function createPendingInternalXlsxExportRecord(input: {
  shippingNoteId: string;
  fileName: string;
  user: DbUser;
}): Promise<ShippingNoteExport> {
  const [created] = await db
    .insert(shippingNoteExports)
    .values({
      shippingNoteId: input.shippingNoteId,
      exportType: "excel",
      version: INTERNAL_XLSX_METADATA_VERSION,
      status: "pending",
      fileName: input.fileName,
      generatedById: input.user.id,
      errorMessage: null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create export metadata.");
  }

  return created;
}

export async function markInternalXlsxExportGenerated(input: {
  exportId: string;
  fileName: string;
  checksumSha256: string;
  sellingChargeCount: number;
  buyingChargeCount: number;
  generatedAt: Date;
  user: DbUser;
}): Promise<ShippingNoteExport> {
  return db.transaction(async (tx) => {
    const [existingExport] = await tx
      .select()
      .from(shippingNoteExports)
      .where(eq(shippingNoteExports.id, input.exportId))
      .limit(1);

    if (!existingExport) {
      throw new Error("Export metadata was not found.");
    }

    const [updated] = await tx
      .update(shippingNoteExports)
      .set({
        version: INTERNAL_XLSX_METADATA_VERSION,
        status: "generated",
        fileName: input.fileName,
        checksum: input.checksumSha256,
        errorMessage: null,
        generatedById: input.user.id,
        generatedAt: input.generatedAt,
      })
      .where(eq(shippingNoteExports.id, input.exportId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update export metadata.");
    }

    await logAuditEvent(tx, {
      actorUserId: input.user.id,
      action: "shipping_note.export.xlsx.generated",
      entityType: "shipping_note",
      entityId: updated.shippingNoteId,
      after: buildGeneratedExportAuditSnapshot({
        exportId: updated.id,
        fileName: input.fileName,
        checksum: input.checksumSha256,
        sellingChargeCount: input.sellingChargeCount,
        buyingChargeCount: input.buyingChargeCount,
      }),
    });

    return updated;
  });
}

export async function markInternalXlsxExportFailed(input: {
  exportId: string;
  errorCode: ExportErrorCode;
  fileName: string;
  user: DbUser;
}): Promise<ShippingNoteExport> {
  return db.transaction(async (tx) => {
    const [existingExport] = await tx
      .select()
      .from(shippingNoteExports)
      .where(eq(shippingNoteExports.id, input.exportId))
      .limit(1);

    if (!existingExport) {
      throw new Error("Export metadata was not found.");
    }

    const [updated] = await tx
      .update(shippingNoteExports)
      .set({
        version: INTERNAL_XLSX_METADATA_VERSION,
        status: "failed",
        fileName: input.fileName,
        checksum: null,
        errorMessage: input.errorCode,
        generatedById: input.user.id,
        generatedAt: null,
      })
      .where(eq(shippingNoteExports.id, input.exportId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update export metadata.");
    }

    await logAuditEvent(tx, {
      actorUserId: input.user.id,
      action: "shipping_note.export.xlsx.failed",
      entityType: "shipping_note",
      entityId: updated.shippingNoteId,
      after: buildFailedExportAuditSnapshot({
        exportId: updated.id,
        errorCode: input.errorCode,
      }),
    });

    return updated;
  });
}
