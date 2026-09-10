import type { Role } from "@/lib/permissions/roles";
import type { ShippingNoteExport } from "@/lib/db/schema";

export type ExportHistoryActionStatus = Pick<
  ShippingNoteExport,
  "driveUploadStatus"
> & {
  artifactAvailable: boolean;
  isDriveUploadStale: boolean;
  driveUrl: string | null;
};

export type DriveHistoryAction =
  | "upload"
  | "retry"
  | "wait"
  | "recover"
  | "view"
  | null;

export function canViewExportHistory(role: Role): boolean {
  return role === "accountant" || role === "admin";
}

export function canDownloadHistoricalArtifact(role: Role): boolean {
  return canViewExportHistory(role);
}

export function canMutateDriveUpload(role: Role): boolean {
  return role === "admin";
}

export function getDriveHistoryAction(input: {
  role: Role;
  row: ExportHistoryActionStatus;
}): DriveHistoryAction {
  if (!input.row.artifactAvailable) {
    return null;
  }

  if (input.row.driveUploadStatus === "uploaded") {
    return input.row.driveUrl ? "view" : null;
  }

  if (!canMutateDriveUpload(input.role)) {
    return null;
  }

  if (input.row.driveUploadStatus === "not_uploaded") {
    return "upload";
  }

  if (input.row.driveUploadStatus === "upload_failed") {
    return "retry";
  }

  if (input.row.driveUploadStatus === "uploading") {
    return input.row.isDriveUploadStale ? "recover" : "wait";
  }

  return null;
}
