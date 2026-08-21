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
  INTERNAL_PDF_LAYOUT_VERSION,
  INTERNAL_PDF_METADATA_VERSION,
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

function buildGeneratedPdfExportAuditSnapshot(input: {
  exportId: string;
  fileName: string;
  checksum: string;
  generatedAt: Date;
  sellingChargeCount: number;
  buyingChargeCount: number;
}) {
  return {
    exportId: input.exportId,
    format: "pdf" as const,
    metadataVersion: INTERNAL_PDF_METADATA_VERSION,
    layoutVersion: INTERNAL_PDF_LAYOUT_VERSION,
    fileName: input.fileName,
    checksum: input.checksum,
    generatedAt: input.generatedAt.toISOString(),
    sellingChargeCount: input.sellingChargeCount,
    buyingChargeCount: input.buyingChargeCount,
  };
}

function buildFailedPdfExportAuditSnapshot(input: {
  exportId: string;
  errorCode: ExportErrorCode;
}) {
  return {
    exportId: input.exportId,
    format: "pdf" as const,
    metadataVersion: INTERNAL_PDF_METADATA_VERSION,
    layoutVersion: INTERNAL_PDF_LAYOUT_VERSION,
    errorCode: input.errorCode,
  };
}

export function buildPendingInternalXlsxExportRecordValues(input: {
  shippingNoteId: string;
  fileName: string;
  generatedById: string;
}) {
  return {
    shippingNoteId: input.shippingNoteId,
    exportType: "excel" as const,
    version: INTERNAL_XLSX_METADATA_VERSION,
    status: "pending" as const,
    fileName: input.fileName,
    generatedById: input.generatedById,
    errorMessage: null,
  };
}

export function buildGeneratedInternalXlsxExportRecordValues(input: {
  fileName: string;
  checksumSha256: string;
  generatedById: string;
  generatedAt: Date;
}) {
  return {
    version: INTERNAL_XLSX_METADATA_VERSION,
    status: "generated" as const,
    fileName: input.fileName,
    checksum: input.checksumSha256,
    errorMessage: null,
    generatedById: input.generatedById,
    generatedAt: input.generatedAt,
  };
}

export function buildFailedInternalXlsxExportRecordValues(input: {
  errorCode: ExportErrorCode;
  fileName: string;
  generatedById: string;
}) {
  return {
    version: INTERNAL_XLSX_METADATA_VERSION,
    status: "failed" as const,
    fileName: input.fileName,
    checksum: null,
    errorMessage: input.errorCode,
    generatedById: input.generatedById,
    generatedAt: null,
  };
}

export function buildPendingInternalPdfExportRecordValues(input: {
  shippingNoteId: string;
  fileName: string;
  generatedById: string;
}) {
  return {
    shippingNoteId: input.shippingNoteId,
    exportType: "pdf" as const,
    version: INTERNAL_PDF_METADATA_VERSION,
    status: "pending" as const,
    fileName: input.fileName,
    generatedById: input.generatedById,
    errorMessage: null,
  };
}

export function buildGeneratedInternalPdfExportRecordValues(input: {
  fileName: string;
  checksumSha256: string;
  generatedById: string;
  generatedAt: Date;
}) {
  return {
    version: INTERNAL_PDF_METADATA_VERSION,
    status: "generated" as const,
    fileName: input.fileName,
    checksum: input.checksumSha256,
    errorMessage: null,
    generatedById: input.generatedById,
    generatedAt: input.generatedAt,
  };
}

export function buildFailedInternalPdfExportRecordValues(input: {
  errorCode: ExportErrorCode;
  fileName: string;
  generatedById: string;
}) {
  return {
    version: INTERNAL_PDF_METADATA_VERSION,
    status: "failed" as const,
    fileName: input.fileName,
    checksum: null,
    errorMessage: input.errorCode,
    generatedById: input.generatedById,
    generatedAt: null,
  };
}

export async function createPendingInternalXlsxExportRecord(input: {
  shippingNoteId: string;
  fileName: string;
  user: DbUser;
}): Promise<ShippingNoteExport> {
  const [created] = await db
    .insert(shippingNoteExports)
    .values(buildPendingInternalXlsxExportRecordValues({
      shippingNoteId: input.shippingNoteId,
      fileName: input.fileName,
      generatedById: input.user.id,
    }))
    .returning();

  if (!created) {
    throw new Error("Failed to create export metadata.");
  }

  return created;
}

export async function createPendingInternalPdfExportRecord(input: {
  shippingNoteId: string;
  fileName: string;
  user: DbUser;
}): Promise<ShippingNoteExport> {
  const [created] = await db
    .insert(shippingNoteExports)
    .values(buildPendingInternalPdfExportRecordValues({
      shippingNoteId: input.shippingNoteId,
      fileName: input.fileName,
      generatedById: input.user.id,
    }))
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
      .set(buildGeneratedInternalXlsxExportRecordValues({
        fileName: input.fileName,
        checksumSha256: input.checksumSha256,
        generatedById: input.user.id,
        generatedAt: input.generatedAt,
      }))
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

export async function markInternalPdfExportGenerated(input: {
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
      .set(buildGeneratedInternalPdfExportRecordValues({
        fileName: input.fileName,
        checksumSha256: input.checksumSha256,
        generatedById: input.user.id,
        generatedAt: input.generatedAt,
      }))
      .where(eq(shippingNoteExports.id, input.exportId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update export metadata.");
    }

    await logAuditEvent(tx, {
      actorUserId: input.user.id,
      action: "shipping_note.export.pdf.generated",
      entityType: "shipping_note",
      entityId: updated.shippingNoteId,
      after: buildGeneratedPdfExportAuditSnapshot({
        exportId: updated.id,
        fileName: input.fileName,
        checksum: input.checksumSha256,
        generatedAt: input.generatedAt,
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
      .set(buildFailedInternalXlsxExportRecordValues({
        errorCode: input.errorCode,
        fileName: input.fileName,
        generatedById: input.user.id,
      }))
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

export async function markInternalPdfExportFailed(input: {
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
      .set(buildFailedInternalPdfExportRecordValues({
        errorCode: input.errorCode,
        fileName: input.fileName,
        generatedById: input.user.id,
      }))
      .where(eq(shippingNoteExports.id, input.exportId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update export metadata.");
    }

    await logAuditEvent(tx, {
      actorUserId: input.user.id,
      action: "shipping_note.export.pdf.failed",
      entityType: "shipping_note",
      entityId: updated.shippingNoteId,
      after: buildFailedPdfExportAuditSnapshot({
        exportId: updated.id,
        errorCode: input.errorCode,
      }),
    });

    return updated;
  });
}
