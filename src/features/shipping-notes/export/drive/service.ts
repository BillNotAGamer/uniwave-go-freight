import "server-only";

import { ArtifactStorageError } from "@/lib/artifact-storage/errors";
import { getArtifactStorage } from "@/lib/artifact-storage";
import type { ArtifactStorage } from "@/lib/artifact-storage/types";
import { getVerifiedArtifactBytes } from "@/lib/artifact-storage/verified";
import { DRIVE_ERROR_CODES, DriveError, classifyGoogleDriveError } from "@/lib/drive/errors";
import { GoogleDriveArtifactUploader } from "@/lib/drive/google-drive";
import { readGoogleDriveConfig } from "@/lib/drive/config";
import type {
  DriveArtifactUploader,
  DriveFileRecord,
} from "@/lib/drive/types";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import type { User as DbUser, ShippingNoteExport } from "@/lib/db/schema";

import {
  buildDriveAppProperties,
  getDriveArtifactEligibility,
  type DriveUploadExportContract,
} from "./policy";
import {
  productionDriveUploadRepository,
  type DriveUploadLoadedExport,
  type DriveUploadRepository,
} from "./repository";

export type UploadShippingNoteExportToDriveResult = {
  exportId: string;
  driveUploadStatus: "uploaded";
  driveFileId: string;
  driveUrl: string;
  reconciledFromDrive: boolean;
};

export type UploadShippingNoteExportToDriveDependencies = {
  repository?: DriveUploadRepository;
  driveUploader?: DriveArtifactUploader;
  artifactStorage?: ArtifactStorage;
  rootFolderId?: string;
  now?: Date;
};

export const DRIVE_UPLOAD_STALE_AFTER_MS = 10 * 60 * 1000;

export function isDriveUploadStale(input: {
  driveUploadStatus: ShippingNoteExport["driveUploadStatus"];
  updatedAt: Date;
  now?: Date;
}): boolean {
  if (input.driveUploadStatus !== "uploading") {
    return false;
  }

  const now = input.now ?? new Date();
  return input.updatedAt.getTime() <=
    now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS;
}

function toDriveError(error: unknown): DriveError {
  if (error instanceof DriveError) {
    return error;
  }

  if (error instanceof ArtifactStorageError) {
    const code = error.code === "ARTIFACT_CHECKSUM_MISMATCH"
      ? DRIVE_ERROR_CODES.ARTIFACT_CHECKSUM_MISMATCH
      : DRIVE_ERROR_CODES.ARTIFACT_STORAGE_READ_FAILED;

    return new DriveError(
      code,
      500,
      "Stored export artifact could not be verified.",
    );
  }

  return classifyGoogleDriveError(error);
}

function assertDriveFileMatchesExport(input: {
  file: DriveFileRecord;
  exportRecord: DriveUploadExportContract;
  rootFolderId: string;
}): void {
  const expectedProperties = buildDriveAppProperties(input.exportRecord);

  for (const [key, value] of Object.entries(expectedProperties)) {
    if (input.file.appProperties[key] !== value) {
      throw new DriveError(
        DRIVE_ERROR_CODES.RECONCILIATION_CONFLICT,
        409,
        "Google Drive artifact metadata does not match the export record.",
      );
    }
  }

  if (!input.file.parents.includes(input.rootFolderId)) {
    throw new DriveError(
      DRIVE_ERROR_CODES.RECONCILIATION_CONFLICT,
      409,
      "Google Drive artifact is not in the configured root folder.",
    );
  }

  if (!input.file.webViewLink) {
    throw new DriveError(
      DRIVE_ERROR_CODES.UPLOAD_FAILED,
      502,
      "Google Drive response did not include a web view link.",
    );
  }
}

function alreadyUploadedResult(
  exportRecord: ShippingNoteExport,
): UploadShippingNoteExportToDriveResult | null {
  if (
    exportRecord.driveUploadStatus === "uploaded" &&
    exportRecord.driveFileId &&
    exportRecord.driveUrl
  ) {
    return {
      exportId: exportRecord.id,
      driveUploadStatus: "uploaded",
      driveFileId: exportRecord.driveFileId,
      driveUrl: exportRecord.driveUrl,
      reconciledFromDrive: false,
    };
  }

  return null;
}

async function markFailed(input: {
  repository: DriveUploadRepository;
  loaded: DriveUploadLoadedExport;
  user: DbUser;
  error: DriveError;
  rootFolderId: string;
  retryCount: number;
  staleCutoff?: Date;
}): Promise<void> {
  await input.repository.markDriveUploadFailed({
    exportRecord: input.loaded.exportRecord,
    note: input.loaded.note,
    user: input.user,
    code: input.error.code,
    folderId: input.rootFolderId,
    failedAt: new Date(),
    retryCount: input.retryCount,
    staleCutoff: input.staleCutoff,
  });
}

async function findSingleDriveFileForExport(input: {
  driveUploader: DriveArtifactUploader;
  exportId: string;
}): Promise<{ file: DriveFileRecord | null; retryCount: number }> {
  const found = await input.driveUploader.findByExportId(input.exportId);

  if (found.files.length > 1) {
    throw new DriveError(
      DRIVE_ERROR_CODES.DUPLICATE_ARTIFACT,
      409,
      "Multiple Google Drive artifacts exist for this export.",
    );
  }

  return {
    file: found.files[0] ?? null,
    retryCount: found.retryCount,
  };
}

async function uploadClaimedArtifact(input: {
  loaded: DriveUploadLoadedExport;
  user: DbUser;
  repository: DriveUploadRepository;
  driveUploader: DriveArtifactUploader;
  artifactStorage: ArtifactStorage;
  rootFolderId: string;
  retryCount: number;
}): Promise<UploadShippingNoteExportToDriveResult> {
  let retryCount = input.retryCount;

  try {
    const bytes = await getVerifiedArtifactBytes(
      input.loaded.exportRecord,
      input.artifactStorage,
    );
    const appProperties = buildDriveAppProperties(input.loaded.exportRecord);
    const found = await findSingleDriveFileForExport({
      driveUploader: input.driveUploader,
      exportId: input.loaded.exportRecord.id,
    });
    retryCount += found.retryCount;

    let uploadedFile: DriveFileRecord;
    let reconciledFromDrive = false;

    if (found.file) {
      assertDriveFileMatchesExport({
        file: found.file,
        exportRecord: input.loaded.exportRecord,
        rootFolderId: input.rootFolderId,
      });
      uploadedFile = found.file;
      reconciledFromDrive = true;
    } else {
      const uploaded = await input.driveUploader.upload({
        fileName: input.loaded.exportRecord.fileName ?? input.loaded.exportRecord.id,
        mimeType: input.loaded.exportRecord.artifactMimeType ?? "application/octet-stream",
        bytes,
        appProperties,
        parentFolderId: input.rootFolderId,
      });
      retryCount += uploaded.retryCount;
      uploadedFile = uploaded.file;
      assertDriveFileMatchesExport({
        file: uploadedFile,
        exportRecord: input.loaded.exportRecord,
        rootFolderId: input.rootFolderId,
      });
    }

    await input.repository.markDriveUploadSucceeded({
      exportRecord: input.loaded.exportRecord,
      note: input.loaded.note,
      user: input.user,
      file: uploadedFile,
      folderId: input.rootFolderId,
      uploadedAt: new Date(),
      reconciledFromDrive,
      retryCount,
    });

    return {
      exportId: input.loaded.exportRecord.id,
      driveUploadStatus: "uploaded",
      driveFileId: uploadedFile.id,
      driveUrl: uploadedFile.webViewLink ?? "",
      reconciledFromDrive,
    };
  } catch (error) {
    const driveError = toDriveError(error);

    await markFailed({
      repository: input.repository,
      loaded: input.loaded,
      user: input.user,
      error: driveError,
      rootFolderId: input.rootFolderId,
      retryCount,
    });

    throw driveError;
  }
}

async function recoverStaleDriveUpload(input: {
  loaded: DriveUploadLoadedExport;
  user: DbUser;
  repository: DriveUploadRepository;
  driveUploader: DriveArtifactUploader;
  artifactStorage: ArtifactStorage;
  rootFolderId: string;
  staleCutoff: Date;
}): Promise<UploadShippingNoteExportToDriveResult> {
  let retryCount = 0;

  try {
    const found = await findSingleDriveFileForExport({
      driveUploader: input.driveUploader,
      exportId: input.loaded.exportRecord.id,
    });
    retryCount += found.retryCount;

    if (found.file) {
      assertDriveFileMatchesExport({
        file: found.file,
        exportRecord: input.loaded.exportRecord,
        rootFolderId: input.rootFolderId,
      });

      await input.repository.markDriveUploadSucceeded({
        exportRecord: input.loaded.exportRecord,
        note: input.loaded.note,
        user: input.user,
        file: found.file,
        folderId: input.rootFolderId,
        uploadedAt: new Date(),
        reconciledFromDrive: true,
        retryCount,
        staleCutoff: input.staleCutoff,
      });

      return {
        exportId: input.loaded.exportRecord.id,
        driveUploadStatus: "uploaded",
        driveFileId: found.file.id,
        driveUrl: found.file.webViewLink ?? "",
        reconciledFromDrive: true,
      };
    }

    await markFailed({
      repository: input.repository,
      loaded: input.loaded,
      user: input.user,
      error: new DriveError(
        DRIVE_ERROR_CODES.UPLOAD_STALE,
        409,
        "Stale Drive upload was reset for retry.",
      ),
      rootFolderId: input.rootFolderId,
      retryCount,
      staleCutoff: input.staleCutoff,
    });
  } catch (error) {
    const driveError = toDriveError(error);

    await markFailed({
      repository: input.repository,
      loaded: input.loaded,
      user: input.user,
      error: driveError,
      rootFolderId: input.rootFolderId,
      retryCount,
      staleCutoff: input.staleCutoff,
    });

    throw driveError;
  }

  const claimed = await input.repository.claimDriveUpload(
    input.loaded.exportRecord.id,
    new Date(),
  );

  if (!claimed) {
    throw new DriveError(
      DRIVE_ERROR_CODES.UPLOAD_IN_PROGRESS,
      409,
      "Drive upload could not be reclaimed.",
    );
  }

  return uploadClaimedArtifact({
    loaded: input.loaded,
    user: input.user,
    repository: input.repository,
    driveUploader: input.driveUploader,
    artifactStorage: input.artifactStorage,
    rootFolderId: input.rootFolderId,
    retryCount,
  });
}

export async function uploadShippingNoteExportToDrive(
  exportId: string,
  user: DbUser,
  dependencies: UploadShippingNoteExportToDriveDependencies = {},
): Promise<UploadShippingNoteExportToDriveResult> {
  requirePermission(user.role, PERMISSIONS.EXPORTS_UPLOAD);

  const repository = dependencies.repository ?? productionDriveUploadRepository;
  let config: ReturnType<typeof readGoogleDriveConfig> | null = null;
  let rootFolderId: string;

  if (dependencies.rootFolderId !== undefined) {
    rootFolderId = dependencies.rootFolderId;
  } else {
    config = readGoogleDriveConfig();
    rootFolderId = config.rootFolderId;
  }

  const driveUploader = dependencies.driveUploader ??
    new GoogleDriveArtifactUploader(config ?? undefined);
  const artifactStorage = dependencies.artifactStorage ?? getArtifactStorage();
  const now = dependencies.now ?? new Date();

  const loaded = await repository.loadExportForDriveUpload(exportId);

  if (!loaded) {
    throw new DriveError(
      DRIVE_ERROR_CODES.EXPORT_NOT_FOUND,
      404,
      "Export artifact was not found.",
    );
  }

  const completed = alreadyUploadedResult(loaded.exportRecord);

  if (completed) {
    return completed;
  }

  if (loaded.exportRecord.driveUploadStatus === "uploading") {
    if (isDriveUploadStale({
      driveUploadStatus: loaded.exportRecord.driveUploadStatus,
      updatedAt: loaded.exportRecord.updatedAt,
      now,
    })) {
      const eligibility = getDriveArtifactEligibility(loaded);

      if (!eligibility.eligible) {
        throw new DriveError(
          DRIVE_ERROR_CODES.ARTIFACT_NOT_ELIGIBLE,
          409,
          eligibility.reason,
        );
      }

      return recoverStaleDriveUpload({
        loaded,
        user,
        repository,
        driveUploader,
        artifactStorage,
        rootFolderId,
        staleCutoff: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS),
      });
    }

    throw new DriveError(
      DRIVE_ERROR_CODES.UPLOAD_IN_PROGRESS,
      409,
      "Drive upload is already in progress.",
    );
  }

  const eligibility = getDriveArtifactEligibility(loaded);

  if (!eligibility.eligible) {
    throw new DriveError(
      DRIVE_ERROR_CODES.ARTIFACT_NOT_ELIGIBLE,
      409,
      eligibility.reason,
    );
  }

  const claimed = await repository.claimDriveUpload(exportId, now);

  if (!claimed) {
    throw new DriveError(
      DRIVE_ERROR_CODES.UPLOAD_IN_PROGRESS,
      409,
      "Drive upload could not be claimed.",
    );
  }

  return uploadClaimedArtifact({
    loaded,
    user,
    repository,
    driveUploader,
    artifactStorage,
    rootFolderId,
    retryCount: 0,
  });
}
