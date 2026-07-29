import { describe, expect, it } from "vitest";

import { SHIPPING_NOTE_STATUSES, type ShippingNoteStatus } from "./constants";
import {
  BUYING_CHARGE_MUTABLE_STATUSES,
  canAccessDraftMutationSubject,
  canMutateBuyingChargeAtStatus,
  canMutateSellingChargeForDraft,
  isExpectedAccountingTransitionSource,
  isInternalXlsxExportEligibleStatus,
  isSupportedCurrentAccountingTransition,
  type ShippingNotePolicyActor,
  type ShippingNotePolicySubject,
} from "./status-policy";

const saleOwner: ShippingNotePolicyActor = { id: "sale-1", role: "sale" };
const saleOther: ShippingNotePolicyActor = { id: "sale-2", role: "sale" };
const accountant: ShippingNotePolicyActor = {
  id: "accountant-1",
  role: "accountant",
};
const admin: ShippingNotePolicyActor = { id: "admin-1", role: "admin" };

function note(status: ShippingNoteStatus): ShippingNotePolicySubject {
  return {
    status,
    createdById: "sale-1",
  };
}

describe("shipping note status policy", () => {
  it("allows draft mutation for own sale draft and any admin draft", () => {
    expect(canAccessDraftMutationSubject(note("draft"), saleOwner)).toBe(true);
    expect(canAccessDraftMutationSubject(note("draft"), admin)).toBe(true);
  });

  it("denies draft mutation for other sale owner and non-draft statuses", () => {
    expect(canAccessDraftMutationSubject(note("draft"), saleOther)).toBe(false);
    expect(canAccessDraftMutationSubject(note("submitted"), saleOwner)).toBe(false);
    expect(canAccessDraftMutationSubject(note("checked"), admin)).toBe(false);
  });

  it("keeps selling charge mutations draft-only and denies accountant", () => {
    expect(canMutateSellingChargeForDraft(note("draft"), saleOwner)).toBe(true);
    expect(canMutateSellingChargeForDraft(note("draft"), admin)).toBe(true);
    expect(canMutateSellingChargeForDraft(note("draft"), accountant)).toBe(false);
    expect(canMutateSellingChargeForDraft(note("draft"), saleOther)).toBe(false);
    expect(canMutateSellingChargeForDraft(note("submitted"), admin)).toBe(false);
  });

  it("allows buying charge mutation only while submitted or accounting reviewing", () => {
    expect(BUYING_CHARGE_MUTABLE_STATUSES).toStrictEqual([
      "submitted",
      "accounting_reviewing",
    ]);

    for (const status of SHIPPING_NOTE_STATUSES) {
      expect(canMutateBuyingChargeAtStatus(status)).toBe(
        status === "submitted" || status === "accounting_reviewing",
      );
    }
  });

  it("characterizes the currently implemented accounting transitions", () => {
    expect(isSupportedCurrentAccountingTransition(
      "submitted",
      "accounting_reviewing",
    )).toBe(true);
    expect(isSupportedCurrentAccountingTransition(
      "accounting_reviewing",
      "checked",
    )).toBe(true);
    expect(isSupportedCurrentAccountingTransition("checked", "approved")).toBe(false);
    expect(isSupportedCurrentAccountingTransition("checked", "exported")).toBe(false);
    expect(isExpectedAccountingTransitionSource("submitted", "submitted")).toBe(true);
    expect(isExpectedAccountingTransitionSource("draft", "submitted")).toBe(false);
  });

  it("exports internal XLSX only from checked notes", () => {
    expect(isInternalXlsxExportEligibleStatus("checked")).toBe(true);
    expect(SHIPPING_NOTE_STATUSES.filter(
      (status) => !isInternalXlsxExportEligibleStatus(status),
    )).toStrictEqual([
      "draft",
      "submitted",
      "accounting_reviewing",
      "approved",
      "exported",
      "locked",
      "cancelled",
    ]);
  });
});
