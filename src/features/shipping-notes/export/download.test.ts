import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: {},
}));
vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: vi.fn(),
}));

import { calculateArtifactSha256 } from "@/lib/artifact-storage/checksum";
import { FakeArtifactStorage } from "@/lib/artifact-storage/fake";
import type { ShippingNoteExport, User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { EXPORT_ERROR_CODES } from "./errors";
import { getHistoricalExportDownloadForUser } from "./download";
import type { DriveUploadLoadedExport, DriveUploadRepository } from "./drive/repository";

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
  const bytes = Buffer.from("artifact");

  return {
    id: "11111111-1111-4111-8111-111111111111",
    shippingNoteId: "note-1",
    exportType: "excel",
    version: 2,
    status: "generated",
    driveFileId: null,
    driveUrl: null,
    driveUploadStatus: "not_uploaded",
    driveUploadedAt: null,
    driveFolderId: null,
    driveErrorMessage: null,
    artifactStorageKey: "shipping-note-exports/11111111-1111-4111-8111-111111111111/artifact.xlsx",
    artifactSizeBytes: bytes.byteLength,
    artifactMimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: "ShippingNote_TEST.xlsx",
    checksum: calculateArtifactSha256(bytes),
    errorMessage: null,
    generatedById: "accountant-1",
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function loaded(overrides: Partial<ShippingNoteExport> = {}): DriveUploadLoadedExport {
  return {
    exportRecord: exportRecord(overrides),
    note: {
      id: "note-1",
      status: "checked",
      deletedAt: null,
    },
  };
}

function repository(row: DriveUploadLoadedExport | null): DriveUploadRepository {
  return {
    async loadExportForDriveUpload() {
      return row;
    },
    async claimDriveUpload() {
      return false;
    },
    async markDriveUploadSucceeded() {
      return row?.exportRecord ?? exportRecord();
    },
    async markDriveUploadFailed() {
      return row?.exportRecord ?? exportRecord();
    },
  };
}

async function storageFor(row: DriveUploadLoadedExport): Promise<FakeArtifactStorage> {
  const storage = new FakeArtifactStorage();
  await storage.put({
    key: row.exportRecord.artifactStorageKey ?? "missing",
    body: Buffer.from("artifact"),
    mimeType: row.exportRecord.artifactMimeType ?? "application/octet-stream",
    checksumSha256: row.exportRecord.checksum ?? "",
    exportId: row.exportRecord.id,
  });
  return storage;
}

describe("historical export download service", () => {
  it("denies Sale and allows Accountant/Admin for generated durable XLSX", async () => {
    const row = loaded();
    const storage = await storageFor(row);

    await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("sale"), {
      repository: repository(row),
      artifactStorage: storage,
    })).rejects.toBeInstanceOf(AuthorizationError);

    await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("accountant"), {
      repository: repository(row),
      artifactStorage: storage,
    })).resolves.toMatchObject({
      fileName: "ShippingNote_TEST.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("admin"), {
      repository: repository(row),
      artifactStorage: storage,
    })).resolves.toMatchObject({
      exportId: row.exportRecord.id,
    });
  });

  it("allows generated durable PDF v1", async () => {
    const pdfBytes = Buffer.from("artifact");
    const row = loaded({
      exportType: "pdf",
      version: 1,
      artifactStorageKey: "shipping-note-exports/11111111-1111-4111-8111-111111111111/artifact.pdf",
      artifactMimeType: "application/pdf",
      fileName: "ShippingNote_TEST.pdf",
      checksum: calculateArtifactSha256(pdfBytes),
    });
    const storage = await storageFor(row);

    await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("accountant"), {
      repository: repository(row),
      artifactStorage: storage,
    })).resolves.toMatchObject({
      fileName: "ShippingNote_TEST.pdf",
      mimeType: "application/pdf",
    });
  });

  it.each([
    { status: "pending" as const },
    { status: "failed" as const },
    { artifactStorageKey: null },
    { version: 1 },
    { artifactMimeType: "text/plain" },
  ])("denies unavailable or unsupported artifacts %#", async (override) => {
    const row = loaded(override);

    await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("admin"), {
      repository: repository(row),
      artifactStorage: new FakeArtifactStorage(),
    })).rejects.toMatchObject({
      code: EXPORT_ERROR_CODES.STATUS_NOT_ELIGIBLE,
    });
  });

  it("denies soft-deleted owning notes", async () => {
    const row = {
      ...loaded(),
      note: {
        id: "note-1",
        status: "checked" as const,
        deletedAt: new Date(),
      },
    };

    await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("admin"), {
      repository: repository(row),
      artifactStorage: new FakeArtifactStorage(),
    })).rejects.toMatchObject({
      code: EXPORT_ERROR_CODES.STATUS_NOT_ELIGIBLE,
    });
  });

  it("blocks checksum mismatch and does not return corrupted bytes", async () => {
    const row = loaded({
      checksum: calculateArtifactSha256(Buffer.from("different")),
    });
    const storage = new FakeArtifactStorage();
    await storage.put({
      key: row.exportRecord.artifactStorageKey ?? "missing",
      body: Buffer.from("artifact"),
      mimeType: row.exportRecord.artifactMimeType ?? "application/octet-stream",
      checksumSha256: "unused",
      exportId: row.exportRecord.id,
    });

    await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("admin"), {
      repository: repository(row),
      artifactStorage: storage,
    })).rejects.toMatchObject({
      code: EXPORT_ERROR_CODES.ARTIFACT_CHECKSUM_MISMATCH,
    });
  });

  it.each(["accounting_reviewing", "cancelled", "checked", "approved", "locked"] as const)(
    "allows historical download when current note status is %s",
    async (status) => {
      const row = {
        ...loaded(),
        note: {
          id: "note-1",
          status,
          deletedAt: null,
        },
      };

      await expect(getHistoricalExportDownloadForUser(row.exportRecord.id, user("admin"), {
        repository: repository(row),
        artifactStorage: await storageFor(row),
      })).resolves.toMatchObject({
        exportId: row.exportRecord.id,
      });
    },
  );
});
