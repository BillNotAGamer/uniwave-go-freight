import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  searchRoutingLocations: vi.fn(),
  searchPartners: vi.fn(),
  searchServiceCatalogItems: vi.fn(),
  hardDeleteShippingNote: vi.fn(),
  createShippingNoteDraft: vi.fn(),
  updateShippingNoteDraft: vi.fn(),
  quickCreatePartner: vi.fn(),
  quickCreateRoutingLocation: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/features/partners/queries", () => ({
  searchPartners: mocks.searchPartners,
}));
vi.mock("@/features/locations/queries", () => ({
  searchRoutingLocations: mocks.searchRoutingLocations,
}));
vi.mock("@/features/partners/mutations", () => ({
  quickCreatePartner: mocks.quickCreatePartner,
}));
vi.mock("@/features/locations/mutations", () => ({
  RoutingLocationConflictError: class RoutingLocationConflictError extends Error {},
  quickCreateRoutingLocation: mocks.quickCreateRoutingLocation,
}));
vi.mock("@/features/service-catalog/queries", () => ({
  SERVICE_CATALOG_LOOKUP_LIMIT: 12,
  searchServiceCatalogItems: mocks.searchServiceCatalogItems,
}));

vi.mock("./mutations", () => ({
  approveShippingNote: vi.fn(),
  cancelFinalizedShippingNote: vi.fn(),
  cancelShippingNote: vi.fn(),
  createBuyingChargeForNote: vi.fn(),
  createSellingChargeForNote: vi.fn(),
  createShippingNoteDraft: mocks.createShippingNoteDraft,
  lockShippingNote: vi.fn(),
  markShippingNoteChecked: vi.fn(),
  reopenShippingNoteForCorrection: vi.fn(),
  softDeleteBuyingCharge: vi.fn(),
  softDeleteSellingCharge: vi.fn(),
  startAccountingReview: vi.fn(),
  submitShippingNote: vi.fn(),
  unlockShippingNote: vi.fn(),
  updateBuyingCharge: vi.fn(),
  updateSellingCharge: vi.fn(),
  updateShippingNoteDraft: mocks.updateShippingNoteDraft,
}));

vi.mock("./hard-delete", () => ({
  hardDeleteShippingNote: mocks.hardDeleteShippingNote,
}));

import {
  createShippingNoteDraftAction,
  quickCreateShippingNoteLocationAction,
  quickCreateShippingNotePartnerAction,
  searchShippingNotePartnersAction,
  searchShippingNoteLocationsAction,
  searchShippingNoteServiceCatalogAction,
  updateShippingNoteDraftAction,
} from "./actions";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { RoutingLocationConflictError } from "@/features/locations/mutations";

describe("Shipping Note commodity/HS code actions", () => {
  const actor = { id: "sale-1", role: "sale" as const };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });
    mocks.createShippingNoteDraft.mockResolvedValue({ id: "note-1" });
    mocks.updateShippingNoteDraft.mockResolvedValue({ id: "note-1" });
  });

  it("passes a trimmed optional commodity/HS code through create", async () => {
    const formData = new FormData();
    formData.set("jobsheetNo", "DOM-001");
    formData.set("shippingMode", "domestic_truck");
    formData.set("domesticOrigin", "HCM");
    formData.set("domesticDestination", "DAD");
    formData.set("commodityHsCode", "  Electronics / 8517  ");

    await createShippingNoteDraftAction({ ok: true }, formData);

    expect(mocks.createShippingNoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({ commodityHsCode: "Electronics / 8517" }),
      actor,
    );
  });

  it("passes independent Commodity and HS Code through create preserving leading zeroes and punctuation", async () => {
    const formData = new FormData();
    formData.set("jobsheetNo", "COMM-001");
    formData.set("shippingMode", "sea_export");
    formData.set("portOfLoading", "VNSGN");
    formData.set("portOfDischarge", "USLAX");
    formData.set("finalDestination", "Los Angeles");
    formData.set("mblNo", "MBL-001");
    formData.set("hblNo", "HBL-001");
    formData.set("vesselName", "Ocean King");
    formData.set("voyageNo", "OK-01");
    formData.set("etd", "2026-06-01T08:00:00.000Z");
    formData.set("eta", "2026-06-20T14:00:00.000Z");
    formData.set("commodity", "  Frozen Seafood (Salmon)  ");
    formData.set("hsCode", "  0303.89  ");

    await createShippingNoteDraftAction({ ok: true }, formData);

    expect(mocks.createShippingNoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        commodity: "Frozen Seafood (Salmon)",
        hsCode: "0303.89",
      }),
      actor,
    );
  });

  it("passes independent Commodity and HS Code through update preserving leading zeroes", async () => {
    const formData = new FormData();
    formData.set("id", "note-1");
    formData.set("jobsheetNo", "COMM-002");
    formData.set("shippingMode", "air_export");
    formData.set("aol", "SGN");
    formData.set("aod", "NRT");
    formData.set("finalDestination", "Tokyo");
    formData.set("mawbNo", "123-45678901");
    formData.set("hawbNo", "HAWB-001");
    formData.set("flightNo", "JL752");
    formData.set("etd", "2026-06-01T08:00:00.000Z");
    formData.set("eta", "2026-06-01T14:00:00.000Z");
    formData.set("commodity", "Live Horses");
    formData.set("hsCode", "01012100");

    await updateShippingNoteDraftAction({ ok: true }, formData);

    expect(mocks.updateShippingNoteDraft).toHaveBeenCalledWith(
      "note-1",
      expect.objectContaining({
        commodity: "Live Horses",
        hsCode: "01012100",
      }),
      actor,
    );
  });

  it("persists Sea metadata (containerNo, sealNo, carrierName, grossWeight) on create and update", async () => {
    // Create Sea
    const createForm = new FormData();
    createForm.set("jobsheetNo", "SEA-001");
    createForm.set("shippingMode", "sea_export");
    createForm.set("portOfLoading", "VNSGN");
    createForm.set("portOfDischarge", "USLAX");
    createForm.set("finalDestination", "Los Angeles");
    createForm.set("mblNo", "MBL-888");
    createForm.set("hblNo", "HBL-999");
    createForm.set("vesselName", "Maersk Emerald");
    createForm.set("voyageNo", "ME-26");
    createForm.set("etd", "2026-06-01T08:00:00.000Z");
    createForm.set("eta", "2026-06-20T14:00:00.000Z");
    createForm.set("containerNo", "  TGHU9876543  ");
    createForm.set("sealNo", "  SEAL-1122  ");
    createForm.set("carrierName", "  Maersk Line  ");
    createForm.set("grossWeight", "  24,500 KGS  ");

    await createShippingNoteDraftAction({ ok: true }, createForm);

    expect(mocks.createShippingNoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        mblNo: "MBL-888",
        hblNo: "HBL-999",
        containerNo: "TGHU9876543",
        sealNo: "SEAL-1122",
        carrierName: "Maersk Line",
        grossWeight: "24,500 KGS",
      }),
      actor,
    );

    // Update Sea Import
    const updateForm = new FormData();
    updateForm.set("id", "note-sea-1");
    updateForm.set("jobsheetNo", "SEA-002");
    updateForm.set("shippingMode", "sea_import");
    updateForm.set("portOfLoading", "USLAX");
    updateForm.set("portOfDischarge", "VNSGN");
    updateForm.set("finalDestination", "Ho Chi Minh City");
    updateForm.set("mblNo", "MBL-111");
    updateForm.set("hblNo", "HBL-222");
    updateForm.set("vesselName", "MSC Sarah");
    updateForm.set("voyageNo", "MS-99");
    updateForm.set("etd", "2026-06-01T08:00:00.000Z");
    updateForm.set("eta", "2026-06-20T14:00:00.000Z");
    updateForm.set("containerNo", "MSCU1112223");
    updateForm.set("sealNo", "SEAL-3344");
    updateForm.set("carrierName", "MSC");
    updateForm.set("grossWeight", "18.5 TONS");

    await updateShippingNoteDraftAction({ ok: true }, updateForm);

    expect(mocks.updateShippingNoteDraft).toHaveBeenCalledWith(
      "note-sea-1",
      expect.objectContaining({
        containerNo: "MSCU1112223",
        sealNo: "SEAL-3344",
        carrierName: "MSC",
        grossWeight: "18.5 TONS",
      }),
      actor,
    );
  });

  it("persists Air metadata (chargeableWeight, grossWeight) on create and update", async () => {
    // Create Air Export
    const createForm = new FormData();
    createForm.set("jobsheetNo", "AIR-001");
    createForm.set("shippingMode", "air_export");
    createForm.set("aol", "SGN");
    createForm.set("aod", "SIN");
    createForm.set("finalDestination", "Singapore");
    createForm.set("mawbNo", "081-12345678");
    createForm.set("hawbNo", "HAWB-8888");
    createForm.set("flightNo", "SQ178");
    createForm.set("etd", "2026-06-01T08:00:00.000Z");
    createForm.set("eta", "2026-06-01T12:00:00.000Z");
    createForm.set("chargeableWeight", "  350.5 KGS  ");
    createForm.set("grossWeight", "  320 KGS  ");

    await createShippingNoteDraftAction({ ok: true }, createForm);

    expect(mocks.createShippingNoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        chargeableWeight: "350.5 KGS",
        grossWeight: "320 KGS",
      }),
      actor,
    );

    // Update Air Import
    const updateForm = new FormData();
    updateForm.set("id", "note-air-1");
    updateForm.set("jobsheetNo", "AIR-002");
    updateForm.set("shippingMode", "air_import");
    updateForm.set("aol", "SIN");
    updateForm.set("aod", "SGN");
    updateForm.set("finalDestination", "Ho Chi Minh City");
    updateForm.set("mawbNo", "081-87654321");
    updateForm.set("hawbNo", "HAWB-9999");
    updateForm.set("flightNo", "SQ179");
    updateForm.set("etd", "2026-06-01T08:00:00.000Z");
    updateForm.set("eta", "2026-06-01T12:00:00.000Z");
    updateForm.set("chargeableWeight", "500 KGS");
    updateForm.set("grossWeight", "480 KGS");

    await updateShippingNoteDraftAction({ ok: true }, updateForm);

    expect(mocks.updateShippingNoteDraft).toHaveBeenCalledWith(
      "note-air-1",
      expect.objectContaining({
        chargeableWeight: "500 KGS",
        grossWeight: "480 KGS",
      }),
      actor,
    );
  });

  it("persists Domestic metadata (licensePlate, multiline driverInformation, vehiclePayloadCapacity) and manual routing", async () => {
    const multilineDriver = "Driver: Tran Van B\nCCCD: 012345678901\nPhone: 0987654321\nNotes: Urgent delivery";
    const createForm = new FormData();
    createForm.set("jobsheetNo", "DOM-001");
    createForm.set("shippingMode", "domestic_truck");
    createForm.set("domesticOrigin", "Binh Duong Industrial Zone");
    createForm.set("domesticDestination", "Cat Lai Port, Thu Duc");
    createForm.set("licensePlate", "  60C-543.21  ");
    createForm.set("driverInformation", multilineDriver);
    createForm.set("vehiclePayloadCapacity", "  8 TONS  ");

    await createShippingNoteDraftAction({ ok: true }, createForm);

    expect(mocks.createShippingNoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        domesticOrigin: "Binh Duong Industrial Zone",
        domesticDestination: "Cat Lai Port, Thu Duc",
        licensePlate: "60C-543.21",
        driverInformation: multilineDriver,
        vehiclePayloadCapacity: "8 TONS",
      }),
      actor,
    );
  });
});

describe("Shipping Note Partner lookup action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: "sale-1", role: "sale" } });
  });

  it("uses the authorized active-only bounded Partner search and returns selector-safe fields", async () => {
    mocks.searchPartners.mockResolvedValue([
      {
        id: "partner-1",
        companyName: "Partner One",
        vendorCode: "P-001",
        categories: [{ name: "FACTORY SEA" }],
      },
    ]);

    await expect(searchShippingNotePartnersAction(" Partner ")).resolves.toEqual([
      {
        id: "partner-1",
        companyName: "Partner One",
        vendorCode: "P-001",
        categoryNames: ["FACTORY SEA"],
      },
    ]);

    expect(mocks.searchPartners).toHaveBeenCalledWith(
      "Partner",
      { id: "sale-1", role: "sale" },
      { activeOnly: true, limit: 12 },
    );
  });

  it("does not query Partners for invalid or blank search input", async () => {
    await expect(searchShippingNotePartnersAction("   ")).resolves.toEqual([]);
    expect(mocks.searchPartners).not.toHaveBeenCalled();
  });
});

describe("Shipping Note Service Catalog lookup action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: "accountant-1", role: "accountant" },
    });
  });

  it("uses the authorized bounded catalog search and returns only lookup fields", async () => {
    const item = {
      id: "catalog-1",
      code: "OF",
      name: "Ocean Freight",
      primaryUnit: "Shipment",
      vatRate: "8.00",
    };
    mocks.searchServiceCatalogItems.mockResolvedValue([item]);

    await expect(
      searchShippingNoteServiceCatalogAction(" Ocean "),
    ).resolves.toEqual([item]);
    expect(mocks.searchServiceCatalogItems).toHaveBeenCalledWith(
      "Ocean",
      { id: "accountant-1", role: "accountant" },
      12,
    );
  });

  it("does not query the catalog for blank input", async () => {
    await expect(searchShippingNoteServiceCatalogAction("  ")).resolves.toEqual([]);
    expect(mocks.searchServiceCatalogItems).not.toHaveBeenCalled();
  });
});

describe("Shipping Note Location lookup action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["admin", "sale", "ops", "accountant"] as const)("allows %s through the canonical read query", async (role) => {
    const actor = { id: `${role}-1`, role };
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });
    mocks.searchRoutingLocations.mockResolvedValue([{
      id: "location-1",
      code: "SYN-AIR",
      name: "Synthetic Other Location",
      type: "other",
      countryCode: "ZZ",
      subdivision: null,
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    await expect(searchShippingNoteLocationsAction(" Synthetic ")).resolves.toEqual([{
      code: "SYN-AIR",
      name: "Synthetic Other Location",
      type: "other",
      countryCode: "ZZ",
    }]);
    expect(mocks.searchRoutingLocations).toHaveBeenCalledWith(
      "Synthetic",
      actor,
      { limit: 12 },
    );
  });

  it("rejects blank search without querying", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: "sale-1", role: "sale" } });

    await expect(
      searchShippingNoteLocationsAction("  "),
    ).resolves.toEqual([]);
    expect(mocks.searchRoutingLocations).not.toHaveBeenCalled();
  });
});

describe("Shipping Note Master Data quick-create actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quickCreatePartner.mockResolvedValue({
      id: "partner-new",
      companyName: "New Partner",
      vendorCode: "NP",
      categories: [],
    });
    mocks.quickCreateRoutingLocation.mockResolvedValue({
      code: "NEW",
      name: "New Location",
      type: "other",
      countryCode: "VN",
    });
  });

  it.each(["admin", "sale", "ops"] as const)("allows %s to quick-create a Partner", async (role) => {
    const actor = { id: `${role}-1`, role };
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });

    await expect(quickCreateShippingNotePartnerAction({
      companyName: " New Partner ",
      vendorCode: " NP ",
      taxId: " MST-1 ",
      address: " Address ",
    })).resolves.toEqual({
      ok: true,
      partner: {
        id: "partner-new",
        companyName: "New Partner",
        vendorCode: "NP",
        categoryNames: [],
      },
    });
    expect(mocks.quickCreatePartner).toHaveBeenCalledWith({
      companyName: "New Partner",
      vendorCode: "NP",
      taxId: "MST-1",
      address: "Address",
    }, actor);
  });

  it.each(["admin", "sale", "ops"] as const)("allows %s to quick-create a catalog Location", async (role) => {
    const actor = { id: `${role}-1`, role };
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });

    await expect(quickCreateShippingNoteLocationAction({
      code: " new ",
      name: " New Location ",
      type: "other",
      countryCode: " vn ",
    })).resolves.toEqual({
      ok: true,
      location: { code: "NEW", name: "New Location", type: "other", countryCode: "VN" },
    });
    expect(mocks.quickCreateRoutingLocation).toHaveBeenCalledWith({
      code: "NEW",
      name: "New Location",
      type: "other",
      countryCode: "VN",
    }, actor);
  });

  it("rejects Accountant quick-create attempts at the domain boundary", async () => {
    const actor = { id: "accountant-1", role: "accountant" as const };
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });
    mocks.quickCreatePartner.mockRejectedValue(new AuthorizationError());
    mocks.quickCreateRoutingLocation.mockRejectedValue(new AuthorizationError());

    await expect(quickCreateShippingNotePartnerAction({ companyName: "Denied" })).resolves.toEqual({
      ok: false,
      error: "You do not have permission to quick-create Partners.",
    });
    await expect(quickCreateShippingNoteLocationAction({
      code: "DENIED",
      name: "Denied",
      type: "other",
    })).resolves.toEqual({
      ok: false,
      error: "You do not have permission to quick-create Locations.",
    });
  });

  it("returns canonical validation feedback before invoking quick-create mutations", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: "sale-1", role: "sale" } });

    await expect(quickCreateShippingNotePartnerAction({ companyName: "   " })).resolves.toEqual({
      ok: false,
      error: "Company name is required.",
    });
    await expect(quickCreateShippingNoteLocationAction({
      code: "",
      name: "",
      type: "other",
    })).resolves.toEqual({
      ok: false,
      error: "Location code is required.",
    });

    expect(mocks.quickCreatePartner).not.toHaveBeenCalled();
    expect(mocks.quickCreateRoutingLocation).not.toHaveBeenCalled();
  });

  it("returns a safe Location identity conflict without changing type", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: "sale-1", role: "sale" } });
    mocks.quickCreateRoutingLocation.mockRejectedValue(new RoutingLocationConflictError());

    await expect(quickCreateShippingNoteLocationAction({
      code: "SGN",
      name: "Synthetic",
      type: "other",
    })).resolves.toEqual({
      ok: false,
      error: "A Location with this type and code already exists.",
    });
    expect(mocks.quickCreateRoutingLocation).toHaveBeenCalledWith(
      expect.objectContaining({ type: "other" }),
      expect.anything(),
    );
  });
});
