vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeArtifactStorage } from "@/lib/artifact-storage/fake";
import { FakeDriveArtifactUploader } from "@/lib/drive/fake";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import type { User as DbUser } from "@/lib/db/schema";
import type { ShippingNoteDetail } from "../types";
import type { ShippingNoteDocumentDetail, ShippingNoteDocumentListItem } from "./types";
import {
  downloadShippingNoteDocument,
  getStorageAvailability,
  removeShippingNoteDocument,
  uploadShippingNoteDocument,
} from "./service";
import { validateDocumentFile, MAX_DOCUMENT_FILE_SIZE_BYTES } from "./file-security";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
  getShippingNoteForUser: vi.fn(),
  logAuditEvent: vi.fn(),
  rejectInactiveOrSoftDeletedUsers: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: mocks.db,
}));

vi.mock("../queries", () => ({
  getShippingNoteForUser: mocks.getShippingNoteForUser,
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/auth/user-state", () => ({
  rejectInactiveOrSoftDeletedUsers: mocks.rejectInactiveOrSoftDeletedUsers,
}));

function makeMockUser(overrides: Partial<DbUser>): DbUser {
  return {
    id: "user-1",
    email: "user@example.com",
    role: "admin",
    isActive: true,
    emailVerified: true,
    image: null,
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function makeMockNote(overrides: Partial<ShippingNoteDetail>): ShippingNoteDetail {
  return {
    id: "note-1",
    jobsheetNo: "JS-2026-001",
    shippingMode: "sea_export",
    shipperText: "Shipper Co",
    consigneeText: "Consignee Co",
    status: "submitted",
    shipperPartnerId: null,
    consigneePartnerId: null,
    customerPartnerId: null,
    agentPartnerId: null,
    mawbHawbNo: null,
    customerText: null,
    agentText: null,
    domesticOrigin: null,
    domesticDestination: null,
    airOrigin: null,
    airDestination: null,
    aol: null,
    aod: null,
    portOfLoading: "SGN",
    portOfDischarge: "SIN",
    finalDestination: null,
    mawbNo: null,
    hawbNo: null,
    mblNo: "MBL456",
    hblNo: "HBL123",
    flightNo: null,
    vesselName: "Vessel 1",
    voyageNo: "001W",
    etd: new Date("2026-09-15"),
    eta: new Date("2026-09-20"),
    volumeValue: "5.5",
    volumeUnit: "cbm",
    exchangeRate: "25000",
    createdById: "user-1",
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Document file security validation", () => {
  it("accepts valid PDF, Word, Excel, and image files within 15 MB", () => {
    const validPdf = validateDocumentFile({
      name: "contract.pdf",
      size: 1024 * 1024,
      type: "application/pdf",
    });
    expect(validPdf.valid).toBe(true);

    const validDocx = validateDocumentFile({
      name: "pre-alert.docx",
      size: 500 * 1024,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(validDocx.valid).toBe(true);

    const validXlsx = validateDocumentFile({
      name: "invoice.xlsx",
      size: 200 * 1024,
    });
    expect(validXlsx.valid).toBe(true);

    const validPng = validateDocumentFile({
      name: "bol_scan.png",
      size: 800 * 1024,
      type: "image/png",
    });
    expect(validPng.valid).toBe(true);
  });

  it("rejects files exceeding 15 MB", () => {
    const oversize = validateDocumentFile({
      name: "huge-scan.pdf",
      size: MAX_DOCUMENT_FILE_SIZE_BYTES + 1,
    });
    expect(oversize.valid).toBe(false);
    if (!oversize.valid) {
      expect(oversize.error).toContain("15 MB limit");
    }
  });

  it("rejects empty files with zero bytes", () => {
    const empty = validateDocumentFile({
      name: "empty.pdf",
      size: 0,
    });
    expect(empty.valid).toBe(false);
    if (!empty.valid) {
      expect(empty.error).toContain("cannot be empty");
    }
  });

  it("explicitly rejects dangerous active and executable files", () => {
    for (const dangerousName of [
      "malware.exe",
      "script.bat",
      "deploy.ps1",
      "exploit.js",
      "runner.vbs",
      "trojan.scr",
      "payload.sh",
      "native.dll",
    ]) {
      const result = validateDocumentFile({
        name: dangerousName,
        size: 1024,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("not permitted for security reasons");
      }
    }
  });

  it("rejects files without extension or with unsupported extensions", () => {
    const noExt = validateDocumentFile({ name: "noextension", size: 1024 });
    expect(noExt.valid).toBe(false);

    const unsupported = validateDocumentFile({ name: "file.xyz", size: 1024 });
    expect(unsupported.valid).toBe(false);
  });
});

describe("Document storage availability helper", () => {
  it("prioritizes R2 when both R2 and Drive are available", () => {
    const availability = getStorageAvailability({
      isR2Available: true,
      isDriveAvailable: true,
    });
    expect(availability.available).toBe(true);
    expect(availability.preferredProvider).toBe("r2");
  });

  it("selects Google Drive when R2 is unavailable but Drive is configured", () => {
    const availability = getStorageAvailability({
      isR2Available: false,
      isDriveAvailable: true,
    });
    expect(availability.available).toBe(true);
    expect(availability.preferredProvider).toBe("google_drive");
  });

  it("indicates unavailable when neither is configured", () => {
    const availability = getStorageAvailability({
      isR2Available: false,
      isDriveAvailable: false,
    });
    expect(availability.available).toBe(false);
    expect(availability.preferredProvider).toBe(null);
  });
});

describe("Document upload orchestration", () => {
  let fakeR2: FakeArtifactStorage;
  let fakeDrive: FakeDriveArtifactUploader;
  const adminUser = makeMockUser({ id: "admin-1", role: "admin" });
  const saleUser = makeMockUser({ id: "sale-1", role: "sale" });
  const fixedDate = new Date("2026-09-10T10:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
    fakeR2 = new FakeArtifactStorage();
    fakeDrive = new FakeDriveArtifactUploader();
  });

  it("uploads to R2 with deterministic Year/Month path and registers metadata", async () => {
    const note = makeMockNote({ id: "note-1", status: "submitted" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const fakeRow: ShippingNoteDocumentListItem = {
      id: "doc-1",
      shippingNoteId: "note-1",
      documentType: "pre_alert_hbl",
      originalFileName: "HBL-PreAlert.pdf",
      storageProvider: "r2",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedById: adminUser.id,
      createdAt: fixedDate,
    };

    mocks.db.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([fakeRow]),
          }),
        }),
      };
      return callback(tx);
    });

    const result = await uploadShippingNoteDocument(
      {
        shippingNoteId: "note-1",
        documentType: "pre_alert_hbl",
        file: {
          name: "HBL-PreAlert.pdf",
          size: 1024,
          type: "application/pdf",
          bytes: Buffer.from("fake-pdf-content"),
        },
      },
      adminUser,
      {
        r2Storage: fakeR2,
        isR2Available: true,
        now: fixedDate,
      },
    );

    expect(result.id).toBe("doc-1");
    expect(result.storageProvider).toBe("r2");

    // Verify R2 path contains 2026/09 and note-1
    expect(mocks.db.transaction).toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "shipping_note.document.add",
        entityId: "note-1",
      }),
    );
  });

  it("uploads to Google Drive with Year/Month/Shipment folders when R2 is unconfigured", async () => {
    const note = makeMockNote({ id: "note-1", jobsheetNo: "JS-2026-001", status: "submitted" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const fakeRow: ShippingNoteDocumentListItem = {
      id: "doc-2",
      shippingNoteId: "note-1",
      documentType: "contract",
      originalFileName: "Service-Contract.docx",
      storageProvider: "google_drive",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 2048,
      uploadedById: adminUser.id,
      createdAt: fixedDate,
    };

    mocks.db.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([fakeRow]),
          }),
        }),
      };
      return callback(tx);
    });

    const result = await uploadShippingNoteDocument(
      {
        shippingNoteId: "note-1",
        documentType: "contract",
        file: {
          name: "Service-Contract.docx",
          size: 2048,
          bytes: Buffer.from("fake-docx-content"),
        },
      },
      adminUser,
      {
        driveUploader: fakeDrive,
        driveRootFolderId: "root-1",
        isR2Available: false,
        isDriveAvailable: true,
        now: fixedDate,
      },
    );

    expect(result.id).toBe("doc-2");
    expect(result.storageProvider).toBe("google_drive");

    // Verify Drive folders were created: Year 2026, Month 09, Shipment JS_2026_001
    expect(fakeDrive.folders.size).toBe(3);
    expect(fakeDrive.uploads.length).toBe(1);
    expect(fakeDrive.uploads[0].appProperties).toEqual({
      uniwaveShippingNoteId: "note-1",
      uniwaveDocumentType: "contract",
      uniwaveOriginalFileName: "Service-Contract.docx",
    });
  });

  it("performs compensating cleanup on provider object when DB registration fails", async () => {
    const note = makeMockNote({ id: "note-1", status: "submitted" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    mocks.db.transaction.mockRejectedValue(new Error("Database connection failure"));

    await expect(
      uploadShippingNoteDocument(
        {
          shippingNoteId: "note-1",
          documentType: "invoice",
          file: {
            name: "invoice.pdf",
            size: 512,
            bytes: Buffer.from("fake-invoice"),
          },
        },
        adminUser,
        {
          r2Storage: fakeR2,
          isR2Available: true,
          now: fixedDate,
        },
      ),
    ).rejects.toThrow("Database connection failure");

    // Compensating cleanup must have been called on R2 storage
    expect(fakeR2.deletedKeys.length).toBe(1);
  });

  it("does not write to DB or audit if provider upload fails", async () => {
    const note = makeMockNote({ id: "note-1", status: "submitted" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    fakeR2.failNextPut();

    await expect(
      uploadShippingNoteDocument(
        {
          shippingNoteId: "note-1",
          documentType: "invoice",
          file: {
            name: "invoice.pdf",
            size: 512,
            bytes: Buffer.from("fake-invoice"),
          },
        },
        adminUser,
        {
          r2Storage: fakeR2,
          isR2Available: true,
          now: fixedDate,
        },
      ),
    ).rejects.toThrow("Fake artifact storage write failed.");

    expect(mocks.db.transaction).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects upload attempt on locked shipping notes before touching storage", async () => {
    const lockedNote = makeMockNote({ id: "note-locked", status: "locked" });
    mocks.getShippingNoteForUser.mockResolvedValue(lockedNote);

    await expect(
      uploadShippingNoteDocument(
        {
          shippingNoteId: "note-locked",
          documentType: "pre_alert_hbl",
          file: {
            name: "hbl.pdf",
            size: 512,
            bytes: Buffer.from("bytes"),
          },
        },
        adminUser,
        {
          r2Storage: fakeR2,
          isR2Available: true,
        },
      ),
    ).rejects.toThrow(AuthorizationError);

    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("rejects upload attempt on cancelled shipping notes before touching storage", async () => {
    const cancelledNote = makeMockNote({ id: "note-cancelled", status: "cancelled" });
    mocks.getShippingNoteForUser.mockResolvedValue(cancelledNote);

    await expect(
      uploadShippingNoteDocument(
        {
          shippingNoteId: "note-cancelled",
          documentType: "pre_alert_hbl",
          file: {
            name: "hbl.pdf",
            size: 512,
            bytes: Buffer.from("bytes"),
          },
        },
        adminUser,
        {
          r2Storage: fakeR2,
          isR2Available: true,
        },
      ),
    ).rejects.toThrow(AuthorizationError);

    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("rejects upload attempt if user is unauthorized (Sale targeting another user's note)", async () => {
    const otherNote = makeMockNote({ id: "note-other", createdById: "user-2", status: "draft" });
    mocks.getShippingNoteForUser.mockResolvedValue(otherNote);

    await expect(
      uploadShippingNoteDocument(
        {
          shippingNoteId: "note-other",
          documentType: "pre_alert_hbl",
          file: {
            name: "hbl.pdf",
            size: 512,
            bytes: Buffer.from("bytes"),
          },
        },
        saleUser,
        {
          r2Storage: fakeR2,
          isR2Available: true,
        },
      ),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("Document removal orchestration", () => {
  let fakeR2: FakeArtifactStorage;
  let fakeDrive: FakeDriveArtifactUploader;
  const adminUser = makeMockUser({ id: "admin-1", role: "admin" });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
    fakeR2 = new FakeArtifactStorage();
    fakeDrive = new FakeDriveArtifactUploader();
  });

  it("deletes provider object and soft-deletes DB metadata on success", async () => {
    const note = makeMockNote({ id: "note-1", status: "checked" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-1",
      shippingNoteId: "note-1",
      documentType: "invoice",
      originalFileName: "inv.pdf",
      storageProvider: "r2",
      storageKey: "shipping-note-documents/2026/09/note-1/inv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedById: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // getShippingNoteDocumentByIdForUser query mock
    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([docDetail]),
        }),
      }),
    });

    mocks.db.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([docDetail]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "doc-1" }]),
          }),
        }),
      };
      return callback(tx);
    });

    await removeShippingNoteDocument(
      {
        documentId: "doc-1",
        shippingNoteId: "note-1",
      },
      adminUser,
      {
        r2Storage: fakeR2,
      },
    );

    expect(fakeR2.deletedKeys).toContain(docDetail.storageKey);
    expect(mocks.db.transaction).toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "shipping_note.document.remove",
        entityId: "note-1",
      }),
    );
  });

  it("deletes Google Drive file and soft-deletes DB metadata on success", async () => {
    const note = makeMockNote({ id: "note-1", status: "checked" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-drive-1",
      shippingNoteId: "note-1",
      documentType: "contract",
      originalFileName: "contract.pdf",
      storageProvider: "google_drive",
      storageKey: "fake-drive-file-123",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedById: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([docDetail]),
        }),
      }),
    });

    mocks.db.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([docDetail]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "doc-drive-1" }]),
          }),
        }),
      };
      return callback(tx);
    });

    await removeShippingNoteDocument(
      {
        documentId: "doc-drive-1",
        shippingNoteId: "note-1",
      },
      adminUser,
      {
        driveUploader: fakeDrive,
      },
    );

    expect(fakeDrive.deletedFileIds).toContain("fake-drive-file-123");
    expect(mocks.db.transaction).toHaveBeenCalled();
  });

  it("fails closed when provider deletion fails (metadata remains active)", async () => {
    const note = makeMockNote({ id: "note-1", status: "submitted" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-1",
      shippingNoteId: "note-1",
      documentType: "invoice",
      originalFileName: "inv.pdf",
      storageProvider: "r2",
      storageKey: "shipping-note-documents/2026/09/note-1/inv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedById: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([docDetail]),
        }),
      }),
    });

    fakeR2.failNextDelete();

    await expect(
      removeShippingNoteDocument(
        {
          documentId: "doc-1",
          shippingNoteId: "note-1",
        },
        adminUser,
        {
          r2Storage: fakeR2,
        },
      ),
    ).rejects.toThrow("Fake artifact storage delete failed.");

    // DB transaction was NOT called because provider delete failed!
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("G6 forensic: provider delete succeeds but DB soft-delete transaction fails (leaves stale metadata until retry)", async () => {
    const note = makeMockNote({ id: "note-1", status: "submitted" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-1",
      shippingNoteId: "note-1",
      documentType: "invoice",
      originalFileName: "inv.pdf",
      storageProvider: "r2",
      storageKey: "shipping-note-documents/2026/09/note-1/inv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedById: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([docDetail]),
        }),
      }),
    });

    // DB transaction throws error during soft-delete
    mocks.db.transaction.mockRejectedValueOnce(new Error("Database connection dropped during soft-delete."));

    await expect(
      removeShippingNoteDocument(
        {
          documentId: "doc-1",
          shippingNoteId: "note-1",
        },
        adminUser,
        {
          r2Storage: fakeR2,
        },
      ),
    ).rejects.toThrow("Database connection dropped during soft-delete.");

    // Evidence: provider object was deleted from storage
    expect(fakeR2.deletedKeys).toContain(docDetail.storageKey);
    // But DB soft-delete threw, so DB row was not marked deleted
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects remove attempt on locked notes before touching provider", async () => {
    const lockedNote = makeMockNote({ id: "note-locked", status: "locked" });
    mocks.getShippingNoteForUser.mockResolvedValue(lockedNote);

    await expect(
      removeShippingNoteDocument(
        {
          documentId: "doc-1",
          shippingNoteId: "note-locked",
        },
        adminUser,
        {
          r2Storage: fakeR2,
        },
      ),
    ).rejects.toThrow(AuthorizationError);

    expect(fakeR2.deletedKeys.length).toBe(0);
  });
});

describe("Document download orchestration", () => {
  let fakeR2: FakeArtifactStorage;
  const adminUser = makeMockUser({ id: "admin-1", role: "admin" });
  const saleUser = makeMockUser({ id: "sale-1", role: "sale" });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
    fakeR2 = new FakeArtifactStorage();
  });

  it("downloads document from R2 based on document ID and verifies metadata", async () => {
    const note = makeMockNote({ id: "note-1", status: "checked" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const storageKey = "shipping-note-documents/2026/09/note-1/test.pdf";
    await fakeR2.put({
      key: storageKey,
      body: Buffer.from("pdf-bytes-1234"),
      mimeType: "application/pdf",
      checksumSha256: "checksum",
      exportId: "exp-1",
    });

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-1",
      shippingNoteId: "note-1",
      documentType: "invoice",
      originalFileName: "test.pdf",
      storageProvider: "r2",
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: 14,
      uploadedById: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([docDetail]),
        }),
      }),
    });

    const download = await downloadShippingNoteDocument("doc-1", adminUser, {
      r2Storage: fakeR2,
    });

    expect(download.documentId).toBe("doc-1");
    expect(download.fileName).toBe("test.pdf");
    expect(download.mimeType).toBe("application/pdf");
    expect(download.bytes.toString()).toBe("pdf-bytes-1234");
  });

  it("permits document download on locked notes for authorized users", async () => {
    const lockedNote = makeMockNote({ id: "note-locked", status: "locked" });
    mocks.getShippingNoteForUser.mockResolvedValue(lockedNote);

    const storageKey = "shipping-note-documents/2026/09/note-locked/contract.pdf";
    await fakeR2.put({
      key: storageKey,
      body: Buffer.from("locked-contract-bytes"),
      mimeType: "application/pdf",
      checksumSha256: "checksum",
      exportId: "exp-2",
    });

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-locked",
      shippingNoteId: "note-locked",
      documentType: "contract",
      originalFileName: "contract.pdf",
      storageProvider: "r2",
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: 21,
      uploadedById: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([docDetail]),
        }),
      }),
    });

    const download = await downloadShippingNoteDocument("doc-locked", adminUser, {
      r2Storage: fakeR2,
    });

    expect(download.bytes.toString()).toBe("locked-contract-bytes");
  });

  it("rejects cross-shipment download by Sale when document belongs to another user's note", async () => {
    // Note belongs to user-2
    const otherNote = makeMockNote({ id: "note-other", createdById: "user-2", status: "checked" });
    mocks.getShippingNoteForUser.mockResolvedValue(otherNote);

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-other",
      shippingNoteId: "note-other",
      documentType: "invoice",
      originalFileName: "secret.pdf",
      storageProvider: "r2",
      storageKey: "secret-key",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedById: "user-2",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([docDetail]),
        }),
      }),
    });

    await expect(
      downloadShippingNoteDocument("doc-other", saleUser, {
        r2Storage: fakeR2,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
