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
import { ShippingNoteDocumentsPanel } from "@/features/shipping-notes/documents/components/shipping-note-documents-panel";
import { ShippingNoteDraftForm } from "@/features/shipping-notes/components/shipping-note-draft-form";
import { ShippingNoteSubmitForm } from "@/features/shipping-notes/components/shipping-note-submit-form";
import { ShippingNoteHardDeleteControls } from "@/features/shipping-notes/components/shipping-note-hard-delete-controls";
import { BuyingChargeForm } from "@/features/shipping-notes/components/buying-charge-form";

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
    commodityHsCode: null,
    commodity: null,
    hsCode: null,
    containerNo: null,
    sealNo: null,
    carrierName: null,
    grossWeight: null,
    chargeableWeight: null,
    licensePlate: null,
    driverInformation: null,
    vehiclePayloadCapacity: null,
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
  defaultExchangeRate?: string | null;
  documents?: unknown[];
  canManage?: boolean;
  canManageBuyingCharges?: boolean;
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

function countComponentsInTree(node: unknown, component: unknown): number {
  if (!node || typeof node !== "object") return 0;
  if (React.isValidElement(node)) {
    const props = node.props as { children?: unknown };
    return Number(node.type === component) + countComponentsInTree(props.children, component);
  }
  if (Array.isArray(node)) {
    return node.reduce(
      (count, child) => count + countComponentsInTree(child, component),
      0,
    );
  }
  return 0;
}

function findDefinitionValue(node: unknown, label: string): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const value = findDefinitionValue(child, label);
      if (value !== null) return value;
    }
    return null;
  }

  if (!React.isValidElement(node)) return null;

  const children = (node.props as { children?: unknown }).children;
  const directChildren = Array.isArray(children) ? children : [children];
  const definitionLabel = directChildren.find(
    (child) => React.isValidElement(child) && child.type === "dt",
  );
  const definitionValue = directChildren.find(
    (child) => React.isValidElement(child) && child.type === "dd",
  );

  if (definitionLabel && definitionValue && collectText(definitionLabel) === label) {
    return collectText(definitionValue);
  }

  return findDefinitionValue(children, label);
}

describe("ShippingNoteDetailPage Draft edit presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSellingChargesAndSummaryForNoteForUser.mockResolvedValue({ charges: [], summary: { totalAmountVnd: "0.00" } });
    mocks.listBuyingChargesForNoteForUser.mockResolvedValue([]);
    mocks.listChargeTaxDetailsForNoteForUser.mockResolvedValue([]);
    mocks.listTaxRulesForUser.mockResolvedValue([]);
    mocks.listShippingNoteExportHistoryForUser.mockResolvedValue([]);
    mocks.listCustomsDeclarationsForNoteForUser.mockResolvedValue([]);
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

  it("renders modern Air MAWB and HAWB instead of the empty legacy field", async () => {
    const saleUser = makeUser("sale");
    const note = makeNote("draft");
    note.shippingMode = "air_export";
    note.mawbNo = "MAWB-123";
    note.hawbNo = "HAWB-456";
    note.mawbHawbNo = null;
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findDefinitionValue(jsx, "MAWB / HAWB")).toBe("MAWB-123 / HAWB-456");
  });

  it("retains the legacy combined MAWB/HAWB fallback for historical notes", async () => {
    const saleUser = makeUser("sale");
    const note = makeNote("draft");
    note.mawbNo = null;
    note.hawbNo = null;
    note.mawbHawbNo = "LEGACY-AWB";
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findDefinitionValue(jsx, "MAWB / HAWB")).toBe("LEGACY-AWB");
  });

  it("shows separate Commodity and HS Code with legacy fallback", async () => {
    const saleUser = makeUser("sale");
    const noteWithSplit = makeNote("draft");
    noteWithSplit.commodity = "Precision Bearings";
    noteWithSplit.hsCode = "8482.10.00";
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(noteWithSplit);

    const jsxSplit = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    expect(findDefinitionValue(jsxSplit, "Commodity")).toBe("Precision Bearings");
    expect(findDefinitionValue(jsxSplit, "HS Code")).toBe("8482.10.00");

    // Legacy fallback test
    const noteLegacy = makeNote("draft");
    noteLegacy.commodity = null;
    noteLegacy.hsCode = null;
    noteLegacy.commodityHsCode = "Electronics / 8517";
    mocks.getShippingNoteDetailForUser.mockResolvedValue(noteLegacy);

    const jsxLegacy = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    expect(findDefinitionValue(jsxLegacy, "Commodity")).toBe("Electronics / 8517");
    expect(findDefinitionValue(jsxLegacy, "HS Code")).toBe("-");
  });

  it("renders Sea mode detail with Transport Documents and Gross Weight", async () => {
    const saleUser = makeUser("sale");
    const note = makeNote("draft");
    note.shippingMode = "sea_export";
    note.containerNo = "MSCU1234567";
    note.sealNo = "SEAL-9988";
    note.carrierName = "Mediterranean Shipping Company";
    note.grossWeight = "12500 KGS";
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    expect(findDefinitionValue(jsx, "MBL")).toBe("MBL-123");
    expect(findDefinitionValue(jsx, "HBL")).toBe("HBL-123");
    expect(findDefinitionValue(jsx, "Container No.")).toBe("MSCU1234567");
    expect(findDefinitionValue(jsx, "Seal No.")).toBe("SEAL-9988");
    expect(findDefinitionValue(jsx, "Carrier Name")).toBe("Mediterranean Shipping Company");
    expect(findDefinitionValue(jsx, "Gross Weight")).toBe("12500 KGS");

    // Must not render Air or Domestic fields
    expect(findDefinitionValue(jsx, "Chargeable Weight")).toBeNull();
    expect(findDefinitionValue(jsx, "License Plate")).toBeNull();
    expect(findDefinitionValue(jsx, "Driver Information")).toBeNull();
  });

  it("renders Air mode detail with MAWB/HAWB, Chargeable Weight and Gross Weight", async () => {
    const saleUser = makeUser("sale");
    const note = makeNote("draft");
    note.shippingMode = "air_export";
    note.mawbNo = "081-12345678";
    note.hawbNo = "HAWB-998877";
    note.chargeableWeight = "450.5 KGS";
    note.grossWeight = "420 KGS";
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    expect(findDefinitionValue(jsx, "MAWB / HAWB")).toBe("081-12345678 / HAWB-998877");
    expect(findDefinitionValue(jsx, "Chargeable Weight")).toBe("450.5 KGS");
    expect(findDefinitionValue(jsx, "Gross Weight")).toBe("420 KGS");

    // Must not render Sea documents or Domestic fields
    expect(findDefinitionValue(jsx, "Container No.")).toBeNull();
    expect(findDefinitionValue(jsx, "Seal No.")).toBeNull();
    expect(findDefinitionValue(jsx, "Carrier Name")).toBeNull();
    expect(findDefinitionValue(jsx, "License Plate")).toBeNull();
  });

  it("renders Domestic mode detail with License Plate, multiline Driver Information, and Payload", async () => {
    const saleUser = makeUser("sale");
    const note = makeNote("draft");
    note.shippingMode = "domestic_truck";
    note.domesticOrigin = "Warehouse A, Binh Duong";
    note.domesticDestination = "Port Cat Lai, HCMC";
    note.licensePlate = "51C-123.45";
    note.driverInformation = "Nguyen Van A\nCCCD: 079123456789\nPhone: 0901234567";
    note.vehiclePayloadCapacity = "5 TONS";
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    expect(findDefinitionValue(jsx, "License Plate")).toBe("51C-123.45");
    expect(findDefinitionValue(jsx, "Driver Information")).toContain("Nguyen Van A\nCCCD: 079123456789");
    expect(findDefinitionValue(jsx, "Vehicle Payload Capacity")).toBe("5 TONS");

    // Domestic has no Transport Documents card
    expect(findDefinitionValue(jsx, "Container No.")).toBeNull();
    expect(findDefinitionValue(jsx, "MAWB / HAWB")).toBeNull();
    expect(findDefinitionValue(jsx, "Chargeable Weight")).toBeNull();
  });

  it("keeps Admin edit access but hides Submit for a Sale-created Draft", async () => {
    const adminUser = makeUser("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: adminUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("draft"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findComponentInTree(jsx, ShippingNoteDraftForm)).not.toBeNull();
    expect(findComponentInTree(jsx, ShippingNoteSubmitForm)).toBeNull();
  });

  it("shows Submit for an Admin-created Draft viewed by that Admin", async () => {
    const adminUser = makeUser("admin");
    const note = makeNote("draft");
    note.createdById = adminUser.id;
    note.createdBy = {
      name: adminUser.name,
      email: adminUser.email,
    };
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: adminUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findComponentInTree(jsx, ShippingNoteDraftForm)).not.toBeNull();
    expect(findComponentInTree(jsx, ShippingNoteSubmitForm)).not.toBeNull();
  });

  it("shows Edit and Submit for a Sale creator viewing their own Draft", async () => {
    const saleUser = makeUser("sale");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("draft"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findComponentInTree(jsx, ShippingNoteDraftForm)).not.toBeNull();
    expect(findComponentInTree(jsx, ShippingNoteSubmitForm)).not.toBeNull();
  });
});

describe("ShippingNoteDetailPage Buying Charge defaults", () => {
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
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue([]);
  });

  it("passes the saved Shipping Note exchange rate to the new Buying Charge form", async () => {
    const accountantUser = makeUser("accountant");
    const note = makeNote("submitted");
    note.exchangeRate = "25450.000000";
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: accountantUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(note);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    const buyingChargeForm = findComponentInTree(jsx, BuyingChargeForm);
    expect(buyingChargeForm?.props.defaultExchangeRate).toBe("25450.000000");
  });
});

describe("ShippingNoteDetailPage OPS Buying Charge controls", () => {
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
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue([]);
  });

  it("shows OPS the existing Buying Charge form only while submitted", async () => {
    const opsUser = makeUser("ops");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: opsUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findComponentInTree(jsx, BuyingChargeForm)?.props.canManageBuyingCharges)
      .toBe(true);
    expect(collectText(jsx)).not.toContain("Buying Charge Tax Classification");
  });

  it("removes OPS Buying Charge mutation controls once Accounting Review starts", async () => {
    const opsUser = makeUser("ops");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: opsUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("accounting_reviewing"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findComponentInTree(jsx, BuyingChargeForm)?.props.canManageBuyingCharges)
      .toBe(false);
  });

  it("does not give Sale the OPS Buying Charge interface", async () => {
    const saleUser = makeUser("sale");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(findComponentInTree(jsx, BuyingChargeForm)).toBeNull();
  });
});

describe("ShippingNoteDetailPage unified documents", () => {
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
  });

  it("loads all categories once and renders one Documents panel", async () => {
    const adminUser = makeUser("admin");
    const documents = [
      {
        id: "invoice-doc-1",
        shippingNoteId: "note-1",
        documentType: "invoice" as const,
        originalFileName: "invoice.pdf",
        storageProvider: "r2" as const,
        mimeType: "application/pdf",
        sizeBytes: 1024,
        uploadedById: adminUser.id,
        createdAt: now,
      },
      {
        id: "customs-doc-1",
        shippingNoteId: "note-1",
        documentType: "customs_declaration" as const,
        originalFileName: "declaration.pdf",
        storageProvider: "r2" as const,
        mimeType: "application/pdf",
        sizeBytes: 2048,
        uploadedById: adminUser.id,
        createdAt: now,
      },
    ];
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: adminUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue(documents);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(mocks.listShippingNoteDocumentsForUser).toHaveBeenCalledTimes(1);
    expect(mocks.listShippingNoteDocumentsForUser).toHaveBeenCalledWith("note-1", adminUser);
    expect(countComponentsInTree(jsx, ShippingNoteDocumentsPanel)).toBe(1);

    const panel = findComponentInTree(jsx, ShippingNoteDocumentsPanel);
    expect(panel?.props.documents).toEqual(documents);
  });

  it("does not query or render the retired Customs Declaration Number UI", async () => {
    const accountantUser = makeUser("accountant");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: accountantUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue([]);

    const jsx = await ShippingNoteDetailPage({
      params: Promise.resolve({ id: "note-1" }),
    });
    const text = collectText(jsx);

    expect(mocks.listCustomsDeclarationsForNoteForUser).not.toHaveBeenCalled();
    expect(text).not.toContain("T\u1edd khai h\u1ea3i quan");
    expect(text).not.toContain("Th\u00eam s\u1ed1 t\u1edd khai h\u1ea3i quan");
  });
});

describe("ShippingNoteDetailPage hard-delete presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSellingChargesAndSummaryForNoteForUser.mockResolvedValue({ charges: [], summary: { totalAmountVnd: "0.00" } });
    mocks.listBuyingChargesForNoteForUser.mockResolvedValue([]);
    mocks.listChargeTaxDetailsForNoteForUser.mockResolvedValue([]);
    mocks.listTaxRulesForUser.mockResolvedValue([]);
    mocks.listShippingNoteExportHistoryForUser.mockResolvedValue([]);
    mocks.listCustomsDeclarationsForNoteForUser.mockResolvedValue([]);
    mocks.listShippingNoteDocumentsForUser.mockResolvedValue([]);
  });

  it("renders the destructive hard-delete control only for Admin", async () => {
    const adminUser = makeUser("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: adminUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));

    const adminPage = await ShippingNoteDetailPage({ params: Promise.resolve({ id: "note-1" }) });
    expect(findComponentInTree(adminPage, ShippingNoteHardDeleteControls)).not.toBeNull();

    const saleUser = makeUser("sale");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: saleUser });
    mocks.getShippingNoteDetailForUser.mockResolvedValue(makeNote("submitted"));
    const salePage = await ShippingNoteDetailPage({ params: Promise.resolve({ id: "note-1" }) });
    expect(findComponentInTree(salePage, ShippingNoteHardDeleteControls)).toBeNull();
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
