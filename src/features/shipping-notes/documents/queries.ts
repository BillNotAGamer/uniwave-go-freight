import "server-only";

import { and, desc, eq, ilike, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  shippingNoteDocuments,
  shippingNotes,
  type User as DbUser,
} from "@/lib/db/schema";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import {
  escapeShippingNoteJobsheetLikePattern,
  getShippingNoteForUser,
} from "../queries";
import type { ShippingNoteDocumentType } from "./constants";
import { canReadShippingNoteDocuments } from "./policy";
import type {
  DocumentLibraryItem,
  ShippingNoteDocumentDetail,
  ShippingNoteDocumentListItem,
} from "./types";

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

const documentDetailColumns = {
  ...documentListColumns,
  storageKey: shippingNoteDocuments.storageKey,
  updatedAt: shippingNoteDocuments.updatedAt,
} as const;

export async function listShippingNoteDocumentsForUser(
  shippingNoteId: string,
  user: DbUser,
): Promise<ShippingNoteDocumentListItem[]> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  const note = await getShippingNoteForUser(shippingNoteId, user);
  if (!note || !canReadShippingNoteDocuments(note, user)) {
    return [];
  }

  return db
    .select(documentListColumns)
    .from(shippingNoteDocuments)
    .where(
      and(
        eq(shippingNoteDocuments.shippingNoteId, shippingNoteId),
        isNull(shippingNoteDocuments.deletedAt),
      ),
    )
    .orderBy(
      desc(shippingNoteDocuments.createdAt),
      desc(shippingNoteDocuments.id),
    );
}

export async function getShippingNoteDocumentByIdForUser(
  documentId: string,
  user: DbUser,
): Promise<ShippingNoteDocumentDetail | null> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  const [document] = await db
    .select(documentDetailColumns)
    .from(shippingNoteDocuments)
    .where(
      and(
        eq(shippingNoteDocuments.id, documentId),
        isNull(shippingNoteDocuments.deletedAt),
      ),
    )
    .limit(1);

  if (!document) {
    return null;
  }

  const note = await getShippingNoteForUser(document.shippingNoteId, user);
  if (!note || !canReadShippingNoteDocuments(note, user)) {
    return null;
  }

  return document;
}

export type DocumentLibrarySearchParams = {
  jobsheet?: string;
  documentType?: ShippingNoteDocumentType;
  limit?: number;
};

export async function searchShippingNoteDocumentsForUser(
  params: DocumentLibrarySearchParams,
  user: DbUser,
): Promise<DocumentLibraryItem[]> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  const conditions = [
    isNull(shippingNoteDocuments.deletedAt),
    isNull(shippingNotes.deletedAt),
  ];

  // Actor scoping: Sale can only see documents for their own shipping notes
  if (user.role === "sale") {
    conditions.push(eq(shippingNotes.createdById, user.id));
  } else if (user.role !== "admin" && user.role !== "accountant") {
    return [];
  }

  // Jobsheet search filter: case-insensitive substring
  if (params.jobsheet?.trim()) {
    const pattern = `%${escapeShippingNoteJobsheetLikePattern(params.jobsheet.trim())}%`;
    conditions.push(ilike(shippingNotes.jobsheetNo, pattern));
  }

  // Document type filter
  if (params.documentType) {
    conditions.push(eq(shippingNoteDocuments.documentType, params.documentType));
  }

  const limit = Math.min(Math.max(1, params.limit ?? 50), 100);

  const rows = await db
    .select({
      id: shippingNoteDocuments.id,
      shippingNoteId: shippingNoteDocuments.shippingNoteId,
      documentType: shippingNoteDocuments.documentType,
      originalFileName: shippingNoteDocuments.originalFileName,
      storageProvider: shippingNoteDocuments.storageProvider,
      mimeType: shippingNoteDocuments.mimeType,
      sizeBytes: shippingNoteDocuments.sizeBytes,
      uploadedById: shippingNoteDocuments.uploadedById,
      createdAt: shippingNoteDocuments.createdAt,
      jobsheetNo: shippingNotes.jobsheetNo,
      noteStatus: shippingNotes.status,
    })
    .from(shippingNoteDocuments)
    .innerJoin(
      shippingNotes,
      eq(shippingNoteDocuments.shippingNoteId, shippingNotes.id),
    )
    .where(and(...conditions))
    .orderBy(
      desc(shippingNoteDocuments.createdAt),
      desc(shippingNoteDocuments.id),
    )
    .limit(limit);

  return rows;
}
