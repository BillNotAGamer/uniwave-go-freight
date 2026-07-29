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

export function canAccessDraftMutationSubject(
  note: ShippingNotePolicySubject,
  actor: ShippingNotePolicyActor,
): boolean {
  return note.status === "draft" && (
    actor.role !== "sale" || note.createdById === actor.id
  );
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
): boolean {
  return status === "checked";
}
