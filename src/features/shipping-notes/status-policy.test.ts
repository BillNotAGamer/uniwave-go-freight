import { describe, expect, it } from "vitest";

import { SHIPPING_NOTE_STATUSES, type ShippingNoteStatus } from "./constants";
import {
  BUYING_CHARGE_MUTABLE_STATUSES,
  canApproveShippingNoteStatus,
  canCancelFinalizedShippingNoteStatus,
  canCancelShippingNoteStatus,
  canAccessDraftMutationSubject,
  canLockShippingNoteStatus,
  canMutateBuyingChargeAtStatus,
  canMutateSellingChargeForDraft,
  canReopenShippingNoteForCorrectionStatus,
  canUnlockShippingNoteStatus,
  canCloseShippingNoteStatus,
  hasNormalOutboundBusinessTransition,
  isExpectedAccountingTransitionSource,
  isInternalXlsxExportEligibleStatus,
  isNormalBusinessWorkflowTargetStatus,
  isShippingNoteImmutable,
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

  it("exports internal XLSX only from checked, approved, or locked notes", () => {
    expect(isInternalXlsxExportEligibleStatus("checked")).toBe(true);
    expect(isInternalXlsxExportEligibleStatus("approved")).toBe(true);
    expect(isInternalXlsxExportEligibleStatus("locked")).toBe(true);
    expect(SHIPPING_NOTE_STATUSES.filter(
      (status) => !isInternalXlsxExportEligibleStatus(status),
    )).toStrictEqual([
      "draft",
      "submitted",
      "accounting_reviewing",
      "exported",
      "cancelled",
    ]);
  });

  it("allows future approval only from checked status", () => {
    expect(SHIPPING_NOTE_STATUSES.filter(canApproveShippingNoteStatus)).toStrictEqual([
      "checked",
    ]);
  });

  it("allows locking/closing from checked and approved status", () => {
    expect(SHIPPING_NOTE_STATUSES.filter(canLockShippingNoteStatus)).toStrictEqual([
      "checked",
      "approved",
    ]);
    expect(canLockShippingNoteStatus("checked")).toBe(true);
    expect(canLockShippingNoteStatus("approved")).toBe(true);
    expect(canCloseShippingNoteStatus("checked")).toBe(true);
  });

  it("identifies locked and cancelled as immutable terminal records", () => {
    expect(SHIPPING_NOTE_STATUSES.filter(isShippingNoteImmutable)).toStrictEqual([
      "locked",
      "cancelled",
    ]);
    expect(isShippingNoteImmutable("locked")).toBe(true);
    expect(isShippingNoteImmutable("cancelled")).toBe(true);
    expect(isShippingNoteImmutable("draft")).toBe(false);
    expect(isShippingNoteImmutable("submitted")).toBe(false);
    expect(isShippingNoteImmutable("accounting_reviewing")).toBe(false);
    expect(isShippingNoteImmutable("checked")).toBe(false);
    expect(isShippingNoteImmutable("approved")).toBe(false);
    expect(isShippingNoteImmutable("exported")).toBe(false);
  });

  it("allows future unlock from locked status only", () => {
    expect(SHIPPING_NOTE_STATUSES.filter(canUnlockShippingNoteStatus)).toStrictEqual([
      "locked",
    ]);
  });

  it("separates normal and finalized cancellation source statuses", () => {
    expect(SHIPPING_NOTE_STATUSES.filter(canCancelShippingNoteStatus)).toStrictEqual([
      "draft",
      "submitted",
      "accounting_reviewing",
    ]);
    expect(canCancelShippingNoteStatus("checked")).toBe(false);
    expect(canCancelShippingNoteStatus("approved")).toBe(false);
    expect(canCancelShippingNoteStatus("locked")).toBe(false);
    expect(canCancelShippingNoteStatus("cancelled")).toBe(false);
    expect(canCancelShippingNoteStatus("exported")).toBe(false);

    expect(
      SHIPPING_NOTE_STATUSES.filter(canCancelFinalizedShippingNoteStatus),
    ).toStrictEqual([
      "checked",
      "approved",
    ]);
    expect(canCancelFinalizedShippingNoteStatus("draft")).toBe(false);
    expect(canCancelFinalizedShippingNoteStatus("submitted")).toBe(false);
    expect(canCancelFinalizedShippingNoteStatus("accounting_reviewing")).toBe(false);
    expect(canCancelFinalizedShippingNoteStatus("locked")).toBe(false);
    expect(canCancelFinalizedShippingNoteStatus("cancelled")).toBe(false);
    expect(canCancelFinalizedShippingNoteStatus("exported")).toBe(false);
  });

  it("allows future correction reopen from checked or approved status", () => {
    expect(
      SHIPPING_NOTE_STATUSES.filter(canReopenShippingNoteForCorrectionStatus),
    ).toStrictEqual([
      "checked",
      "approved",
    ]);
    expect(canReopenShippingNoteForCorrectionStatus("draft")).toBe(false);
    expect(canReopenShippingNoteForCorrectionStatus("submitted")).toBe(false);
    expect(canReopenShippingNoteForCorrectionStatus("accounting_reviewing")).toBe(false);
    expect(canReopenShippingNoteForCorrectionStatus("locked")).toBe(false);
    expect(canReopenShippingNoteForCorrectionStatus("cancelled")).toBe(false);
    expect(canReopenShippingNoteForCorrectionStatus("exported")).toBe(false);
  });

  it("keeps cancelled terminal and exported outside normal workflow targets", () => {
    expect(hasNormalOutboundBusinessTransition("cancelled")).toBe(false);
    expect(hasNormalOutboundBusinessTransition("exported")).toBe(false);
    expect(isNormalBusinessWorkflowTargetStatus("exported")).toBe(false);
    expect(SHIPPING_NOTE_STATUSES.filter(isNormalBusinessWorkflowTargetStatus)).toStrictEqual([
      "submitted",
      "accounting_reviewing",
      "checked",
      "approved",
      "locked",
      "cancelled",
    ]);
  });
});
