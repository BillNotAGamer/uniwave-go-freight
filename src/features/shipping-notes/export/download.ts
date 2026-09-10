import "server-only";

import { getArtifactStorage } from "@/lib/artifact-storage";
import type { ArtifactStorage } from "@/lib/artifact-storage/types";
import { ArtifactStorageError } from "@/lib/artifact-storage/errors";
import { getVerifiedArtifactBytes } from "@/lib/artifact-storage/verified";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import type { User as DbUser } from "@/lib/db/schema";

import {
  productionDriveUploadRepository,
  type DriveUploadRepository,
} from "./drive/repository";
import { getDriveArtifactEligibility } from "./drive/policy";
import { EXPORT_ERROR_CODES, ExportError } from "./errors";

export type HistoricalExportDownload = {
  exportId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

export type HistoricalExportDownloadDependencies = {
  repository?: DriveUploadRepository;
  artifactStorage?: ArtifactStorage;
};

function toExportDownloadError(error: unknown): ExportError {
  if (error instanceof ExportError) {
    return error;
  }

  if (error instanceof ArtifactStorageError) {
    return new ExportError(
      error.code,
      500,
      "Stored export artifact could not be verified.",
    );
  }

  return new ExportError(
    EXPORT_ERROR_CODES.GENERATION_FAILED,
    500,
    "Historical export download failed.",
  );
}

export async function getHistoricalExportDownloadForUser(
  exportId: string,
  user: DbUser,
  dependencies: HistoricalExportDownloadDependencies = {},
): Promise<HistoricalExportDownload> {
  requireAnyPermission(user.role, PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL);

  const repository = dependencies.repository ?? productionDriveUploadRepository;
  const storage = dependencies.artifactStorage ?? getArtifactStorage();
  const loaded = await repository.loadExportForDriveUpload(exportId);

  if (!loaded) {
    throw new ExportError(
      EXPORT_ERROR_CODES.NOTE_NOT_FOUND,
      404,
      "Export artifact was not found.",
    );
  }

  const eligibility = getDriveArtifactEligibility(loaded);

  if (!eligibility.eligible) {
    throw new ExportError(
      EXPORT_ERROR_CODES.STATUS_NOT_ELIGIBLE,
      409,
      eligibility.reason,
    );
  }

  try {
    const bytes = await getVerifiedArtifactBytes(loaded.exportRecord, storage);

    return {
      exportId: loaded.exportRecord.id,
      fileName: loaded.exportRecord.fileName ?? loaded.exportRecord.id,
      mimeType: loaded.exportRecord.artifactMimeType ?? "application/octet-stream",
      bytes,
    };
  } catch (error) {
    throw toExportDownloadError(error);
  }
}
