import type { ShippingNoteStatus } from "@/features/shipping-notes/constants";
import type { ShippingNoteExport } from "@/lib/db/schema";
import {
  INTERNAL_PDF_METADATA_VERSION,
  INTERNAL_PDF_MIME_TYPE,
  INTERNAL_XLSX_METADATA_VERSION,
  INTERNAL_XLSX_MIME_TYPE,
} from "../constants";
import type { DriveAppProperties } from "@/lib/drive/types";

export type DriveUploadExportContract = Pick<
  ShippingNoteExport,
  | "id"
  | "shippingNoteId"
  | "exportType"
  | "version"
  | "status"
  | "artifactStorageKey"
  | "artifactSizeBytes"
  | "artifactMimeType"
  | "checksum"
  | "fileName"
>;

export type DriveUploadNoteContract = {
  id: string;
  status: ShippingNoteStatus;
  deletedAt: Date | null;
};

export type DriveArtifactEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

function hasDurableMetadata(exportRecord: DriveUploadExportContract): boolean {
  return Boolean(
    exportRecord.artifactStorageKey &&
    exportRecord.artifactSizeBytes !== null &&
    exportRecord.artifactMimeType &&
    exportRecord.checksum &&
    exportRecord.fileName,
  );
}

function hasSupportedArtifactContract(
  exportRecord: DriveUploadExportContract,
): boolean {
  return (
    (
      exportRecord.exportType === "excel" &&
      exportRecord.version === INTERNAL_XLSX_METADATA_VERSION &&
      exportRecord.artifactMimeType === INTERNAL_XLSX_MIME_TYPE
    ) ||
    (
      exportRecord.exportType === "pdf" &&
      exportRecord.version === INTERNAL_PDF_METADATA_VERSION &&
      exportRecord.artifactMimeType === INTERNAL_PDF_MIME_TYPE
    )
  );
}

export function getDriveArtifactEligibility(input: {
  exportRecord: DriveUploadExportContract;
  note: DriveUploadNoteContract;
}): DriveArtifactEligibility {
  if (input.note.deletedAt) {
    return {
      eligible: false,
      reason: "Owning shipping note is soft-deleted.",
    };
  }

  if (input.exportRecord.status !== "generated") {
    return {
      eligible: false,
      reason: "Only generated durable artifacts can be uploaded.",
    };
  }

  if (!hasDurableMetadata(input.exportRecord)) {
    return {
      eligible: false,
      reason: "Export artifact is missing durable storage metadata.",
    };
  }

  if (!hasSupportedArtifactContract(input.exportRecord)) {
    return {
      eligible: false,
      reason: "Export artifact contract is not supported for Drive upload.",
    };
  }

  return { eligible: true };
}

export function buildDriveAppProperties(
  exportRecord: DriveUploadExportContract,
): DriveAppProperties {
  return {
    uniwaveExportId: exportRecord.id,
    uniwaveShippingNoteId: exportRecord.shippingNoteId,
    uniwaveExportType: exportRecord.exportType,
    uniwaveExportVersion: exportRecord.version.toString(),
    uniwaveChecksumSha256: exportRecord.checksum ?? "",
  };
}
