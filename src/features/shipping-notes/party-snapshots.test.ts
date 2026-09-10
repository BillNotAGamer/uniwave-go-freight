import { describe, expect, it } from "vitest";

import {
  getRequestedShippingNotePartnerIds,
  resolveShippingNotePartySnapshots,
} from "./party-snapshots";

describe("Shipping Note frozen Partner snapshots", () => {
  it("preserves the legacy text-only path without attempting automatic matching", () => {
    const input = {
      shipperText: "Legacy Shipper",
      consigneeText: "Legacy Consignee",
    };

    expect(getRequestedShippingNotePartnerIds(input)).toEqual([]);
    expect(resolveShippingNotePartySnapshots(input, [])).toMatchObject({
      shipperPartnerId: null,
      shipperText: "Legacy Shipper",
      consigneePartnerId: null,
      consigneeText: "Legacy Consignee",
      customerPartnerId: null,
      agentPartnerId: null,
    });
  });

  it("uses the selected Partner company name instead of mismatched client text", () => {
    const resolved = resolveShippingNotePartySnapshots(
      {
        shipperPartnerId: "partner-alpha",
        shipperText: "Wrong Company",
      },
      [{
        id: "partner-alpha",
        companyName: "Alpha",
        isActive: true,
        deletedAt: null,
      }],
    );

    expect(resolved.shipperPartnerId).toBe("partner-alpha");
    expect(resolved.shipperText).toBe("Alpha");
  });

  it.each([
    ["missing", []],
    ["inactive", [{
      id: "partner-alpha",
      companyName: "Alpha",
      isActive: false,
      deletedAt: null,
    }]],
    ["deleted", [{
      id: "partner-alpha",
      companyName: "Alpha",
      isActive: false,
      deletedAt: new Date("2026-01-01T00:00:00Z"),
    }]],
  ])("rejects a %s selected Partner", (_label, partners) => {
    expect(() => resolveShippingNotePartySnapshots(
      { shipperPartnerId: "partner-alpha" },
      partners,
    )).toThrow(/missing, inactive, or deleted/);
  });

  it("keeps the historical snapshot frozen after the Partner is renamed", () => {
    const partner = {
      id: "partner-alpha",
      companyName: "Alpha",
      isActive: true,
      deletedAt: null,
    };
    const persisted = resolveShippingNotePartySnapshots(
      { customerPartnerId: partner.id },
      [partner],
    );

    partner.companyName = "Beta";

    expect(persisted.customerPartnerId).toBe("partner-alpha");
    expect(persisted.customerText).toBe("Alpha");
    expect(partner.companyName).toBe("Beta");
  });
});
