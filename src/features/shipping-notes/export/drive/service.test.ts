import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: {},
}));
vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock("@/lib/drive/google-drive", () => ({
  GoogleDriveArtifactUploader: vi.fn(),
}));
vi.mock("@/lib/drive/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/config")>();
  return {
    ...actual,
    readGoogleDriveConfig: vi.fn(() => ({
      credentials: {
        client_email: "drive-bot@example.test",
        private_key: "key",
      },
      rootFolderId: "root-folder-1",
      scope: actual.GOOGLE_DRIVE_SCOPE,
      requestTimeoutMs: 30_000,
      maxAdditionalRetries: 2,
    })),
  };
});
vi.mock("@/lib/artifact-storage", () => ({
  getArtifactStorage: vi.fn(),
}));

import { calculateArtifactSha256 } from "@/lib/artifact-storage/checksum";
import { ARTIFACT_STORAGE_ERROR_CODES, ArtifactStorageError } from "@/lib/artifact-storage/errors";
import { FakeArtifactStorage } from "@/lib/artifact-storage/fake";
import { DRIVE_ERROR_CODES } from "@/lib/drive/errors";
import { FakeDriveArtifactUploader } from "@/lib/drive/fake";
import type { ShippingNoteExport, User } from "@/lib/db/schema";
import type { DriveUploadRepository, DriveUploadLoadedExport } from "./repository";
import {
  DRIVE_UPLOAD_STALE_AFTER_MS,
  isDriveUploadStale,
  uploadShippingNoteExportToDrive,
} from "./service";

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
  const now = new Date("2026-08-22T00:00:00.000Z");
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
    artifactSizeBytes: 8,
    artifactMimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: "ShippingNote_TEST.xlsx",
    checksum: calculateArtifactSha256(Buffer.from("artifact")),
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

function repository(row: DriveUploadLoadedExport | null): DriveUploadRepository & {
  claims: string[];
  successes: number;
  failures: Array<{ code: string }>;
} {
  return {
    claims: [],
    successes: 0,
    failures: [],
    async loadExportForDriveUpload() {
      return row;
    },
    async claimDriveUpload(exportId) {
      this.claims.push(exportId);
      return true;
    },
    async markDriveUploadSucceeded() {
      this.successes += 1;
      return row?.exportRecord ?? exportRecord();
    },
    async markDriveUploadFailed(input) {
      this.failures.push({ code: input.code });
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

describe("Drive upload orchestration", () => {
  it("short-circuits already uploaded records without Drive or storage calls", async () => {
    const row = loaded({
      driveUploadStatus: "uploaded",
      driveFileId: "drive-file-1",
      driveUrl: "https://drive.google.test/file/1",
    });
    const repo = repository(row);
    const drive = new FakeDriveArtifactUploader();

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: drive,
      artifactStorage: new FakeArtifactStorage(),
      rootFolderId: "root-folder-1",
    })).resolves.toMatchObject({
      driveFileId: "drive-file-1",
      driveUrl: "https://drive.google.test/file/1",
    });

    expect(repo.claims).toHaveLength(0);
    expect(drive.uploads).toHaveLength(0);
  });

  it("claims not_uploaded records and creates a Drive file from verified artifact bytes", async () => {
    const row = loaded();
    const repo = repository(row);
    const drive = new FakeDriveArtifactUploader();
    const storage = await storageFor(row);

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: drive,
      artifactStorage: storage,
      rootFolderId: "root-folder-1",
    })).resolves.toMatchObject({
      driveUploadStatus: "uploaded",
      driveFileId: "fake-drive-file-1",
    });

    expect(repo.claims).toStrictEqual([row.exportRecord.id]);
    expect(repo.successes).toBe(1);
    expect(drive.uploads).toHaveLength(1);
    expect(drive.uploads[0]).toMatchObject({
      fileName: "ShippingNote_TEST.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      parentFolderId: "root-folder-1",
    });
  });

  it("allows retry from upload_failed state", async () => {
    const row = loaded({ driveUploadStatus: "upload_failed" });
    const repo = repository(row);
    const storage = await storageFor(row);

    await uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: storage,
      rootFolderId: "root-folder-1",
    });

    expect(repo.claims).toStrictEqual([row.exportRecord.id]);
  });

  it("rejects uploading conflict without stealing an active claim", async () => {
    const now = new Date("2026-08-23T00:20:00.000Z");
    const row = loaded({
      driveUploadStatus: "uploading",
      updatedAt: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS + 1),
    });
    const repo = repository(row);

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: new FakeArtifactStorage(),
      rootFolderId: "root-folder-1",
      now,
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.UPLOAD_IN_PROGRESS,
    });
    expect(repo.claims).toHaveLength(0);
  });

  it("detects stale uploading records only at or beyond the server threshold", () => {
    const now = new Date("2026-08-23T00:10:00.000Z");

    expect(isDriveUploadStale({
      driveUploadStatus: "uploading",
      updatedAt: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS + 1),
      now,
    })).toBe(false);
    expect(isDriveUploadStale({
      driveUploadStatus: "uploading",
      updatedAt: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS),
      now,
    })).toBe(true);
    expect(isDriveUploadStale({
      driveUploadStatus: "upload_failed",
      updatedAt: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS),
      now,
    })).toBe(false);
  });

  it("reconciles an existing matching Drive file instead of creating a duplicate", async () => {
    const row = loaded();
    const repo = repository(row);
    const drive = new FakeDriveArtifactUploader();
    drive.seedFile({
      id: "existing-drive-file",
      name: "ShippingNote_TEST.xlsx",
      webViewLink: "https://drive.google.test/file/existing",
      appProperties: {
        uniwaveExportId: row.exportRecord.id,
        uniwaveShippingNoteId: row.exportRecord.shippingNoteId,
        uniwaveExportType: row.exportRecord.exportType,
        uniwaveExportVersion: row.exportRecord.version.toString(),
        uniwaveChecksumSha256: row.exportRecord.checksum ?? "",
      },
      parents: ["root-folder-1"],
    });

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: drive,
      artifactStorage: await storageFor(row),
      rootFolderId: "root-folder-1",
    })).resolves.toMatchObject({
      driveFileId: "existing-drive-file",
      reconciledFromDrive: true,
    });
    expect(drive.uploads).toHaveLength(0);
  });

  it("recovers stale uploading by reconciling an exact Drive match without creating a duplicate", async () => {
    const now = new Date("2026-08-23T00:20:00.000Z");
    const row = loaded({
      driveUploadStatus: "uploading",
      updatedAt: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS),
    });
    const repo = repository(row);
    const drive = new FakeDriveArtifactUploader();
    drive.seedFile({
      id: "existing-drive-file",
      name: "ShippingNote_TEST.xlsx",
      webViewLink: "https://drive.google.test/file/existing",
      appProperties: {
        uniwaveExportId: row.exportRecord.id,
        uniwaveShippingNoteId: row.exportRecord.shippingNoteId,
        uniwaveExportType: row.exportRecord.exportType,
        uniwaveExportVersion: row.exportRecord.version.toString(),
        uniwaveChecksumSha256: row.exportRecord.checksum ?? "",
      },
      parents: ["root-folder-1"],
    });

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: drive,
      artifactStorage: new FakeArtifactStorage(),
      rootFolderId: "root-folder-1",
      now,
    })).resolves.toMatchObject({
      driveFileId: "existing-drive-file",
      reconciledFromDrive: true,
    });

    expect(repo.claims).toHaveLength(0);
    expect(repo.successes).toBe(1);
    expect(drive.uploads).toHaveLength(0);
  });

  it("recovers stale uploading with no Drive match by marking stale then retrying one upload", async () => {
    const now = new Date("2026-08-23T00:20:00.000Z");
    const row = loaded({
      driveUploadStatus: "uploading",
      updatedAt: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS),
    });
    const repo = repository(row);
    const drive = new FakeDriveArtifactUploader();

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: drive,
      artifactStorage: await storageFor(row),
      rootFolderId: "root-folder-1",
      now,
    })).resolves.toMatchObject({
      driveUploadStatus: "uploaded",
      driveFileId: "fake-drive-file-1",
    });

    expect(repo.failures[0]).toStrictEqual({
      code: DRIVE_ERROR_CODES.UPLOAD_STALE,
    });
    expect(repo.claims).toStrictEqual([row.exportRecord.id]);
    expect(drive.uploads).toHaveLength(1);
  });

  it("stale recovery fails safely for duplicate and conflicting Drive metadata", async () => {
    const now = new Date("2026-08-23T00:20:00.000Z");
    const row = loaded({
      driveUploadStatus: "uploading",
      updatedAt: new Date(now.getTime() - DRIVE_UPLOAD_STALE_AFTER_MS),
    });
    const matchingProps = {
      uniwaveExportId: row.exportRecord.id,
      uniwaveShippingNoteId: row.exportRecord.shippingNoteId,
      uniwaveExportType: row.exportRecord.exportType,
      uniwaveExportVersion: row.exportRecord.version.toString(),
      uniwaveChecksumSha256: row.exportRecord.checksum ?? "",
    };
    const duplicateRepo = repository(row);
    const duplicateDrive = new FakeDriveArtifactUploader();
    duplicateDrive.seedFile({
      id: "duplicate-1",
      name: "one",
      webViewLink: "https://drive.google.test/1",
      appProperties: matchingProps,
      parents: ["root-folder-1"],
    });
    duplicateDrive.seedFile({
      id: "duplicate-2",
      name: "two",
      webViewLink: "https://drive.google.test/2",
      appProperties: matchingProps,
      parents: ["root-folder-1"],
    });

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: duplicateRepo,
      driveUploader: duplicateDrive,
      artifactStorage: await storageFor(row),
      rootFolderId: "root-folder-1",
      now,
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.DUPLICATE_ARTIFACT,
    });
    expect(duplicateRepo.failures).toStrictEqual([{
      code: DRIVE_ERROR_CODES.DUPLICATE_ARTIFACT,
    }]);
    expect(duplicateDrive.uploads).toHaveLength(0);

    const conflictRepo = repository(row);
    const conflictDrive = new FakeDriveArtifactUploader();
    conflictDrive.seedFile({
      id: "conflict",
      name: "bad",
      webViewLink: "https://drive.google.test/bad",
      appProperties: { ...matchingProps, uniwaveShippingNoteId: "wrong-note" },
      parents: ["root-folder-1"],
    });

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: conflictRepo,
      driveUploader: conflictDrive,
      artifactStorage: await storageFor(row),
      rootFolderId: "root-folder-1",
      now,
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.RECONCILIATION_CONFLICT,
    });
    expect(conflictRepo.failures).toStrictEqual([{
      code: DRIVE_ERROR_CODES.RECONCILIATION_CONFLICT,
    }]);
    expect(conflictDrive.uploads).toHaveLength(0);
  });

  it("fails safely for duplicate Drive matches and mismatched reconciliation metadata", async () => {
    const row = loaded();
    const repo = repository(row);
    const duplicateDrive = new FakeDriveArtifactUploader();
    const matchingProps = {
      uniwaveExportId: row.exportRecord.id,
      uniwaveShippingNoteId: row.exportRecord.shippingNoteId,
      uniwaveExportType: row.exportRecord.exportType,
      uniwaveExportVersion: row.exportRecord.version.toString(),
      uniwaveChecksumSha256: row.exportRecord.checksum ?? "",
    };
    duplicateDrive.seedFile({
      id: "duplicate-1",
      name: "one",
      webViewLink: "https://drive.google.test/1",
      appProperties: matchingProps,
      parents: ["root-folder-1"],
    });
    duplicateDrive.seedFile({
      id: "duplicate-2",
      name: "two",
      webViewLink: "https://drive.google.test/2",
      appProperties: matchingProps,
      parents: ["root-folder-1"],
    });

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: duplicateDrive,
      artifactStorage: await storageFor(row),
      rootFolderId: "root-folder-1",
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.DUPLICATE_ARTIFACT,
    });
    expect(repo.failures.at(-1)).toStrictEqual({
      code: DRIVE_ERROR_CODES.DUPLICATE_ARTIFACT,
    });

    const mismatchRepo = repository(row);
    const mismatchDrive = new FakeDriveArtifactUploader();
    mismatchDrive.seedFile({
      id: "mismatch",
      name: "bad",
      webViewLink: "https://drive.google.test/bad",
      appProperties: { ...matchingProps, uniwaveChecksumSha256: "DIFFERENT" },
      parents: ["root-folder-1"],
    });

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: mismatchRepo,
      driveUploader: mismatchDrive,
      artifactStorage: await storageFor(row),
      rootFolderId: "root-folder-1",
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.RECONCILIATION_CONFLICT,
    });
  });

  it("blocks checksum mismatch before calling Google and records sanitized failure", async () => {
    const row = loaded({
      checksum: calculateArtifactSha256(Buffer.from("different")),
    });
    const repo = repository(row);
    const storage = new FakeArtifactStorage();
    await storage.put({
      key: row.exportRecord.artifactStorageKey ?? "missing",
      body: Buffer.from("artifact"),
      mimeType: row.exportRecord.artifactMimeType ?? "application/octet-stream",
      checksumSha256: "unused",
      exportId: row.exportRecord.id,
    });
    const drive = new FakeDriveArtifactUploader();

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: drive,
      artifactStorage: storage,
      rootFolderId: "root-folder-1",
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.ARTIFACT_CHECKSUM_MISMATCH,
    });

    expect(drive.uploads).toHaveLength(0);
    expect(repo.failures).toStrictEqual([{
      code: DRIVE_ERROR_CODES.ARTIFACT_CHECKSUM_MISMATCH,
    }]);
  });

  it("denies missing storage metadata before claiming upload", async () => {
    const row = loaded({ artifactStorageKey: null });
    const repo = repository(row);

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: new FakeArtifactStorage(),
      rootFolderId: "root-folder-1",
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.ARTIFACT_NOT_ELIGIBLE,
    });
    expect(repo.claims).toHaveLength(0);
  });

  it("denies Sale and Accountant through EXPORTS_UPLOAD", async () => {
    const row = loaded();
    const repo = repository(row);

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("sale"), {
      repository: repo,
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: new FakeArtifactStorage(),
      rootFolderId: "root-folder-1",
    })).rejects.toThrow(/permission/i);
    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("accountant"), {
      repository: repo,
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: new FakeArtifactStorage(),
      rootFolderId: "root-folder-1",
    })).rejects.toThrow(/permission/i);
    expect(repo.claims).toHaveLength(0);
  });

  it.each(["accounting_reviewing", "cancelled", "locked", "approved", "checked"] as const)(
    "does not treat current note status %s as generation eligibility",
    async (status) => {
      const row = {
        ...loaded(),
        note: {
          id: "note-1",
          status,
          deletedAt: null,
        },
      };
      const repo = repository(row);

      await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
        repository: repo,
        driveUploader: new FakeDriveArtifactUploader(),
        artifactStorage: await storageFor(row),
        rootFolderId: "root-folder-1",
      })).resolves.toMatchObject({ driveUploadStatus: "uploaded" });
    },
  );

  it("persists sanitized storage-read failures without changing generation status", async () => {
    const row = loaded();
    const repo = repository(row);
    const storage = {
      async put() {
        throw new Error("unused");
      },
      async get() {
        throw new ArtifactStorageError(
          ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
          "Raw storage path unavailable.",
        );
      },
    };

    await expect(uploadShippingNoteExportToDrive(row.exportRecord.id, user("admin"), {
      repository: repo,
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: storage,
      rootFolderId: "root-folder-1",
    })).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.ARTIFACT_STORAGE_READ_FAILED,
    });
    expect(repo.failures).toStrictEqual([{
      code: DRIVE_ERROR_CODES.ARTIFACT_STORAGE_READ_FAILED,
    }]);
  });
});
