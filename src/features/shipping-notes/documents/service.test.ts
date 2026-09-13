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
import { buildDocumentR2Key } from "./storage-paths";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
    commodityHsCode: null,
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
  it("accepts valid PDF, JPG, JPEG, PNG, and WEBP files within 15 MB", () => {
    // PDF accepted
    const validPdf = validateDocumentFile({
      name: "contract.pdf",
      size: 1024 * 1024,
      type: "application/pdf",
      bytes: Buffer.from("%PDF-1.4 mock pdf"),
    });
    expect(validPdf.valid).toBe(true);

    // JPG accepted
    const validJpg = validateDocumentFile({
      name: "bol_scan.jpg",
      size: 500 * 1024,
      type: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    });
    expect(validJpg.valid).toBe(true);

    // JPEG accepted
    const validJpeg = validateDocumentFile({
      name: "customs.jpeg",
      size: 200 * 1024,
      type: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
    });
    expect(validJpeg.valid).toBe(true);

    // PNG accepted
    const validPng = validateDocumentFile({
      name: "bol_scan.png",
      size: 800 * 1024,
      type: "image/png",
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    expect(validPng.valid).toBe(true);

    // WEBP accepted
    const validWebp = validateDocumentFile({
      name: "receipt.webp",
      size: 400 * 1024,
      type: "image/webp",
      bytes: Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]),
    });
    expect(validWebp.valid).toBe(true);
  });

  it("rejects extension/MIME mismatch", () => {
    const mismatch = validateDocumentFile({
      name: "doc.pdf",
      size: 1024,
      type: "image/png",
      bytes: Buffer.from("%PDF-1.4 test"),
    });
    expect(mismatch.valid).toBe(false);
    if (!mismatch.valid) {
      expect(mismatch.error).toContain("does not match provided MIME type");
    }
  });

  it("rejects fake .pdf when signature is wrong", () => {
    const fakePdf = validateDocumentFile({
      name: "fake.pdf",
      size: 1024,
      type: "application/pdf",
      bytes: Buffer.from("NOT_A_PDF_CONTENT"),
    });
    expect(fakePdf.valid).toBe(false);
    if (!fakePdf.valid) {
      expect(fakePdf.error).toContain("does not match the expected signature");
    }
  });

  it("rejects fake .jpg when signature is wrong", () => {
    const fakeJpg = validateDocumentFile({
      name: "fake.jpg",
      size: 1024,
      type: "image/jpeg",
      bytes: Buffer.from("NOT_A_JPEG_FILE"),
    });
    expect(fakeJpg.valid).toBe(false);
    if (!fakeJpg.valid) {
      expect(fakeJpg.error).toContain("does not match the expected signature");
    }
  });

  it("rejects SVG uploads", () => {
    const svg = validateDocumentFile({
      name: "vector.svg",
      size: 1024,
      type: "image/svg+xml",
    });
    expect(svg.valid).toBe(false);
  });

  it("rejects XLSX uploads", () => {
    const xlsx = validateDocumentFile({
      name: "sheet.xlsx",
      size: 1024,
    });
    expect(xlsx.valid).toBe(false);
  });

  it("rejects ZIP uploads", () => {
    const zip = validateDocumentFile({
      name: "archive.zip",
      size: 1024,
    });
    expect(zip.valid).toBe(false);
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

    const emptyBytes = validateDocumentFile({
      name: "empty2.pdf",
      size: 10,
      bytes: Buffer.alloc(0),
    });
    expect(emptyBytes.valid).toBe(false);
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

  it("generates storage key that does not contain raw filename", () => {
    const key = buildDocumentR2Key({
      shippingNoteId: "note-123",
      originalFileName: "Confidential_Contract_v2.pdf",
      documentId: "doc-456",
      uniqueId: "uuid-789",
    });
    expect(key).toBe("shipping-notes/note-123/documents/doc-456/uuid-789.pdf");
    expect(key).not.toContain("Confidential_Contract_v2");
  });

  it("prevents path traversal filenames from affecting the storage key", () => {
    const key = buildDocumentR2Key({
      shippingNoteId: "note-123",
      originalFileName: "../../../etc/passwd.pdf",
      documentId: "doc-456",
      uniqueId: "uuid-789",
    });
    expect(key).toBe("shipping-notes/note-123/documents/doc-456/uuid-789.pdf");
    expect(key).not.toContain("..");
  });
});

describe("Document storage availability helper", () => {
  it("uses R2 when configured", () => {
    const availability = getStorageAvailability({
      isR2Available: true,
    });
    expect(availability.available).toBe(true);
    expect(availability.preferredProvider).toBe("r2");
  });

  it("does not fall back to Google Drive when R2 is unavailable", () => {
    const availability = getStorageAvailability({
      isR2Available: false,
    });
    expect(availability.available).toBe(false);
    expect(availability.preferredProvider).toBe(null);
  });

  it("indicates unavailable when neither is configured", () => {
    const availability = getStorageAvailability({
      isR2Available: false,
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
          bytes: Buffer.from("%PDF-1.4 mock pdf content"),
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

  it("does not upload to Google Drive when R2 is unconfigured", async () => {
    const note = makeMockNote({ id: "note-1", jobsheetNo: "JS-2026-001", status: "submitted" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);
    await expect(uploadShippingNoteDocument(
      {
        shippingNoteId: "note-1",
        documentType: "contract",
        file: {
          name: "Service-Contract.pdf",
          size: 2048,
          type: "application/pdf",
          bytes: Buffer.from("%PDF-1.4 mock pdf content"),
        },
      },
      adminUser,
      {
        driveUploader: fakeDrive,
        isR2Available: false,
      },
    )).rejects.toThrow("Document storage is not configured");
    expect(fakeDrive.uploads).toHaveLength(0);
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
            type: "application/pdf",
            bytes: Buffer.from("%PDF-1.4 mock pdf invoice"),
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
            type: "application/pdf",
            bytes: Buffer.from("%PDF-1.4 mock pdf invoice"),
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
            type: "application/pdf",
            bytes: Buffer.from("%PDF-1.4 mock pdf"),
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
            type: "application/pdf",
            bytes: Buffer.from("%PDF-1.4 mock pdf"),
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
            type: "application/pdf",
            bytes: Buffer.from("%PDF-1.4 mock pdf"),
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

describe("Document hard-delete orchestration", () => {
  let fakeR2: FakeArtifactStorage;
  const adminUser = makeMockUser({ id: "admin-1", role: "admin" });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
    fakeR2 = new FakeArtifactStorage();
  });

  function configureHardDeleteTransaction(docDetail: ShippingNoteDocumentDetail) {
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([docDetail]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: docDetail.id }]),
        }),
      }),
    };
    mocks.db.transaction.mockImplementation(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
    return tx;
  }

  it("hard deletes R2 metadata first, then deletes its exact object key and audits the reason", async () => {
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

    const tx = configureHardDeleteTransaction(docDetail);

    await removeShippingNoteDocument(
      {
        documentId: "doc-1",
        shippingNoteId: "note-1",
        reason: "Superseded file",
      },
      adminUser,
      {
        r2Storage: fakeR2,
      },
    );

    expect(fakeR2.deletedKeys).toContain(docDetail.storageKey);
    expect(tx.delete).toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "shipping_note.document.hard_delete",
        entityId: "doc-1",
        reason: "Superseded file",
      }),
    );
  });

  it("rejects a whitespace-only delete reason before metadata deletion", async () => {
    mocks.getShippingNoteForUser.mockResolvedValue(
      makeMockNote({ id: "note-1", status: "submitted" }),
    );

    await expect(
      removeShippingNoteDocument(
        { documentId: "doc-1", shippingNoteId: "note-1", reason: "   " },
        adminUser,
        { r2Storage: fakeR2 },
      ),
    ).rejects.toThrow("Delete reason is required");

    expect(mocks.db.transaction).not.toHaveBeenCalled();
    expect(fakeR2.deletedKeys).toHaveLength(0);
  });

  it("uses the same hard-delete service for customs declaration metadata", async () => {
    const note = makeMockNote({ id: "note-1", status: "checked" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-customs-1",
      shippingNoteId: "note-1",
      documentType: "customs_declaration",
      originalFileName: "declaration.pdf",
      storageProvider: "r2",
      storageKey: "shipping-note-documents/note-1/declaration.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedById: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    configureHardDeleteTransaction(docDetail);

    await removeShippingNoteDocument(
      {
        documentId: "doc-customs-1",
        shippingNoteId: "note-1",
        reason: "Incorrect declaration",
      },
      adminUser,
      {
        r2Storage: fakeR2,
      },
    );

    expect(fakeR2.deletedKeys).toContain(docDetail.storageKey);
    expect(mocks.db.transaction).toHaveBeenCalled();
  });

  it("reports sanitized cleanup failure only after metadata deletion and writes a cleanup audit", async () => {
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

    configureHardDeleteTransaction(docDetail);

    fakeR2.failNextDelete();

    await expect(
      removeShippingNoteDocument(
        {
          documentId: "doc-1",
          shippingNoteId: "note-1",
          reason: "Superseded file",
        },
        adminUser,
        {
          r2Storage: fakeR2,
        },
      ),
    ).rejects.toThrow("Document metadata was deleted, but private artifact cleanup failed.");

    expect(mocks.db.transaction).toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "shipping_note.document.hard_delete.cleanup_failed",
        entityId: "doc-1",
      }),
    );
  });

  it("does not leak an audit-storage error when cleanup reporting also fails", async () => {
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
    configureHardDeleteTransaction(docDetail);
    fakeR2.failNextDelete();
    mocks.logAuditEvent
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("internal audit database error"));

    await expect(
      removeShippingNoteDocument(
        { documentId: "doc-1", shippingNoteId: "note-1", reason: "Superseded file" },
        adminUser,
        { r2Storage: fakeR2 },
      ),
    ).rejects.toThrow("Document metadata was deleted, but private artifact cleanup failed.");
  });

  it("does not delete the R2 object when the authoritative DB delete fails", async () => {
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

    mocks.db.transaction.mockRejectedValueOnce(new Error("Database connection dropped during hard delete."));

    await expect(
      removeShippingNoteDocument(
        {
          documentId: "doc-1",
          shippingNoteId: "note-1",
          reason: "Superseded file",
        },
        adminUser,
        {
          r2Storage: fakeR2,
        },
      ),
    ).rejects.toThrow("Database connection dropped during hard delete.");

    expect(fakeR2.deletedKeys).not.toContain(docDetail.storageKey);
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
          reason: "Superseded file",
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

  it("returns stable sanitized error when storage object is missing without leaking secrets", async () => {
    const note = makeMockNote({ id: "note-1", status: "checked" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-missing",
      shippingNoteId: "note-1",
      documentType: "invoice",
      originalFileName: "missing.pdf",
      storageProvider: "r2",
      storageKey: "shipping-notes/note-1/documents/doc-missing/file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
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

    await expect(
      downloadShippingNoteDocument("doc-missing", adminUser, {
        r2Storage: fakeR2,
      }),
    ).rejects.toThrow("Artifact object was not found.");
  });

  it("verifies download result includes shippingNoteId for caller route verification", async () => {
    const note = makeMockNote({ id: "note-abc", status: "draft" });
    mocks.getShippingNoteForUser.mockResolvedValue(note);

    const storageKey = "shipping-notes/note-abc/documents/doc-abc/contract.pdf";
    await fakeR2.put({
      key: storageKey,
      body: Buffer.from("%PDF-1.4 contract data"),
      mimeType: "application/pdf",
      checksumSha256: "checksum",
      exportId: "exp-abc",
    });

    const docDetail: ShippingNoteDocumentDetail = {
      id: "doc-abc",
      shippingNoteId: "note-abc",
      documentType: "contract",
      originalFileName: "contract.pdf",
      storageProvider: "r2",
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: 25,
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

    const result = await downloadShippingNoteDocument("doc-abc", adminUser, {
      r2Storage: fakeR2,
    });

    expect(result.shippingNoteId).toBe("note-abc");
    expect(result.fileName).toBe("contract.pdf");
    expect(result.mimeType).toBe("application/pdf");
  });
});
