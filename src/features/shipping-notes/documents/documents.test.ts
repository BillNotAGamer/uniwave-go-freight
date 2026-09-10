vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SHIPPING_NOTE_DOCUMENT_STORAGE_PROVIDERS,
  SHIPPING_NOTE_DOCUMENT_TYPES,
  SHIPPING_NOTE_DOCUMENT_TYPE_LABELS,
  type ShippingNoteDocumentStorageProvider,
  type ShippingNoteDocumentType,
} from "./constants";
import {
  canMutateShippingNoteDocuments,
  canReadShippingNoteDocuments,
  isShippingNoteDocumentMutableStatus,
} from "./policy";
import { registerShippingNoteDocumentInputSchema } from "./validators";
import {
  getShippingNoteDocumentByIdForUser,
  listShippingNoteDocumentsForUser,
} from "./queries";
import {
  registerShippingNoteDocumentMetadata,
  softDeleteShippingNoteDocument,
} from "./mutations";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import type { ShippingNoteDetail } from "../types";
import type { ShippingNoteStatus } from "../constants";
import type { User as DbUser } from "@/lib/db/schema";

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
    jobsheetNo: "JS-001",
    status: "submitted",
    shippingMode: "sea_export",
    shipperText: "Shipper",
    consigneeText: "Consignee",
    customerText: "Customer",
    agentText: null,
    shipperPartnerId: null,
    consigneePartnerId: null,
    customerPartnerId: null,
    agentPartnerId: null,
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
    mawbHawbNo: null,
    mblNo: null,
    hblNo: null,
    flightNo: null,
    vesselName: null,
    voyageNo: null,
    etd: new Date(),
    eta: null,
    volumeValue: "100",
    volumeUnit: "kgs",
    exchangeRate: "25000",
    createdById: "sale-1",
    submittedAt: new Date(),
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe("Shipping Note Documents Domain — Phase C10A", () => {
  const activeAdmin = makeMockUser({ id: "admin-1", role: "admin" });
  const activeAccountant = makeMockUser({ id: "acc-1", role: "accountant" });
  const activeSale = makeMockUser({ id: "sale-1", role: "sale" });
  const otherSale = makeMockUser({ id: "sale-2", role: "sale" });

  const mutableNote = makeMockNote({
    id: "note-1",
    status: "submitted",
    createdById: "sale-1",
  });

  const lockedNote = makeMockNote({
    id: "note-locked",
    status: "locked",
    createdById: "sale-1",
  });

  const cancelledNote = makeMockNote({
    id: "note-cancelled",
    status: "cancelled",
    createdById: "sale-1",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
  });

  describe("1. Document Types and Constants", () => {
    it("defines exact supported document categories", () => {
      expect(SHIPPING_NOTE_DOCUMENT_TYPES).toEqual([
        "pre_alert_hbl",
        "pre_alert_mbl",
        "contract",
        "invoice",
      ]);
    });

    it("maps categories to human-facing labels", () => {
      expect(SHIPPING_NOTE_DOCUMENT_TYPE_LABELS.pre_alert_hbl).toBe("Pre-alert HBL");
      expect(SHIPPING_NOTE_DOCUMENT_TYPE_LABELS.pre_alert_mbl).toBe("Pre-alert MBL");
      expect(SHIPPING_NOTE_DOCUMENT_TYPE_LABELS.contract).toBe("Contract");
      expect(SHIPPING_NOTE_DOCUMENT_TYPE_LABELS.invoice).toBe("Invoice");
    });

    it("defines supported storage providers", () => {
      expect(SHIPPING_NOTE_DOCUMENT_STORAGE_PROVIDERS).toEqual(["r2", "google_drive"]);
    });
  });

  describe("2. Validation and Normalization", () => {
    it("accepts valid registration input", () => {
      const valid = registerShippingNoteDocumentInputSchema.parse({
        shippingNoteId: "note-1",
        documentType: "pre_alert_hbl",
        originalFileName: "HBL-12345.pdf",
        storageProvider: "r2",
        storageKey: "documents/2026/09/note-1/hbl-12345.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1048576,
      });
      expect(valid.documentType).toBe("pre_alert_hbl");
      expect(valid.sizeBytes).toBe(1048576);
    });

    it("fails closed on unsupported document type", () => {
      const parsed = registerShippingNoteDocumentInputSchema.safeParse({
        shippingNoteId: "note-1",
        documentType: "packing_list",
        originalFileName: "pack.pdf",
        storageProvider: "r2",
        storageKey: "doc/1",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });
      expect(parsed.success).toBe(false);
      expect(() =>
        registerShippingNoteDocumentInputSchema.parse({
          shippingNoteId: "note-1",
          documentType: "packing_list" as unknown as ShippingNoteDocumentType,
          originalFileName: "pack.pdf",
          storageProvider: "r2",
          storageKey: "doc/1",
          mimeType: "application/pdf",
          sizeBytes: 100,
        }),
      ).toThrow();
    });

    it("fails closed on unsupported storage provider", () => {
      const parsed = registerShippingNoteDocumentInputSchema.safeParse({
        shippingNoteId: "note-1",
        documentType: "contract",
        originalFileName: "contract.pdf",
        storageProvider: "s3",
        storageKey: "doc/1",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });
      expect(parsed.success).toBe(false);
      expect(() =>
        registerShippingNoteDocumentInputSchema.parse({
          shippingNoteId: "note-1",
          documentType: "contract",
          originalFileName: "contract.pdf",
          storageProvider: "s3" as unknown as ShippingNoteDocumentStorageProvider,
          storageKey: "doc/1",
          mimeType: "application/pdf",
          sizeBytes: 100,
        }),
      ).toThrow();
    });

    it("rejects path traversal in storage key", () => {
      expect(() =>
        registerShippingNoteDocumentInputSchema.parse({
          shippingNoteId: "note-1",
          documentType: "invoice",
          originalFileName: "inv.pdf",
          storageProvider: "r2",
          storageKey: "documents/../secret.key",
          mimeType: "application/pdf",
          sizeBytes: 100,
        }),
      ).toThrow("Storage key cannot contain directory traversal");
    });

    it("rejects negative file size", () => {
      expect(() =>
        registerShippingNoteDocumentInputSchema.parse({
          shippingNoteId: "note-1",
          documentType: "invoice",
          originalFileName: "inv.pdf",
          storageProvider: "r2",
          storageKey: "doc/inv",
          mimeType: "application/pdf",
          sizeBytes: -5,
        }),
      ).toThrow("File size must be non-negative");
    });
  });

  describe("3. Status Immutability and Policy", () => {
    it("allows document mutation on active workflow statuses", () => {
      const mutableStatuses: ShippingNoteStatus[] = [
        "draft",
        "submitted",
        "accounting_reviewing",
        "checked",
        "approved",
      ];
      for (const status of mutableStatuses) {
        expect(isShippingNoteDocumentMutableStatus(status)).toBe(true);
      }
    });

    it("strictly rejects document mutation on locked and cancelled notes", () => {
      expect(isShippingNoteDocumentMutableStatus("locked")).toBe(false);
      expect(isShippingNoteDocumentMutableStatus("cancelled")).toBe(false);
      expect(isShippingNoteDocumentMutableStatus("exported")).toBe(false);
    });

    it("enforces RBAC for reading documents", () => {
      expect(canReadShippingNoteDocuments(mutableNote, activeAdmin)).toBe(true);
      expect(canReadShippingNoteDocuments(mutableNote, activeAccountant)).toBe(true);
      expect(canReadShippingNoteDocuments(mutableNote, activeSale)).toBe(true);
      expect(canReadShippingNoteDocuments(mutableNote, otherSale)).toBe(false);
    });

    it("enforces RBAC for mutating documents on mutable notes", () => {
      expect(canMutateShippingNoteDocuments(mutableNote, activeAdmin)).toBe(true);
      expect(canMutateShippingNoteDocuments(mutableNote, activeAccountant)).toBe(true);
      expect(canMutateShippingNoteDocuments(mutableNote, activeSale)).toBe(true);
      expect(canMutateShippingNoteDocuments(mutableNote, otherSale)).toBe(false);
    });

    it("denies all roles from mutating documents on locked and cancelled notes", () => {
      for (const actor of [activeAdmin, activeAccountant, activeSale]) {
        expect(canMutateShippingNoteDocuments(lockedNote, actor)).toBe(false);
        expect(canMutateShippingNoteDocuments(cancelledNote, actor)).toBe(false);
      }
    });
  });

  describe("4. Document Queries", () => {
    it("lists active documents for authorized user", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      const fakeDocs = [
        {
          id: "doc-1",
          shippingNoteId: "note-1",
          documentType: "pre_alert_hbl" as const,
          originalFileName: "hbl.pdf",
          storageProvider: "r2" as const,
          mimeType: "application/pdf",
          sizeBytes: 1024,
          uploadedById: "sale-1",
          createdAt: new Date("2026-09-01"),
        },
      ];

      mocks.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(fakeDocs),
          }),
        }),
      });

      const result = await listShippingNoteDocumentsForUser("note-1", activeSale);
      expect(result).toHaveLength(1);
      expect(result[0]?.documentType).toBe("pre_alert_hbl");
    });

    it("returns empty list if user cannot access shipping note", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(null);

      const result = await listShippingNoteDocumentsForUser("note-1", otherSale);
      expect(result).toEqual([]);
    });

    it("allows reading documents of a locked shipping note", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(lockedNote);

      mocks.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "doc-historical",
                shippingNoteId: "note-locked",
                documentType: "invoice" as const,
                originalFileName: "inv.pdf",
                storageProvider: "google_drive" as const,
                mimeType: "application/pdf",
                sizeBytes: 2048,
                uploadedById: "acc-1",
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const result = await listShippingNoteDocumentsForUser(
        "note-locked",
        activeAccountant,
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("doc-historical");
    });

    it("fetches single document detail by ID for authorized caller", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      const fakeDetail = {
        id: "doc-detail-1",
        shippingNoteId: "note-1",
        documentType: "contract" as const,
        originalFileName: "contract.pdf",
        storageProvider: "r2" as const,
        storageKey: "documents/2026/09/contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4096,
        uploadedById: "sale-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([fakeDetail]),
          }),
        }),
      });

      const result = await getShippingNoteDocumentByIdForUser(
        "doc-detail-1",
        activeSale,
      );
      expect(result).not.toBeNull();
      expect(result?.storageKey).toBe("documents/2026/09/contract.pdf");
    });
  });

  describe("5. Document Registration Mutation", () => {
    const validRegistrationInput = {
      shippingNoteId: "note-1",
      documentType: "invoice" as const,
      originalFileName: "Invoice-99.pdf",
      storageProvider: "r2" as const,
      storageKey: "documents/2026/09/inv-99.pdf",
      mimeType: "application/pdf",
      sizeBytes: 54321,
    };

    it("registers document metadata on mutable note and logs truthful audit", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      const createdDoc = {
        id: "doc-new",
        ...validRegistrationInput,
        uploadedById: activeAdmin.id,
        createdAt: new Date(),
      };

      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdDoc]),
          }),
        }),
      };

      mocks.db.transaction.mockImplementation(
        async <T>(cb: (tx: typeof txMock) => Promise<T>) => cb(txMock),
      );

      const result = await registerShippingNoteDocumentMetadata(
        validRegistrationInput,
        activeAdmin,
      );

      expect(result.id).toBe("doc-new");
      expect(mocks.logAuditEvent).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          action: "shipping_note.document.add",
          entityType: "shipping_note",
          entityId: "note-1",
          after: expect.objectContaining({
            documentId: "doc-new",
            documentType: "invoice",
            originalFileName: "Invoice-99.pdf",
          }),
        }),
      );
    });

    it("rejects registration on locked shipping note with 0 writes", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(lockedNote);

      await expect(
        registerShippingNoteDocumentMetadata(validRegistrationInput, activeAdmin),
      ).rejects.toBeInstanceOf(AuthorizationError);

      expect(mocks.db.transaction).not.toHaveBeenCalled();
      expect(mocks.logAuditEvent).not.toHaveBeenCalled();
    });

    it("rejects registration on cancelled shipping note with 0 writes", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(cancelledNote);

      await expect(
        registerShippingNoteDocumentMetadata(validRegistrationInput, activeAdmin),
      ).rejects.toBeInstanceOf(AuthorizationError);

      expect(mocks.db.transaction).not.toHaveBeenCalled();
      expect(mocks.logAuditEvent).not.toHaveBeenCalled();
    });

    it("rejects registration by unauthorized actor (other sale)", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      await expect(
        registerShippingNoteDocumentMetadata(validRegistrationInput, otherSale),
      ).rejects.toBeInstanceOf(AuthorizationError);

      expect(mocks.db.transaction).not.toHaveBeenCalled();
    });

    it("rejects active duplicate (storageProvider + storageKey)", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "existing-doc" }]),
            }),
          }),
        }),
      };

      mocks.db.transaction.mockImplementation(
        async <T>(cb: (tx: typeof txMock) => Promise<T>) => cb(txMock),
      );

      await expect(
        registerShippingNoteDocumentMetadata(validRegistrationInput, activeAdmin),
      ).rejects.toThrow("Storage object is already registered.");

      expect(mocks.logAuditEvent).not.toHaveBeenCalled();
    });

    it("permits multiple documents of the same category on one note", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      const doc1 = {
        id: "doc-inv-1",
        ...validRegistrationInput,
        storageKey: "documents/2026/09/inv-1.pdf",
        uploadedById: activeAdmin.id,
        createdAt: new Date(),
      };

      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([doc1]),
          }),
        }),
      };

      mocks.db.transaction.mockImplementation(
        async <T>(cb: (tx: typeof txMock) => Promise<T>) => cb(txMock),
      );

      const res = await registerShippingNoteDocumentMetadata(
        { ...validRegistrationInput, storageKey: "documents/2026/09/inv-1.pdf" },
        activeAdmin,
      );
      expect(res.documentType).toBe("invoice");
    });
  });

  describe("6. Document Soft Deletion Mutation", () => {
    const removeInput = {
      id: "doc-to-remove",
      shippingNoteId: "note-1",
    };

    it("soft deletes document and writes truthful audit", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "doc-to-remove",
                  documentType: "contract",
                  originalFileName: "contract.pdf",
                  storageProvider: "r2",
                },
              ]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      mocks.db.transaction.mockImplementation(
        async <T>(cb: (tx: typeof txMock) => Promise<T>) => cb(txMock),
      );

      await softDeleteShippingNoteDocument(removeInput, activeAdmin);

      expect(txMock.update).toHaveBeenCalled();
      expect(mocks.logAuditEvent).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          action: "shipping_note.document.remove",
          entityType: "shipping_note",
          entityId: "note-1",
          before: expect.objectContaining({
            documentId: "doc-to-remove",
            documentType: "contract",
          }),
        }),
      );
    });

    it("rejects soft delete on locked note with 0 writes", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(lockedNote);

      await expect(
        softDeleteShippingNoteDocument(
          { id: "doc-1", shippingNoteId: "note-locked" },
          activeAdmin,
        ),
      ).rejects.toBeInstanceOf(AuthorizationError);

      expect(mocks.db.transaction).not.toHaveBeenCalled();
    });

    it("rejects cross-note document removal (document does not belong to note)", async () => {
      mocks.getShippingNoteForUser.mockResolvedValue(mutableNote);

      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      mocks.db.transaction.mockImplementation(
        async <T>(cb: (tx: typeof txMock) => Promise<T>) => cb(txMock),
      );

      await expect(
        softDeleteShippingNoteDocument(removeInput, activeAdmin),
      ).rejects.toBeInstanceOf(AuthorizationError);
    });
  });
});
