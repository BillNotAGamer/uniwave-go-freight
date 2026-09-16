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

  it("passes the exact trimmed commodity/HS code through draft update", async () => {
    const formData = new FormData();
    formData.set("id", "note-1");
    formData.set("jobsheetNo", "DOM-001");
    formData.set("shippingMode", "domestic_truck");
    formData.set("domesticOrigin", "HCM");
    formData.set("domesticDestination", "DAD");
    formData.set("commodityHsCode", "  Textiles / 5208  ");

    await updateShippingNoteDraftAction({ ok: true }, formData);

    expect(mocks.updateShippingNoteDraft).toHaveBeenCalledWith(
      "note-1",
      expect.objectContaining({ commodityHsCode: "Textiles / 5208" }),
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
      applicabilities: ["air_aol"],
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    await expect(searchShippingNoteLocationsAction(" Synthetic ", "air_aol")).resolves.toEqual([{
      code: "SYN-AIR",
      name: "Synthetic Other Location",
      type: "other",
      countryCode: "ZZ",
    }]);
    expect(mocks.searchRoutingLocations).toHaveBeenCalledWith(
      "Synthetic",
      actor,
      { applicability: "air_aol", limit: 12 },
    );
  });

  it("rejects invalid applicability without querying and never infers a type filter", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: "sale-1", role: "sale" } });

    await expect(
      searchShippingNoteLocationsAction("Synthetic", "airport" as never),
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

  it.each([
    ["admin", "sea_pol"],
    ["sale", "air_aol"],
    ["ops", "custom_origin"],
  ] as const)("allows %s to quick-create a Location with exact %s applicability", async (role, applicability) => {
    const actor = { id: `${role}-1`, role };
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });

    await expect(quickCreateShippingNoteLocationAction({
      code: " new ",
      name: " New Location ",
      type: "other",
      countryCode: " vn ",
      applicability,
    })).resolves.toEqual({
      ok: true,
      location: { code: "NEW", name: "New Location", type: "other", countryCode: "VN" },
    });
    expect(mocks.quickCreateRoutingLocation).toHaveBeenCalledWith({
      code: "NEW",
      name: "New Location",
      type: "other",
      countryCode: "VN",
      applicability,
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
      applicability: "air_aol",
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
      applicability: "sea_pol",
    })).resolves.toEqual({
      ok: false,
      error: "Location code is required.",
    });

    expect(mocks.quickCreatePartner).not.toHaveBeenCalled();
    expect(mocks.quickCreateRoutingLocation).not.toHaveBeenCalled();
  });

  it("returns a safe Location identity conflict without changing applicability or type", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: "sale-1", role: "sale" } });
    mocks.quickCreateRoutingLocation.mockRejectedValue(new RoutingLocationConflictError());

    await expect(quickCreateShippingNoteLocationAction({
      code: "SGN",
      name: "Synthetic",
      type: "other",
      applicability: "air_aol",
    })).resolves.toEqual({
      ok: false,
      error: "A Location with this type and code already exists.",
    });
    expect(mocks.quickCreateRoutingLocation).toHaveBeenCalledWith(
      expect.objectContaining({ type: "other", applicability: "air_aol" }),
      expect.anything(),
    );
  });
});
