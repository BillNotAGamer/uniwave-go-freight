import type { Role } from "@/lib/permissions/roles";

import type { ShippingNoteStatus } from "./constants";

export type ShippingNotePolicyActor = {
  id: string;
  role: Role;
};

export type ShippingNotePolicySubject = {
  status: ShippingNoteStatus;
  createdById: string | null;
};

export const BUYING_CHARGE_MUTABLE_STATUSES = [
  "submitted",
  "accounting_reviewing",
] as const satisfies readonly ShippingNoteStatus[];

export const CURRENT_ACCOUNTING_TRANSITIONS = [
  { from: "submitted", to: "accounting_reviewing" },
  { from: "accounting_reviewing", to: "checked" },
] as const satisfies readonly {
  from: ShippingNoteStatus;
  to: ShippingNoteStatus;
}[];

export const APPROVE_SOURCE_STATUSES = [
  "checked",
] as const satisfies readonly ShippingNoteStatus[];

export const INTERNAL_XLSX_EXPORT_ELIGIBLE_STATUSES = [
  "checked",
  "approved",
  "locked",
] as const satisfies readonly ShippingNoteStatus[];

export const LOCK_SOURCE_STATUSES = [
  "checked",
  "approved",
] as const satisfies readonly ShippingNoteStatus[];

export const UNLOCK_SOURCE_STATUSES = [
  "locked",
] as const satisfies readonly ShippingNoteStatus[];

export const NORMAL_CANCEL_SOURCE_STATUSES = [
  "draft",
  "submitted",
  "accounting_reviewing",
] as const satisfies readonly ShippingNoteStatus[];

export const FINALIZED_CANCEL_SOURCE_STATUSES = [
  "checked",
  "approved",
] as const satisfies readonly ShippingNoteStatus[];

export const REOPEN_FOR_CORRECTION_SOURCE_STATUSES = [
  "checked",
  "approved",
] as const satisfies readonly ShippingNoteStatus[];

export const NORMAL_BUSINESS_WORKFLOW_TARGET_STATUSES = [
  "submitted",
  "accounting_reviewing",
  "checked",
  "approved",
  "locked",
  "cancelled",
] as const satisfies readonly ShippingNoteStatus[];

export function canAccessDraftMutationSubject(
  note: ShippingNotePolicySubject,
  actor: ShippingNotePolicyActor,
): boolean {
  return note.status === "draft" && (
    actor.role !== "sale" || note.createdById === actor.id
  );
}

export function canSubmitShippingNoteDraft(
  note: ShippingNotePolicySubject,
  actor: ShippingNotePolicyActor,
): boolean {
  return note.status === "draft" && note.createdById === actor.id;
}

export function canMutateSellingChargeForDraft(
  note: ShippingNotePolicySubject,
  actor: ShippingNotePolicyActor,
): boolean {
  return (
    canAccessDraftMutationSubject(note, actor) &&
    actor.role !== "accountant"
  );
}

export function canMutateBuyingChargeAtStatus(
  status: ShippingNoteStatus,
): boolean {
  return BUYING_CHARGE_MUTABLE_STATUSES.some(
    (mutableStatus) => mutableStatus === status,
  );
}

export function isExpectedAccountingTransitionSource(
  currentStatus: ShippingNoteStatus,
  expectedStatus: ShippingNoteStatus,
): boolean {
  return currentStatus === expectedStatus;
}

export function isSupportedCurrentAccountingTransition(
  from: ShippingNoteStatus,
  to: ShippingNoteStatus,
): boolean {
  return CURRENT_ACCOUNTING_TRANSITIONS.some(
    (transition) => transition.from === from && transition.to === to,
  );
}

export function isInternalXlsxExportEligibleStatus(
  status: ShippingNoteStatus,
): status is (typeof INTERNAL_XLSX_EXPORT_ELIGIBLE_STATUSES)[number] {
  return statusInList(status, INTERNAL_XLSX_EXPORT_ELIGIBLE_STATUSES);
}

function statusInList(
  status: ShippingNoteStatus,
  allowedStatuses: readonly ShippingNoteStatus[],
): boolean {
  return allowedStatuses.some((allowedStatus) => allowedStatus === status);
}

export function canApproveShippingNoteStatus(
  status: ShippingNoteStatus,
): boolean {
  return statusInList(status, APPROVE_SOURCE_STATUSES);
}

export function canLockShippingNoteStatus(
  status: ShippingNoteStatus,
): boolean {
  return statusInList(status, LOCK_SOURCE_STATUSES);
}

export function canUnlockShippingNoteStatus(
  status: ShippingNoteStatus,
): boolean {
  return statusInList(status, UNLOCK_SOURCE_STATUSES);
}

export function canCancelShippingNoteStatus(
  status: ShippingNoteStatus,
): boolean {
  return statusInList(status, NORMAL_CANCEL_SOURCE_STATUSES);
}

export function canCancelFinalizedShippingNoteStatus(
  status: ShippingNoteStatus,
): boolean {
  return statusInList(status, FINALIZED_CANCEL_SOURCE_STATUSES);
}

export function canReopenShippingNoteForCorrectionStatus(
  status: ShippingNoteStatus,
): boolean {
  return statusInList(status, REOPEN_FOR_CORRECTION_SOURCE_STATUSES);
}

export function isNormalBusinessWorkflowTargetStatus(
  status: ShippingNoteStatus,
): boolean {
  return statusInList(status, NORMAL_BUSINESS_WORKFLOW_TARGET_STATUSES);
}

export function hasNormalOutboundBusinessTransition(
  status: ShippingNoteStatus,
): boolean {
  return status !== "cancelled" && status !== "exported";
}

export const IMMUTABLE_SHIPPING_NOTE_STATUSES = [
  "locked",
  "cancelled",
] as const satisfies readonly ShippingNoteStatus[];

export function isShippingNoteImmutable(status: ShippingNoteStatus): boolean {
  return statusInList(status, IMMUTABLE_SHIPPING_NOTE_STATUSES);
}

export function canCloseShippingNoteStatus(status: ShippingNoteStatus): boolean {
  return canLockShippingNoteStatus(status);
}
