import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
    AUTH_SECRET: "secret",
    AUTH_URL: "http://localhost:3000",
  },
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));

import type { User } from "@/lib/db/schema";
import type { ShippingNoteDetailWithCreator } from "@/features/shipping-notes/types";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getShippingNoteDetailForUser: vi.fn(),
  getSellingChargesAndSummaryForNoteForUser: vi.fn(),
  listBuyingChargesForNoteForUser: vi.fn(),
  listChargeTaxDetailsForNoteForUser: vi.fn(),
  listTaxRulesForUser: vi.fn(),
  listShippingNoteExportHistoryForUser: vi.fn(),
  listCustomsDeclarationsForNoteForUser: vi.fn(),
  getFinancialSummaryForNoteForUser: vi.fn(),
  getCancellationMetadataForNoteForUser: vi.fn(),
  listShippingNoteDocumentsForUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/features/shipping-notes/queries", () => ({
  getShippingNoteDetailForUser: mocks.getShippingNoteDetailForUser,
  getSellingChargesAndSummaryForNoteForUser: mocks.getSellingChargesAndSummaryForNoteForUser,
  listBuyingChargesForNoteForUser: mocks.listBuyingChargesForNoteForUser,
  getFinancialSummaryForNoteForUser: mocks.getFinancialSummaryForNoteForUser,
  getCancellationMetadataForNoteForUser: mocks.getCancellationMetadataForNoteForUser,
}));

vi.mock("@/features/shipping-notes/tax/queries", () => ({
  listChargeTaxDetailsForNoteForUser: mocks.listChargeTaxDetailsForNoteForUser,
}));

vi.mock("@/features/tax-rules/queries", () => ({
  listTaxRulesForUser: mocks.listTaxRulesForUser,
}));

vi.mock("@/features/shipping-notes/export/history", () => ({
  listShippingNoteExportHistoryForUser: mocks.listShippingNoteExportHistoryForUser,
}));

vi.mock("@/features/shipping-notes/customs-declarations/queries", () => ({
  listCustomsDeclarationsForNoteForUser: mocks.listCustomsDeclarationsForNoteForUser,
}));

vi.mock("@/features/shipping-notes/documents/queries", () => ({
  listShippingNoteDocumentsForUser: mocks.listShippingNoteDocumentsForUser,
}));

import ShippingNoteDetailPage from "./page";
import { CustomsDeclarationsPanel } from "@/features/shipping-notes/customs-declarations/components/customs-declarations-panel";

const now = new Date("2026-09-01T00:00:00.000Z");

function makeUser(role: User["role"]): User {
  return {
    id: `${role}-1`,
    email: `${role}@example.test`,
    name: role.toUpperCase(),
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function makeNote(
  status: ShippingNoteDetailWithCreator["status"] = "submitted",
): ShippingNoteDetailWithCreator {
  return {
    id: "note-1",
    jobsheetNo: "JS-001",
    shippingMode: "sea_export",
    shipperText: "Shipper A",
    consigneeText: "Consignee B",
    status,
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
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
    portOfLoading: "VNSGN",
    portOfDischarge: "USLAX",
    finalDestination: null,
    mawbNo: null,
    hawbNo: null,
    mblNo: "MBL-123",
    hblNo: "HBL-123",
    flightNo: null,
    vesselName: "Ocean Express",
    voyageNo: "VOY-123",
    etd: now,
    eta: now,
    volumeValue: "10.00",
    volumeUnit: "cbm",
    exchangeRate: "25000.00",
    createdById: "sale-1",
    createdBy: {
      name: "Sale Creator",
      email: "creator@example.test",
    },
  };
}

type TargetElement = React.ReactElement<{
  declarations?: unknown[];
  canManage?: boolean;
  children?: unknown;
}>;

function findComponentInTree(
  node: unknown,
  component: unknown,
): TargetElement | null {
  if (!node || typeof node !== "object") return null;
  if (React.isValidElement(node)) {
    if (node.type === component) return node as TargetElement;
    const props = node.props as { children?: unknown };
    if (props?.children) {
      if (Array.isArray(props.children)) {
        for (const child of props.children) {
          const found = findComponentInTree(child, component);
          if (found) return found;
        }
      } else {
        const found = findComponentInTree(props.children, component);
        if (found) return found;
      }
    }
  } else if (Array.isArray(node)) {
    for (const child of node) {
      const found = findComponentInTree(child, component);
      if (found) return found;
    }
  }
  return null;
}

function collectText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (!React.isValidElement(node)) return "";

  return collectText((node.props as { children?: unknown }).children);
}

describe("ShippingNoteDetailPage Customs Declarations RBAC", () => {
  const dummyDeclarations = [
    {
      id: "dec-1",
      shippingNoteId: "note-1",
      declarationNo: "DEC/2026/001",
      createdAt: now,
      updatedAt: now,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSellingChargesAndSummaryForNoteForUser.mockResolvedValue({
      charges: [],
      summary: { totalAmountVnd: "0.00" },
    });
    mocks.listBuyingChargesForNoteForUser.mockResolvedValue([]);
    mocks.listChargeTaxDetailsForNoteForUser.mockResolvedValue([]);
    mocks.listTaxRulesForUser.mockResolvedValue([]);
    mocks.listShippingNoteExportHistoryForUser.mockResolvedValue([]);
    mocks.getFinancialSummaryForNoteForUser.mockResolvedValue({
      totalSellingVnd: "0.00",
      totalBuyingVnd: "0.00",
      grossProfitVnd: "0.00",
    });
    mocks.getCancellationMetadataForNoteForUser.mockResolvedValue(null);
    mocks.listCustomsDeclarationsForNoteForUser.mockResolvedValue(dummyDeclarations);
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue([]);
  });

  it("Sale: never queries declarations, receives no declaration data, and renders no customs panel", async () => {
    const saleUser = makeUser("sale");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    // Server query was NEVER called for Sale
    expect(mocks.listCustomsDeclarationsForNoteForUser).not.toHaveBeenCalled();

    // CustomsDeclarationsPanel is NOT in the rendered component tree
    const panel = findComponentInTree(jsx, CustomsDeclarationsPanel);
    expect(panel).toBeNull();
  });

  it("Accountant: queries declarations and renders panel with canManage=true at submitted status", async () => {
    const accountantUser = makeUser("accountant");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: accountantUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    // Server query WAS called
    expect(mocks.listCustomsDeclarationsForNoteForUser).toHaveBeenCalledWith("note-1", accountantUser);

    // CustomsDeclarationsPanel IS in the rendered component tree with canManage=true
    const panel = findComponentInTree(jsx, CustomsDeclarationsPanel);
    expect(panel).not.toBeNull();
    expect(panel?.props.declarations).toEqual(dummyDeclarations);
    expect(panel?.props.canManage).toBe(true);
  });

  it("Accountant: queries declarations and renders panel with canManage=false at checked status", async () => {
    const accountantUser = makeUser("accountant");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: accountantUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("checked"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(mocks.listCustomsDeclarationsForNoteForUser).toHaveBeenCalledWith("note-1", accountantUser);

    const panel = findComponentInTree(jsx, CustomsDeclarationsPanel);
    expect(panel).not.toBeNull();
    expect(panel?.props.declarations).toEqual(dummyDeclarations);
    expect(panel?.props.canManage).toBe(false);
  });

  it("Admin: queries declarations and renders panel with canManage=true at submitted status", async () => {
    const adminUser = makeUser("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: adminUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(mocks.listCustomsDeclarationsForNoteForUser).toHaveBeenCalledWith("note-1", adminUser);

    const panel = findComponentInTree(jsx, CustomsDeclarationsPanel);
    expect(panel).not.toBeNull();
    expect(panel?.props.declarations).toEqual(dummyDeclarations);
    expect(panel?.props.canManage).toBe(true);
  });
});

describe("ShippingNoteDetailPage Draft edit presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSellingChargesAndSummaryForNoteForUser.mockResolvedValue({ charges: [], summary: { totalAmountVnd: "0.00" } });
    mocks.listBuyingChargesForNoteForUser.mockResolvedValue([]);
    mocks.listChargeTaxDetailsForNoteForUser.mockResolvedValue([]);
    mocks.listTaxRulesForUser.mockResolvedValue([]);
    mocks.listShippingNoteExportHistoryForUser.mockResolvedValue([]);
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue([]);
  });

  it("uses product copy for the Draft editor", async () => {
    const saleUser = makeUser("sale");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("draft"));

    const jsx = await ShippingNoteDetailPage({ params: Promise.resolve({ id: "note-1" }) });
    const text = collectText(jsx);

    expect(text).toContain("Edit Shipment");
    expect(text).toContain("Update shipment details while this shipment is still in Draft.");
    expect(text).not.toContain("Draft-only edit path");
  });
});

describe("ShippingNoteDetailPage creator attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSellingChargesAndSummaryForNoteForUser.mockResolvedValue({
      charges: [],
      summary: { totalAmountVnd: "0.00" },
    });
    mocks.listBuyingChargesForNoteForUser.mockResolvedValue([]);
    mocks.listChargeTaxDetailsForNoteForUser.mockResolvedValue([]);
    mocks.listTaxRulesForUser.mockResolvedValue([]);
    mocks.listShippingNoteExportHistoryForUser.mockResolvedValue([]);
    mocks.listCustomsDeclarationsForNoteForUser.mockResolvedValue([]);
    mocks.getFinancialSummaryForNoteForUser.mockResolvedValue({
      totalSellingVnd: "0.00",
      totalBuyingVnd: "0.00",
      grossProfitVnd: "0.00",
    });
    mocks.getCancellationMetadataForNoteForUser.mockResolvedValue(null);
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue([]);
  });

  it("shows the creator display name in the Timeline", async () => {
    const adminUser = makeUser("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: adminUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    const text = collectText(jsx);

    expect(text).toContain("Created by");
    expect(text).toContain("Sale Creator");
    expect(text).not.toContain("sale-1");
  });

  it("falls back to creator email when the display name is blank", async () => {
    const adminUser = makeUser("admin");
    const note = makeNote("submitted");
    note.createdBy = {
      name: "   ",
      email: "fallback@example.test",
    };
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: adminUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    const text = collectText(jsx);

    expect(text).toContain("Created by");
    expect(text).toContain("fallback@example.test");
    expect(text).not.toContain("sale-1");
  });
});
