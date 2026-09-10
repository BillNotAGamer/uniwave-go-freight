import { describe, expect, it } from "vitest";

import {
  canDownloadHistoricalArtifact,
  canMutateDriveUpload,
  canViewExportHistory,
  getDriveHistoryAction,
} from "./history-ui-policy";

const baseRow = {
  artifactAvailable: true,
  driveUploadStatus: "not_uploaded" as const,
  isDriveUploadStale: false,
  driveUrl: null,
};

describe("export history UI policy", () => {
  it("allows history/download to Accountant and Admin only", () => {
    expect(canViewExportHistory("sale")).toBe(false);
    expect(canViewExportHistory("accountant")).toBe(true);
    expect(canViewExportHistory("admin")).toBe(true);
    expect(canDownloadHistoricalArtifact("sale")).toBe(false);
    expect(canDownloadHistoricalArtifact("accountant")).toBe(true);
    expect(canDownloadHistoricalArtifact("admin")).toBe(true);
  });

  it("allows Drive mutation controls to Admin only", () => {
    expect(canMutateDriveUpload("sale")).toBe(false);
    expect(canMutateDriveUpload("accountant")).toBe(false);
    expect(canMutateDriveUpload("admin")).toBe(true);
  });

  it.each([
    ["not_uploaded", false, "upload"],
    ["upload_failed", false, "retry"],
    ["uploading", false, "wait"],
    ["uploading", true, "recover"],
    ["uploaded", false, "view"],
  ] as const)(
    "maps Admin Drive status %s stale=%s to %s",
    (driveUploadStatus, isDriveUploadStale, action) => {
      expect(getDriveHistoryAction({
        role: "admin",
        row: {
          ...baseRow,
          driveUploadStatus,
          isDriveUploadStale,
          driveUrl: driveUploadStatus === "uploaded"
            ? "https://drive.google.test/file"
            : null,
        },
      })).toBe(action);
    },
  );

  it("does not expose Drive mutation actions to Accountant", () => {
    expect(getDriveHistoryAction({
      role: "accountant",
      row: baseRow,
    })).toBeNull();
    expect(getDriveHistoryAction({
      role: "accountant",
      row: {
        ...baseRow,
        driveUploadStatus: "uploaded",
        driveUrl: "https://drive.google.test/file",
      },
    })).toBe("view");
  });

  it("does not offer actions when artifact is unavailable", () => {
    expect(getDriveHistoryAction({
      role: "admin",
      row: {
        ...baseRow,
        artifactAvailable: false,
      },
    })).toBeNull();
  });
});
