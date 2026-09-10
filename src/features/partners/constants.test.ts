import { describe, expect, it } from "vitest";

import {
  CANONICAL_PARTNER_CATEGORIES,
  PARTNER_CATEGORY_CODES,
  PARTNER_CATEGORY_LABELS,
} from "./constants";

describe("Partner Category Constants", () => {
  it("defines exactly 7 canonical partner categories", () => {
    expect(PARTNER_CATEGORY_CODES).toHaveLength(7);
    expect(CANONICAL_PARTNER_CATEGORIES).toHaveLength(7);
    expect(Object.keys(PARTNER_CATEGORY_LABELS)).toHaveLength(7);
  });

  it("contains all required stable internal codes", () => {
    const expectedCodes = [
      "factory_sea",
      "air_factory",
      "airline",
      "co_loader_buying",
      "co_loader_selling",
      "oversea_agent_selling",
      "oversea_agent_buying",
    ];

    expect(Array.from(PARTNER_CATEGORY_CODES)).toEqual(expectedCodes);
  });

  it("has no duplicate internal codes", () => {
    const uniqueCodes = new Set(PARTNER_CATEGORY_CODES);
    expect(uniqueCodes.size).toBe(PARTNER_CATEGORY_CODES.length);
  });

  it("maps each code to its exact human-readable label", () => {
    const expectedLabels: Record<string, string> = {
      factory_sea: "FACTORY SEA",
      air_factory: "AIR FACTORY DATA",
      airline: "DATA HÃNG BAY",
      co_loader_buying: "CO_LOADER BUYING",
      co_loader_selling: "CO_LOADER SELLING",
      oversea_agent_selling: "AGENT OVERSEA SELLING",
      oversea_agent_buying: "AGENT OVERSEA BUYING",
    };

    for (const code of PARTNER_CATEGORY_CODES) {
      expect(PARTNER_CATEGORY_LABELS[code]).toBe(expectedLabels[code]);
    }
  });

  it("has unique human-readable labels", () => {
    const labels = Object.values(PARTNER_CATEGORY_LABELS);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("preserves canonical list metadata consistency", () => {
    for (const cat of CANONICAL_PARTNER_CATEGORIES) {
      expect(PARTNER_CATEGORY_CODES).toContain(cat.code);
      expect(cat.name).toBe(PARTNER_CATEGORY_LABELS[cat.code]);
      expect(cat.description.length).toBeGreaterThan(0);
    }
  });
});
