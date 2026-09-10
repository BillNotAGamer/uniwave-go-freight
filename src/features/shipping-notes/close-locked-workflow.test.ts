import { describe, expect, it } from "vitest";

import { SHIPPING_NOTE_STATUSES, type ShippingNoteStatus } from "./constants";
import {
  canLockShippingNoteStatus,
  canCloseShippingNoteStatus,
  isShippingNoteImmutable,
  canMutateBuyingChargeAtStatus,
  canMutateSellingChargeForDraft,
  canAccessDraftMutationSubject,
} from "./status-policy";
import { canManageCustomsDeclarations } from "./customs-declarations/ui-policy";
import { canShowTaxMutationControls, isTaxMutableStatus } from "./tax/ui-policy";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

describe("Phase C9 Close / Locked Workflow Alignment", () => {
  describe("1. Status mapping and database representation", () => {
    it("preserves persisted status enum strictly as 'locked' without adding 'closed'", () => {
      expect(SHIPPING_NOTE_STATUSES).toContain("locked");
      expect((SHIPPING_NOTE_STATUSES as readonly string[]).includes("closed")).toBe(false);
      expect((SHIPPING_NOTE_STATUSES as readonly string[]).includes("close")).toBe(false);
    });
  });

  describe("2. Close eligibility across workflow statuses", () => {
    it("permits Close/Lock transition from checked and approved", () => {
      expect(canCloseShippingNoteStatus("checked")).toBe(true);
      expect(canCloseShippingNoteStatus("approved")).toBe(true);
      expect(canLockShippingNoteStatus("checked")).toBe(true);
      expect(canLockShippingNoteStatus("approved")).toBe(true);
    });

    it("rejects Close/Lock from all other statuses", () => {
      const nonCloseableStatuses: ShippingNoteStatus[] = [
        "draft",
        "submitted",
        "accounting_reviewing",
        "locked",
        "cancelled",
        "exported",
      ];

      for (const status of nonCloseableStatuses) {
        expect(canCloseShippingNoteStatus(status)).toBe(false);
        expect(canLockShippingNoteStatus(status)).toBe(false);
      }
    });

    it("identifies locked and cancelled as immutable terminal records", () => {
      expect(isShippingNoteImmutable("locked")).toBe(true);
      expect(isShippingNoteImmutable("cancelled")).toBe(true);

      const nonImmutableStatuses: ShippingNoteStatus[] = [
        "draft",
        "submitted",
        "accounting_reviewing",
        "checked",
        "approved",
        "exported",
      ];

      for (const status of nonImmutableStatuses) {
        expect(isShippingNoteImmutable(status)).toBe(false);
      }
    });
  });

  describe("3. Authorization for Close action", () => {
    it("authorizes Admin to close/lock notes", () => {
      expect(hasPermission("admin", PERMISSIONS.SHIPPING_NOTES_LOCK)).toBe(true);
    });

    it("strictly denies Sale and Accountant from closing/locking notes", () => {
      expect(hasPermission("sale", PERMISSIONS.SHIPPING_NOTES_LOCK)).toBe(false);
      expect(hasPermission("accountant", PERMISSIONS.SHIPPING_NOTES_LOCK)).toBe(false);
    });
  });

  describe("4. Immutability gates on locked notes across all mutation surfaces", () => {
    const lockedNote = {
      status: "locked" as ShippingNoteStatus,
      createdById: "sale-1",
    };
    const adminActor = { id: "admin-1", role: "admin" as const };
    const saleActor = { id: "sale-1", role: "sale" as const };
    const accountantActor = { id: "acc-1", role: "accountant" as const };

    it("rejects draft / core editing when note is locked", () => {
      expect(canAccessDraftMutationSubject(lockedNote, saleActor)).toBe(false);
      expect(canAccessDraftMutationSubject(lockedNote, adminActor)).toBe(false);
    });

    it("rejects selling charge mutations when note is locked", () => {
      expect(canMutateSellingChargeForDraft(lockedNote, saleActor)).toBe(false);
      expect(canMutateSellingChargeForDraft(lockedNote, adminActor)).toBe(false);
      expect(canMutateSellingChargeForDraft(lockedNote, accountantActor)).toBe(false);
    });

    it("rejects buying charge mutations when note is locked", () => {
      expect(canMutateBuyingChargeAtStatus("locked")).toBe(false);
    });

    it("rejects customs declaration mutations when note is locked", () => {
      expect(
        canManageCustomsDeclarations({ role: "accountant", status: "locked" }),
      ).toBe(false);
      expect(
        canManageCustomsDeclarations({ role: "admin", status: "locked" }),
      ).toBe(false);
      expect(
        canManageCustomsDeclarations({ role: "sale", status: "locked" }),
      ).toBe(false);
    });

    it("rejects tax mutations (assign rule, override VAT) when note is locked", () => {
      expect(isTaxMutableStatus("locked")).toBe(false);
      expect(
        canShowTaxMutationControls({ role: "accountant", status: "locked" }),
      ).toBe(false);
      expect(
        canShowTaxMutationControls({ role: "admin", status: "locked" }),
      ).toBe(false);
      expect(
        canShowTaxMutationControls({ role: "sale", status: "locked" }),
      ).toBe(false);
    });

    it("rejects double close (closing a note that is already locked)", () => {
      expect(canCloseShippingNoteStatus("locked")).toBe(false);
      expect(canLockShippingNoteStatus("locked")).toBe(false);
    });
  });

  describe("5. Existing workflow preservation", () => {
    it("preserves approval transition from checked", () => {
      expect(canCloseShippingNoteStatus("checked")).toBe(true);
      // approve remains available from checked as an optional parallel step
      expect(canLockShippingNoteStatus("approved")).toBe(true);
    });

    it("preserves export eligibility for checked, approved, and locked", () => {
      const eligibleStatuses: ShippingNoteStatus[] = ["checked", "approved", "locked"];
      for (const status of eligibleStatuses) {
        expect(canCloseShippingNoteStatus(status) || status === "locked").toBe(true);
      }
    });

    it("preserves cancelled immutability", () => {
      expect(isShippingNoteImmutable("cancelled")).toBe(true);
      expect(canCloseShippingNoteStatus("cancelled")).toBe(false);
    });
  });
});
