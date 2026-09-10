vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User as DbUser } from "@/lib/db/schema";
import {
  SHIPPING_NOTE_DOCUMENT_TYPES,
  SHIPPING_NOTE_DOCUMENT_TYPE_LABELS,
} from "./constants";
import {
  canMutateShippingNoteDocuments,
  canReadShippingNoteDocuments,
} from "./policy";
import { searchShippingNoteDocumentsForUser } from "./queries";
import type { DocumentLibraryItem } from "./types";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
  },
  rejectInactiveOrSoftDeletedUsers: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: mocks.db,
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

describe("Document Library and Pre-alert UI options", () => {
  it("exposes exactly the four accepted document categories without speculative additions", () => {
    expect(SHIPPING_NOTE_DOCUMENT_TYPES).toEqual([
      "pre_alert_hbl",
      "pre_alert_mbl",
      "contract",
      "invoice",
    ]);

    expect(SHIPPING_NOTE_DOCUMENT_TYPE_LABELS).toEqual({
      pre_alert_hbl: "Pre-alert HBL",
      pre_alert_mbl: "Pre-alert MBL",
      contract: "Contract",
      invoice: "Invoice",
    });
  });

  it("enforces locked and cancelled immutability rules", () => {
    const admin = makeMockUser({ role: "admin" });
    const sale = makeMockUser({ role: "sale", id: "sale-1" });

    // Locked notes are read-only for admin and owning sale, but never mutable
    expect(
      canReadShippingNoteDocuments(
        { status: "locked", createdById: "sale-1" },
        sale,
      ),
    ).toBe(true);
    expect(
      canMutateShippingNoteDocuments(
        { status: "locked", createdById: "sale-1" },
        sale,
      ),
    ).toBe(false);
    expect(
      canMutateShippingNoteDocuments(
        { status: "locked", createdById: "sale-1" },
        admin,
      ),
    ).toBe(false);

    // Cancelled notes are read-only for admin and owning sale, but never mutable
    expect(
      canMutateShippingNoteDocuments(
        { status: "cancelled", createdById: "sale-1" },
        admin,
      ),
    ).toBe(false);
    expect(
      canMutateShippingNoteDocuments(
        { status: "cancelled", createdById: "sale-1" },
        sale,
      ),
    ).toBe(false);

    // Draft / Submitted / Checked are mutable
    expect(
      canMutateShippingNoteDocuments(
        { status: "draft", createdById: "sale-1" },
        sale,
      ),
    ).toBe(true);
    expect(
      canMutateShippingNoteDocuments(
        { status: "checked", createdById: "sale-1" },
        admin,
      ),
    ).toBe(true);
  });
});

describe("searchShippingNoteDocumentsForUser query", () => {
  const adminUser = makeMockUser({ id: "admin-1", role: "admin" });
  const accountantUser = makeMockUser({ id: "acct-1", role: "accountant" });
  const saleUser = makeMockUser({ id: "sale-1", role: "sale" });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
  });

  it("queries documents for Admin with no user restriction", async () => {
    const fakeRows: DocumentLibraryItem[] = [
      {
        id: "doc-1",
        shippingNoteId: "note-1",
        documentType: "pre_alert_hbl",
        originalFileName: "hbl.pdf",
        storageProvider: "r2",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        uploadedById: "admin-1",
        createdAt: new Date(),
        jobsheetNo: "JS-2026-001",
        noteStatus: "submitted",
      },
    ];

    const mockChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(fakeRows),
    };
    mocks.db.select.mockReturnValue(mockChain);

    const result = await searchShippingNoteDocumentsForUser({}, adminUser);

    expect(result).toHaveLength(1);
    expect(result[0].jobsheetNo).toBe("JS-2026-001");
    expect(mockChain.limit).toHaveBeenCalledWith(50);
  });

  it("queries documents for Accountant with no user restriction", async () => {
    const fakeRows: DocumentLibraryItem[] = [
      {
        id: "doc-2",
        shippingNoteId: "note-2",
        documentType: "invoice",
        originalFileName: "inv.xlsx",
        storageProvider: "r2",
        mimeType: "application/vnd.ms-excel",
        sizeBytes: 2048,
        uploadedById: "user-2",
        createdAt: new Date(),
        jobsheetNo: "JS-2026-002",
        noteStatus: "checked",
      },
    ];

    const mockChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(fakeRows),
    };
    mocks.db.select.mockReturnValue(mockChain);

    const result = await searchShippingNoteDocumentsForUser({}, accountantUser);

    expect(result).toHaveLength(1);
    expect(result[0].jobsheetNo).toBe("JS-2026-002");
  });

  it("restricts search to own shipping notes when user is Sale", async () => {
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mocks.db.select.mockReturnValue(mockChain);

    await searchShippingNoteDocumentsForUser(
      { jobsheet: "JS-2026-999" },
      saleUser,
    );

    // Verify where condition was invoked with conditions
    expect(mockChain.where).toHaveBeenCalled();
  });

  it("applies documentType filter when provided", async () => {
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mocks.db.select.mockReturnValue(mockChain);

    await searchShippingNoteDocumentsForUser(
      { documentType: "contract" },
      adminUser,
    );

    expect(mockChain.where).toHaveBeenCalled();
  });
});
