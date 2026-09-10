import { describe, expect, it } from "vitest";

import type { ShippingNoteStatus } from "../constants";
import {
  canReadCustomsDeclarations,
  isCustomsMutableStatus,
  canManageCustomsDeclarations,
} from "./ui-policy";

describe("Customs Declarations UI Policy", () => {
  describe("canReadCustomsDeclarations", () => {
    it("denies declaration read access to Sale role", () => {
      expect(canReadCustomsDeclarations("sale")).toBe(false);
    });

    it("allows declaration read access to Accountant and Admin roles", () => {
      expect(canReadCustomsDeclarations("accountant")).toBe(true);
      expect(canReadCustomsDeclarations("admin")).toBe(true);
    });
  });

  describe("isCustomsMutableStatus", () => {
    it("permits mutation only during submitted and accounting_reviewing statuses", () => {
      expect(isCustomsMutableStatus("submitted")).toBe(true);
      expect(isCustomsMutableStatus("accounting_reviewing")).toBe(true);

      const immutableStatuses: ShippingNoteStatus[] = [
        "draft",
        "checked",
        "approved",
        "locked",
        "cancelled",
      ];
      for (const status of immutableStatuses) {
        expect(isCustomsMutableStatus(status)).toBe(false);
      }
    });
  });

  describe("canManageCustomsDeclarations", () => {
    it("denies declaration management to Sale under all statuses", () => {
      const allStatuses: ShippingNoteStatus[] = [
        "draft",
        "submitted",
        "accounting_reviewing",
        "checked",
        "approved",
        "locked",
        "cancelled",
      ];
      for (const status of allStatuses) {
        expect(
          canManageCustomsDeclarations({ role: "sale", status }),
        ).toBe(false);
      }
    });

    it("allows declaration management to Accountant only at mutable statuses", () => {
      expect(
        canManageCustomsDeclarations({ role: "accountant", status: "submitted" }),
      ).toBe(true);
      expect(
        canManageCustomsDeclarations({
          role: "accountant",
          status: "accounting_reviewing",
        }),
      ).toBe(true);

      const immutableStatuses: ShippingNoteStatus[] = [
        "draft",
        "checked",
        "approved",
        "locked",
        "cancelled",
      ];
      for (const status of immutableStatuses) {
        expect(
          canManageCustomsDeclarations({ role: "accountant", status }),
        ).toBe(false);
      }
    });

    it("allows declaration management to Admin only at mutable statuses", () => {
      expect(
        canManageCustomsDeclarations({ role: "admin", status: "submitted" }),
      ).toBe(true);
      expect(
        canManageCustomsDeclarations({
          role: "admin",
          status: "accounting_reviewing",
        }),
      ).toBe(true);

      const immutableStatuses: ShippingNoteStatus[] = [
        "draft",
        "checked",
        "approved",
        "locked",
        "cancelled",
      ];
      for (const status of immutableStatuses) {
        expect(
          canManageCustomsDeclarations({ role: "admin", status }),
        ).toBe(false);
      }
    });
  });
});
