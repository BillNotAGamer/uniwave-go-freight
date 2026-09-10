import type { ShippingNoteStatus } from "../constants";
import { isShippingNoteImmutable } from "../status-policy";
import type { Role } from "@/lib/permissions/roles";

export const DOCUMENT_MUTABLE_STATUSES: readonly ShippingNoteStatus[] = [
  "draft",
  "submitted",
  "accounting_reviewing",
  "checked",
  "approved",
] as const;

export function isShippingNoteDocumentMutableStatus(
  status: ShippingNoteStatus,
): boolean {
  if (isShippingNoteImmutable(status)) {
    return false;
  }
  return DOCUMENT_MUTABLE_STATUSES.includes(status);
}

export function canReadShippingNoteDocuments(
  note: { status: ShippingNoteStatus; createdById: string | null },
  actor: { id: string; role: Role },
): boolean {
  if (actor.role === "admin" || actor.role === "accountant") {
    return true;
  }
  if (actor.role === "sale") {
    return Boolean(note.createdById && note.createdById === actor.id);
  }
  return false;
}

export function canMutateShippingNoteDocuments(
  note: { status: ShippingNoteStatus; createdById: string | null },
  actor: { id: string; role: Role },
): boolean {
  if (!isShippingNoteDocumentMutableStatus(note.status)) {
    return false;
  }
  if (actor.role === "admin" || actor.role === "accountant") {
    return true;
  }
  if (actor.role === "sale") {
    return Boolean(note.createdById && note.createdById === actor.id);
  }
  return false;
}
