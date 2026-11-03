import type { ShippingNoteStatus } from "../constants";
import { isShippingNoteImmutable } from "../status-policy";
import type { Role } from "@/lib/permissions/roles";
import {
  OPERATIONAL_SHIPPING_NOTE_DOCUMENT_TYPES,
  SHIPPING_NOTE_DOCUMENT_TYPES,
  type ShippingNoteDocumentType,
} from "./constants";

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
  documentType?: ShippingNoteDocumentType,
): boolean {
  if (actor.role === "admin" || actor.role === "accountant") {
    return true;
  }
  if (actor.role === "sale") {
    return Boolean(note.createdById && note.createdById === actor.id);
  }
  if (actor.role === "ops") {
    return documentType
      ? OPERATIONAL_SHIPPING_NOTE_DOCUMENT_TYPES.includes(documentType as (typeof OPERATIONAL_SHIPPING_NOTE_DOCUMENT_TYPES)[number])
      : true;
  }
  return false;
}

export function canMutateShippingNoteDocuments(
  note: { status: ShippingNoteStatus; createdById: string | null },
  actor: { id: string; role: Role },
  documentType?: ShippingNoteDocumentType,
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
  if (actor.role === "ops") {
    return documentType
      ? OPERATIONAL_SHIPPING_NOTE_DOCUMENT_TYPES.includes(documentType as (typeof OPERATIONAL_SHIPPING_NOTE_DOCUMENT_TYPES)[number])
      : true;
  }
  return false;
}

export function getShippingNoteDocumentTypesForActor(
  actor: { role: Role },
): readonly ShippingNoteDocumentType[] {
  return actor.role === "ops"
    ? OPERATIONAL_SHIPPING_NOTE_DOCUMENT_TYPES
    : SHIPPING_NOTE_DOCUMENT_TYPES;
}
