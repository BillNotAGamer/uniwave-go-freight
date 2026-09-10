import { describe, expect, it } from "vitest";

import { INTERNAL_PDF_MIME_TYPE, INTERNAL_XLSX_MIME_TYPE } from "../constants";
import {
  buildDriveAppProperties,
  getDriveArtifactEligibility,
  type DriveUploadExportContract,
  type DriveUploadNoteContract,
} from "./policy";

const baseExport: DriveUploadExportContract = {
  id: "export-1",
  shippingNoteId: "note-1",
  exportType: "excel",
  version: 2,
  status: "generated",
  artifactStorageKey: "shipping-note-exports/export-1/artifact.xlsx",
  artifactSizeBytes: 123,
  artifactMimeType: INTERNAL_XLSX_MIME_TYPE,
  checksum: "ABC",
  fileName: "ShippingNote_TEST.xlsx",
};

function note(status: DriveUploadNoteContract["status"]): DriveUploadNoteContract {
  return {
    id: "note-1",
    status,
    deletedAt: null,
  };
}

describe("Drive artifact upload eligibility", () => {
  it.each([
    "checked",
    "approved",
    "locked",
    "accounting_reviewing",
    "cancelled",
  ] as const)("allows historical generated artifacts when current status is %s", (status) => {
    expect(getDriveArtifactEligibility({
      exportRecord: baseExport,
      note: note(status),
    })).toStrictEqual({ eligible: true });
  });

  it("denies soft-deleted owning notes", () => {
    expect(getDriveArtifactEligibility({
      exportRecord: baseExport,
      note: { ...note("checked"), deletedAt: new Date() },
    })).toMatchObject({ eligible: false });
  });

  it.each(["pending", "failed"] as const)("denies %s generation status", (status) => {
    expect(getDriveArtifactEligibility({
      exportRecord: { ...baseExport, status },
      note: note("checked"),
    })).toMatchObject({ eligible: false });
  });

  it("requires durable artifact metadata", () => {
    expect(getDriveArtifactEligibility({
      exportRecord: { ...baseExport, artifactStorageKey: null },
      note: note("checked"),
    })).toMatchObject({ eligible: false });
  });

  it("supports XLSX v2 and PDF v1 only", () => {
    expect(getDriveArtifactEligibility({
      exportRecord: baseExport,
      note: note("checked"),
    })).toStrictEqual({ eligible: true });
    expect(getDriveArtifactEligibility({
      exportRecord: {
        ...baseExport,
        exportType: "pdf",
        version: 1,
        artifactMimeType: INTERNAL_PDF_MIME_TYPE,
        artifactStorageKey: "shipping-note-exports/export-1/artifact.pdf",
        fileName: "ShippingNote_TEST.pdf",
      },
      note: note("checked"),
    })).toStrictEqual({ eligible: true });
    expect(getDriveArtifactEligibility({
      exportRecord: { ...baseExport, version: 1 },
      note: note("checked"),
    })).toMatchObject({ eligible: false });
  });

  it("builds private idempotency appProperties without business-sensitive fields", () => {
    expect(buildDriveAppProperties(baseExport)).toStrictEqual({
      uniwaveExportId: "export-1",
      uniwaveShippingNoteId: "note-1",
      uniwaveExportType: "excel",
      uniwaveExportVersion: "2",
      uniwaveChecksumSha256: "ABC",
    });
  });
});
