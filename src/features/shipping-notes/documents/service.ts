import "server-only";

import { createHash } from "node:crypto";

import { getArtifactStorage } from "@/lib/artifact-storage";
import { isR2Configured } from "@/lib/artifact-storage/r2";
import type { ArtifactStorage } from "@/lib/artifact-storage/types";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import type { User as DbUser } from "@/lib/db/schema";
import { readGoogleDriveConfig } from "@/lib/drive/config";
import { GoogleDriveArtifactUploader } from "@/lib/drive/google-drive";
import type { DriveArtifactUploader } from "@/lib/drive/types";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import { getShippingNoteForUser } from "../queries";
import type { ShippingNoteDocumentType } from "./constants";
import { validateDocumentFile } from "./file-security";
import {
  hardDeleteShippingNoteDocument,
  logShippingNoteDocumentCleanupFailure,
  registerShippingNoteDocumentMetadata,
} from "./mutations";
import { canMutateShippingNoteDocuments, canReadShippingNoteDocuments } from "./policy";
import { getShippingNoteDocumentByIdForUser } from "./queries";
import { deleteExactArtifactKeys } from "../artifact-cleanup";
import {
  buildDocumentR2Key,
} from "./storage-paths";
import type { ShippingNoteDocumentListItem } from "./types";

export type DocumentServiceDependencies = {
  r2Storage?: ArtifactStorage;
  driveUploader?: DriveArtifactUploader;
  driveRootFolderId?: string;
  now?: Date;
  isR2Available?: boolean;
};

export type UploadDocumentInput = {
  shippingNoteId: string;
  documentType: ShippingNoteDocumentType;
  file: {
    name: string;
    size: number;
    type?: string | null;
    bytes: Buffer;
  };
};

export type RemoveDocumentInput = {
  documentId: string;
  shippingNoteId: string;
  reason: string;
};

export type DownloadDocumentResult = {
  documentId: string;
  shippingNoteId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Buffer;
};

export type StorageAvailability = {
  available: boolean;
  preferredProvider: "r2" | null;
  r2Configured: boolean;
};

export function getStorageAvailability(
  dependencies: DocumentServiceDependencies = {},
): StorageAvailability {
  const r2Configured = dependencies.isR2Available ?? isR2Configured();

  return {
    available: r2Configured,
    preferredProvider: r2Configured ? "r2" : null,
    r2Configured,
  };
}

function resolveR2Storage(dependencies: DocumentServiceDependencies): ArtifactStorage {
  return dependencies.r2Storage ?? getArtifactStorage();
}

function resolveDriveUploader(
  dependencies: DocumentServiceDependencies,
): { uploader: DriveArtifactUploader; rootFolderId: string } {
  if (dependencies.driveUploader) {
    return {
      uploader: dependencies.driveUploader,
      rootFolderId: dependencies.driveRootFolderId ?? "test-root-folder",
    };
  }

  const config = readGoogleDriveConfig();
  return {
    uploader: new GoogleDriveArtifactUploader(config),
    rootFolderId: config.rootFolderId,
  };
}

export async function uploadShippingNoteDocument(
  input: UploadDocumentInput,
  user: DbUser,
  dependencies: DocumentServiceDependencies = {},
): Promise<ShippingNoteDocumentListItem> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  // 1. Resolve note and enforce document mutation authorization & status guards
  const note = await getShippingNoteForUser(input.shippingNoteId, user);
  if (!note || !canMutateShippingNoteDocuments(note, user)) {
    throw new AuthorizationError(
      "You do not have permission to upload documents to this shipping note, or the note is locked/cancelled.",
    );
  }

  // 2. Validate file metadata and bytes
  const validation = validateDocumentFile(input.file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 3. Determine configured storage provider
  const availability = getStorageAvailability(dependencies);
  if (!availability.available || !availability.preferredProvider) {
    throw new Error("Document storage is not configured. Please contact an administrator.");
  }

  const storage = resolveR2Storage(dependencies);
  const storageKey = buildDocumentR2Key({
    shippingNoteId: note.id,
    originalFileName: validation.originalFileName,
    now: dependencies.now,
  });
  const checksumSha256 = createHash("sha256")
    .update(input.file.bytes)
    .digest("hex");

  // 4. Upload all new supporting documents to private R2.
  await storage.put({
    key: storageKey,
    body: input.file.bytes,
    mimeType: validation.mimeType,
    checksumSha256,
    exportId: `doc-${note.id}`,
  });

  // 5. Register metadata in PostgreSQL with compensating failure cleanup
  try {
    const registered = await registerShippingNoteDocumentMetadata(
      {
        shippingNoteId: note.id,
        documentType: input.documentType,
        originalFileName: validation.originalFileName,
        storageProvider: "r2",
        storageKey,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
      },
      user,
    );

    return registered;
  } catch (error) {
    // Compensating cleanup: attempt to delete the orphaned provider object
    try {
      if (storage.delete) {
        await storage.delete(storageKey);
      }
    } catch (cleanupError) {
      // Log sanitized warning without credentials
      console.error(
        "[DocumentService] Compensating cleanup failed for orphaned storage object:",
        cleanupError instanceof Error ? cleanupError.message : "Unknown error",
      );
    }

    throw error;
  }
}

export async function removeShippingNoteDocument(
  input: RemoveDocumentInput,
  user: DbUser,
  dependencies: DocumentServiceDependencies = {},
): Promise<void> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  // 1. Resolve note and enforce document mutation authorization & status guards
  const note = await getShippingNoteForUser(input.shippingNoteId, user);
  if (!note || !canMutateShippingNoteDocuments(note, user)) {
    throw new AuthorizationError(
      "You do not have permission to remove documents from this shipping note, or the note is locked/cancelled.",
    );
  }

  // 2. The database delete is authoritative. It includes the hard-delete audit
  // event and only returns the persisted, exact provider key for cleanup.
  const document = await hardDeleteShippingNoteDocument({
    id: input.documentId,
    shippingNoteId: input.shippingNoteId,
    reason: input.reason,
  }, user);

  // 3. Clean up only the exact object key after metadata is committed. A
  // subsequent provider failure cannot leave live metadata pointing to a
  // deleted object.
  let cleanupFailed = false;
  if (document.storageProvider === "r2") {
    const cleanup = await deleteExactArtifactKeys(
      [document.storageKey],
      resolveR2Storage(dependencies),
    );
    cleanupFailed = cleanup.failedKeyCount > 0;
  } else {
    const { uploader } = resolveDriveUploader(dependencies);
    try {
      if (!uploader.delete) {
        cleanupFailed = true;
      } else {
        await uploader.delete(document.storageKey);
      }
    } catch {
      cleanupFailed = true;
    }
  }

  if (cleanupFailed) {
    try {
      await logShippingNoteDocumentCleanupFailure(document, user, input.reason);
    } catch {
      // The completed document hard-delete audit event remains durable.
    }
    throw new Error(
      "Document metadata was deleted, but private artifact cleanup failed. An audit event was recorded.",
    );
  }
}

export async function downloadShippingNoteDocument(
  documentId: string,
  user: DbUser,
  dependencies: DocumentServiceDependencies = {},
): Promise<DownloadDocumentResult> {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }

  // 1. Resolve document from database
  const document = await getShippingNoteDocumentByIdForUser(documentId, user);
  if (!document) {
    throw new AuthorizationError("You do not have permission to access or download this document.");
  }

  // 2. Resolve shipping note and verify read authorization
  const note = await getShippingNoteForUser(document.shippingNoteId, user);
  if (!note || !canReadShippingNoteDocuments(note, user)) {
    throw new AuthorizationError("You do not have permission to download this document.");
  }

  // 3. Retrieve binary content from appropriate provider
  let bytes: Buffer;

  if (document.storageProvider === "r2") {
    const storage = resolveR2Storage(dependencies);
    bytes = await storage.get(document.storageKey);
  } else {
    const { uploader } = resolveDriveUploader(dependencies);
    if (!uploader.download) {
      throw new Error("Google Drive provider does not support download.");
    }
    bytes = await uploader.download(document.storageKey);
  }

  return {
    documentId: document.id,
    shippingNoteId: document.shippingNoteId,
    fileName: document.originalFileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    bytes,
  };
}
