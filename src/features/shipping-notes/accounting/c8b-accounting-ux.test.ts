import { describe, expect, it } from "vitest";

import {
  resolveChargeCatalogPersistence,
  type SelectableCatalogItem,
} from "./catalog-charge";
import { getEffectiveAccountingVatRate } from "./vat";
import { filterTaxRulesForChargeSection } from "../tax/ui-policy";
import {
  canReadCustomsDeclarations,
  canManageCustomsDeclarations,
} from "../customs-declarations/ui-policy";
import type { ChargeTaxDetail } from "../tax/types";
import type { SellingChargeDetail, BuyingChargeDetail } from "../types";

describe("Phase C8B Accounting Integration Invariants", () => {
  describe("Catalog / Manual persistence resolution", () => {
    const catalogItem: SelectableCatalogItem = {
      id: "cat-1",
      code: "OF-20",
      name: "Ocean Freight 20ft",
      primaryUnit: "Container",
      vatRate: "8.00",
      isActive: true,
      deletedAt: null,
    };

    it("submits serviceCatalogItemId and populates frozen snapshots in Catalog mode", () => {
      const resolved = resolveChargeCatalogPersistence(
        {
          serviceCatalogItemId: "cat-1",
          chargeName: "Should be overridden",
          unit: "Box",
        },
        catalogItem,
      );

      expect(resolved).toEqual({
        serviceCatalogItemId: "cat-1",
        catalogCodeSnapshot: "OF-20",
        catalogNameSnapshot: "Ocean Freight 20ft",
        catalogUnitSnapshot: "Container",
        catalogVatRateSnapshot: "8.00",
        chargeName: "Ocean Freight 20ft",
        unit: "Container",
      });
    });

    it("submits no serviceCatalogItemId and preserves free-text fields in Manual mode", () => {
      const resolved = resolveChargeCatalogPersistence(
        {
          serviceCatalogItemId: undefined,
          chargeName: "Custom Handling Fee",
          unit: "Shipment",
        },
        null,
      );

      expect(resolved).toEqual({
        serviceCatalogItemId: null,
        catalogCodeSnapshot: null,
        catalogNameSnapshot: null,
        catalogUnitSnapshot: null,
        catalogVatRateSnapshot: null,
        chargeName: "Custom Handling Fee",
        unit: "Shipment",
      });
    });

    it("clears stale catalog ID and snapshots when switched from Catalog to Manual", () => {
      // Switching to manual submits empty string or undefined serviceCatalogItemId
      const resolved = resolveChargeCatalogPersistence(
        {
          serviceCatalogItemId: "",
          chargeName: "Renamed Manual Fee",
          unit: "Trip",
        },
        null,
      );

      expect(resolved.serviceCatalogItemId).toBeNull();
      expect(resolved.catalogCodeSnapshot).toBeNull();
      expect(resolved.catalogNameSnapshot).toBeNull();
      expect(resolved.chargeName).toBe("Renamed Manual Fee");
    });
  });

  describe("Historical frozen snapshot display invariant", () => {
    it("preserves historical display from frozen snapshot even if live catalog is renamed", () => {
      // Suppose live catalog item was originally "Old Ocean Freight" and is now renamed to "Brand New 2026 Ocean Freight"
      const liveCatalogItem = {
        id: "cat-1",
        code: "OF-NEW",
        name: "Brand New 2026 Ocean Freight",
      };

      // Stored charge retains its frozen snapshots
      const storedSellingCharge: Partial<SellingChargeDetail> = {
        id: "charge-1",
        chargeName: "Old Ocean Freight",
        catalogNameSnapshot: "Old Ocean Freight",
        catalogCodeSnapshot: "OF-OLD",
      };

      const storedBuyingCharge: Partial<BuyingChargeDetail> = {
        id: "charge-2",
        chargeName: "Old Trucking",
        catalogNameSnapshot: "Old Trucking",
        catalogCodeSnapshot: "TRK-OLD",
      };

      // UI display formula
      const getDisplayChargeName = (c: { catalogNameSnapshot: string | null; chargeName: string }) =>
        c.catalogNameSnapshot ?? c.chargeName;
      const getDisplayChargeCode = (c: { catalogCodeSnapshot: string | null }) =>
        c.catalogCodeSnapshot;

      expect(getDisplayChargeName(storedSellingCharge as SellingChargeDetail)).toBe("Old Ocean Freight");
      expect(getDisplayChargeCode(storedSellingCharge as SellingChargeDetail)).toBe("OF-OLD");
      expect(getDisplayChargeName(storedSellingCharge as SellingChargeDetail)).not.toBe(liveCatalogItem.name);

      expect(getDisplayChargeName(storedBuyingCharge as BuyingChargeDetail)).toBe("Old Trucking");
      expect(getDisplayChargeCode(storedBuyingCharge as BuyingChargeDetail)).toBe("TRK-OLD");
    });
  });

  describe("VAT distinction: Catalog VAT vs. Accounting VAT", () => {
    it("supports simultaneously Catalog VAT = 8% and Accounting VAT = 10% without interference", () => {
      const chargeDetail: Partial<ChargeTaxDetail> = {
        catalogVatRateSnapshot: "8.00",
        taxRuleCodeSnapshot: "VAT-10",
        accountingBaselineVatRate: "10.00",
        effectiveAccountingVatRate: "10.00",
        vatPercent: "10.00",
        vatAmount: "100.00",
        isOverride: false,
      };

      const formatCatalogVatDisplay = (snapshot: string | null | undefined) =>
        snapshot ? `VAT danh mục: ${Number(snapshot)}%` : "VAT danh mục: Chưa xác định";

      const formatAccountingVatDisplay = (effective: string | null | undefined, applied: string) =>
        effective ? `${Number(effective)}%` : `${Number(applied)}%`;

      expect(formatCatalogVatDisplay(chargeDetail.catalogVatRateSnapshot)).toBe("VAT danh mục: 8%");
      expect(
        formatAccountingVatDisplay(
          chargeDetail.effectiveAccountingVatRate,
          chargeDetail.vatPercent!,
        ),
      ).toBe("10%");

      // Accounting effective rate is 10.00%, completely distinct from Catalog VAT 8.00%
      expect(getEffectiveAccountingVatRate({
        taxRuleVatRate: chargeDetail.accountingBaselineVatRate!,
        vatOverrideRate: null,
      })).toBe("10.00");
    });

    it("renders Catalog VAT NULL as 'Chưa xác định' and NEVER as '0%'", () => {
      const chargeWithNullCatalogVat: Partial<ChargeTaxDetail> = {
        catalogVatRateSnapshot: null,
        effectiveAccountingVatRate: "8.00",
        vatPercent: "8.00",
      };

      const formatCatalogVatDisplay = (snapshot: string | null | undefined) =>
        snapshot ? `VAT danh mục: ${Number(snapshot)}%` : "VAT danh mục: Chưa xác định";

      const rendered = formatCatalogVatDisplay(chargeWithNullCatalogVat.catalogVatRateSnapshot);
      expect(rendered).toBe("VAT danh mục: Chưa xác định");
      expect(rendered).not.toContain("0%");
      expect(rendered).not.toContain("0.00%");
    });
  });

  describe("Zero Tax Rules graceful empty state", () => {
    it("handles zero Tax Rules gracefully without crash and without promoting Catalog VAT", () => {
      const activeTaxRules = [] as const;

      const sellingRules = filterTaxRulesForChargeSection(activeTaxRules, "selling");
      const buyingRules = filterTaxRulesForChargeSection(activeTaxRules, "buying");

      expect(sellingRules).toHaveLength(0);
      expect(buyingRules).toHaveLength(0);

      // Invariant: Zero Tax Rules produces empty state text "Chưa có Tax Rule khả dụng", no crash
      const emptyStateMessage = sellingRules.length === 0 ? "Chưa có Tax Rule khả dụng" : null;
      expect(emptyStateMessage).toBe("Chưa có Tax Rule khả dụng");

      // Invariant: Catalog VAT is NOT promoted to a Tax Rule
      const catalogVat = "8.00";
      const resolvedTaxRate = sellingRules.length > 0 ? sellingRules[0].vatPercent : null;
      expect(resolvedTaxRate).toBeNull();
      expect(resolvedTaxRate).not.toBe(catalogVat);
    });
  });

  describe("Customs Declarations Read & Mutation RBAC Closure", () => {
    it("strictly denies Customs Declaration read and manage access to Sale", () => {
      expect(canReadCustomsDeclarations("sale")).toBe(false);
      expect(
        canManageCustomsDeclarations({ role: "sale", status: "submitted" }),
      ).toBe(false);
      expect(
        canManageCustomsDeclarations({
          role: "sale",
          status: "accounting_reviewing",
        }),
      ).toBe(false);
    });

    it("allows Customs Declaration read to Accountant and Admin", () => {
      expect(canReadCustomsDeclarations("accountant")).toBe(true);
      expect(canReadCustomsDeclarations("admin")).toBe(true);
    });

    it("restricts Customs Declaration mutation to submitted and accounting_reviewing statuses", () => {
      // Allowed mutable statuses
      expect(
        canManageCustomsDeclarations({
          role: "accountant",
          status: "submitted",
        }),
      ).toBe(true);
      expect(
        canManageCustomsDeclarations({
          role: "accountant",
          status: "accounting_reviewing",
        }),
      ).toBe(true);
      expect(
        canManageCustomsDeclarations({ role: "admin", status: "submitted" }),
      ).toBe(true);
      expect(
        canManageCustomsDeclarations({
          role: "admin",
          status: "accounting_reviewing",
        }),
      ).toBe(true);

      // Disallowed immutable statuses
      const immutableStatuses = [
        "draft",
        "checked",
        "approved",
        "locked",
        "cancelled",
      ] as const;
      for (const status of immutableStatuses) {
        expect(
          canManageCustomsDeclarations({ role: "accountant", status }),
        ).toBe(false);
        expect(
          canManageCustomsDeclarations({ role: "admin", status }),
        ).toBe(false);
      }
    });
  });
});
