import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  searchRoutingLocations: vi.fn(),
  searchPartners: vi.fn(),
  searchServiceCatalogItems: vi.fn(),
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
  createShippingNoteDraft: vi.fn(),
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
  updateShippingNoteDraft: vi.fn(),
}));

import {
  searchShippingNotePartnersAction,
  searchShippingNoteLocationsAction,
  searchShippingNoteServiceCatalogAction,
} from "./actions";

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

  it.each(["admin", "sale", "accountant"] as const)("allows %s through the canonical read query", async (role) => {
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
