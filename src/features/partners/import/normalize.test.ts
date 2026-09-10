import { describe, expect, it } from "vitest";

import { normalizeSourceRows } from "./normalize";
import type { RawParsedSourceRow } from "./parse-workbook";

describe("normalizeSourceRows", () => {
  it("isolates TBA placeholders into quarantine without creating BusinessPartner candidates", () => {
    const rawRows: RawParsedSourceRow[] = [
      {
        rowNumber: 10,
        categoryCode: "oversea_agent_selling",
        categoryHeader: "AGENT OVERSEA SELLING",
        stt: "1",
        vendorCode: "TBA",
        companyName: "TBA",
        address: "TBA",
        taxId: "TBA",
        email: "tba-agent@example.test",
        phone: null,
        pic: null,
      },
      {
        rowNumber: 11,
        categoryCode: "oversea_agent_selling",
        categoryHeader: "AGENT OVERSEA SELLING",
        stt: "2",
        vendorCode: "KNOWN-01",
        companyName: "Known Overseas Agent Ltd",
        address: "100 Trade Rd",
        taxId: "US12345",
        email: "contact@known.test",
        phone: "+1 555 1234",
        pic: "Agent John",
      },
    ];

    const result = normalizeSourceRows(rawRows);

    expect(result.quarantinedRows).toHaveLength(1);
    expect(result.quarantinedRows[0].reason).toBe("UNRESOLVED_SOURCE_PLACEHOLDER");
    expect(result.quarantinedRows[0].rowNumber).toBe(10);
    expect(result.partners).toHaveLength(1);
    expect(result.partners[0].companyName).toBe("Known Overseas Agent Ltd");
    expect(result.stats.tbaPlaceholders).toBe(1);
    expect(result.stats.unresolvedTbaContactRows).toBe(1);
  });

  it("deduplicates the same company appearing across multiple categories into one partner with multiple memberships", () => {
    const rawRows: RawParsedSourceRow[] = [
      // Presence 1 in Factory Sea
      {
        rowNumber: 3,
        categoryCode: "factory_sea",
        categoryHeader: "FACTORY SEA",
        stt: "1",
        vendorCode: "ACME-SEA",
        companyName: "Acme Global Manufacturing",
        address: "123 Coastal St",
        taxId: "0100200300",
        email: "jenny@acme.test",
        phone: "+84 901 001",
        pic: "Jenny",
      },
      // Presence 2 in Air Factory Data
      {
        rowNumber: 80,
        categoryCode: "air_factory",
        categoryHeader: "AIR FACTORY DATA",
        stt: "5",
        vendorCode: "ACME-AIR",
        companyName: "Acme Global Manufacturing",
        address: "123 Coastal St",
        taxId: "0100200300",
        email: "jenny@acme.test",
        phone: "+84 901 001",
        pic: "Jenny",
      },
    ];

    const result = normalizeSourceRows(rawRows);

    expect(result.partners).toHaveLength(1);
    expect(result.partners[0].companyName).toBe("Acme Global Manufacturing");
    expect(result.partners[0].categories).toEqual(["factory_sea", "air_factory"]);

    expect(result.categoryMemberships).toHaveLength(2);
    expect(result.categoryMemberships[0].categoryCode).toBe("factory_sea");
    expect(result.categoryMemberships[1].categoryCode).toBe("air_factory");

    // Identical contact row across both categories is deduplicated to 1 canonical contact
    expect(result.contacts).toHaveLength(1);
    expect(result.stats.exactDuplicateContactRows).toBe(1);
    expect(result.contacts[0].email).toBe("jenny@acme.test");
    expect(result.contacts[0].sourceRowNumbers).toEqual([3, 80]);
  });

  it("preserves distinct contacts under the same company", () => {
    const rawRows: RawParsedSourceRow[] = [
      {
        rowNumber: 3,
        categoryCode: "factory_sea",
        categoryHeader: "FACTORY SEA",
        stt: "1",
        vendorCode: "CO-01",
        companyName: "Multi Contact Corp",
        address: "1 Logistics Rd",
        taxId: "0303030303",
        email: "contact1@multi.test",
        phone: "+84 901 111",
        pic: "Alice",
      },
      {
        rowNumber: 4,
        categoryCode: "factory_sea",
        categoryHeader: "FACTORY SEA",
        stt: "1",
        vendorCode: "CO-01",
        companyName: "Multi Contact Corp",
        address: "1 Logistics Rd",
        taxId: "0303030303",
        email: "contact2@multi.test",
        phone: "+84 901 222",
        pic: "Bob",
      },
    ];

    const result = normalizeSourceRows(rawRows);

    expect(result.partners).toHaveLength(1);
    expect(result.contacts).toHaveLength(2);
    expect(result.stats.exactDuplicateContactRows).toBe(0);
    expect(result.contacts[0].picName).toBe("Alice");
    expect(result.contacts[1].picName).toBe("Bob");
  });
});
