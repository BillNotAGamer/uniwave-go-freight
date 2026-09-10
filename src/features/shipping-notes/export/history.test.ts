import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
  },
}));
vi.mock("@/features/shipping-notes/queries", () => ({
  getShippingNoteForUser: vi.fn(),
}));

import { db } from "@/lib/db/client";
import type { ShippingNoteExport, User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { getShippingNoteForUser } from "@/features/shipping-notes/queries";
import {
  listShippingNoteExportHistoryForUser,
  toExportHistoryItem,
} from "./history";

const mockedDb = vi.mocked(db);
const mockedGetShippingNoteForUser = vi.mocked(getShippingNoteForUser);

function user(role: User["role"]): User {
  return {
    id: `${role}-1`,
    email: `${role}@example.test`,
    name: role,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function exportRecord(overrides: Partial<ShippingNoteExport> = {}): ShippingNoteExport {
  const now = new Date("2026-08-23T00:00:00.000Z");
  return {
    id: "export-1",
    shippingNoteId: "note-1",
    exportType: "excel",
    version: 2,
    status: "generated",
    driveFileId: "drive-file-1",
    driveUrl: "https://drive.google.test/file/1",
    driveUploadStatus: "uploaded",
    driveUploadedAt: now,
    driveFolderId: "folder-1",
    driveErrorMessage: "DRIVE_UPLOAD_FAILED",
    artifactStorageKey: "private-key",
    artifactSizeBytes: 123,
    artifactMimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: "ShippingNote_TEST.xlsx",
    checksum: "ABC123",
    errorMessage: "raw generation error",
    generatedById: "user-1",
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("export history read model", () => {
  it("denies Sale before querying history", async () => {
    await expect(listShippingNoteExportHistoryForUser("note-1", user("sale"))).rejects
      .toBeInstanceOf(AuthorizationError);
  });

  it("maps safe DTO fields without storage keys or Drive folder IDs", () => {
    const item = toExportHistoryItem({
      row: {
        exportRecord: exportRecord(),
        generatedBy: {
          name: "Accountant",
          email: "accountant@example.test",
        },
      },
      note: {
        id: "note-1",
        status: "checked",
        deletedAt: null,
      },
      viewer: user("accountant"),
    });

    expect(item).toMatchObject({
      id: "export-1",
      exportType: "excel",
      version: 2,
      artifactAvailable: true,
      generatedByDisplay: "Accountant",
      driveUrl: "https://drive.google.test/file/1",
      driveErrorCode: null,
    });
    expect(item).not.toHaveProperty("artifactStorageKey");
    expect(item).not.toHaveProperty("driveFolderId");
    expect(item).not.toHaveProperty("errorMessage");
  });

  it("shows sanitized Drive error codes only to Admin", () => {
    const adminItem = toExportHistoryItem({
      row: {
        exportRecord: exportRecord({ driveUploadStatus: "upload_failed" }),
        generatedBy: null,
      },
      note: {
        id: "note-1",
        status: "checked",
        deletedAt: null,
      },
      viewer: user("admin"),
    });

    expect(adminItem.driveErrorCode).toBe("DRIVE_UPLOAD_FAILED");
  });

  it("allows Accountant/Admin and applies newest-first ordering in the query", async () => {
    const orderBy = vi.fn().mockResolvedValue([
      {
        exportRecord: exportRecord(),
        generatedBy: {
          name: "Accountant",
          email: "accountant@example.test",
        },
      },
    ]);
    const where = vi.fn(() => ({ orderBy }));
    const innerJoin = vi.fn(() => ({ where }));
    const leftJoin = vi.fn(() => ({ innerJoin }));
    const from = vi.fn(() => ({ leftJoin }));
    mockedDb.select.mockReturnValue({ from } as never);
    mockedGetShippingNoteForUser.mockResolvedValue({
      id: "note-1",
      jobsheetNo: "JOB-1",
      shippingMode: "domestic_truck",
      shipperPartnerId: null,
      consigneePartnerId: null,
      customerPartnerId: null,
      agentPartnerId: null,
      shipperText: null,
      consigneeText: null,
      status: "checked",
      mawbHawbNo: null,
      customerText: null,
      agentText: null,
      domesticOrigin: null,
      domesticDestination: null,
      airOrigin: null,
      airDestination: null,
      aol: null,
      aod: null,
      portOfLoading: null,
      portOfDischarge: null,
      finalDestination: null,
      mawbNo: null,
      hawbNo: null,
      mblNo: null,
      hblNo: null,
      flightNo: null,
      vesselName: null,
      voyageNo: null,
      etd: null,
      eta: null,
      volumeValue: null,
      volumeUnit: null,
      exchangeRate: "1",
      createdById: "sale-1",
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(listShippingNoteExportHistoryForUser("note-1", user("accountant")))
      .resolves.toHaveLength(1);
    await expect(listShippingNoteExportHistoryForUser("note-1", user("admin")))
      .resolves.toHaveLength(1);
    expect(orderBy).toHaveBeenCalled();
  });
});
