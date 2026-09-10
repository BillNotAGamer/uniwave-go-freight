import type { AuditLog } from "@/lib/db/schema";

export const AUDIT_VIEWER_CATEGORIES = [
  "shipping_note",
  "charge",
  "tax",
  "export",
  "user",
  "unknown",
] as const;

export type AuditViewerCategory = (typeof AUDIT_VIEWER_CATEGORIES)[number];

export const AUDIT_VIEWER_ENTITY_TYPES = [
  "shipping_note",
  "shipping_note_charge",
  "shipping_note_export",
  "tax_rule",
  "user",
] as const;

export type AuditViewerEntityType = (typeof AUDIT_VIEWER_ENTITY_TYPES)[number];

export const AUDIT_VIEWER_KNOWN_ACTIONS = [
  "shipping_note.create_draft",
  "shipping_note.update_draft",
  "shipping_note.submit",
  "shipping_note.accounting_review.start",
  "shipping_note.accounting_review.checked",
  "shipping_note.approve",
  "shipping_note.lock",
  "shipping_note.unlock",
  "shipping_note.cancel",
  "shipping_note.reopen_for_correction",
  "shipping_note_charge.create",
  "shipping_note_charge.update",
  "shipping_note_charge.delete",
  "shipping_note_charge.buying.create",
  "shipping_note_charge.buying.update",
  "shipping_note_charge.buying.delete",
  "shipping_note_charge.tax_assign",
  "shipping_note_charge.tax_override",
  "tax_rule.create",
  "tax_rule.update",
  "tax_rule.deactivate",
  "shipping_note.export.xlsx.generated",
  "shipping_note.export.xlsx.failed",
  "shipping_note.export.pdf.generated",
  "shipping_note.export.pdf.failed",
  "shipping_note.export.drive.uploaded",
  "shipping_note.export.drive.failed",
  "user.create",
  "user.role_change",
  "user.deactivate",
  "user.reactivate",
  "user.soft_delete",
  "user.sessions_revoked",
  "user.password_set_by_admin",
] as const;

export type AuditViewerKnownAction =
  (typeof AUDIT_VIEWER_KNOWN_ACTIONS)[number];

export type AuditViewerActor = {
  id: string | null;
  name: string | null;
  email: string | null;
  display: string;
};

export type AuditViewerChange = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
};

export type AuditViewerEntityLabel = {
  entityType: string;
  entityId: string;
  label: string | null;
  href: string | null;
};

export type AuditViewerItem = {
  id: string;
  action: string;
  actionLabel: string;
  category: AuditViewerCategory;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  entityHref: string | null;
  actor: AuditViewerActor;
  reason: string | null;
  createdAt: Date;
  createdAtDisplay: string;
  detailsAvailable: boolean;
  changes: AuditViewerChange[];
};

export type AuditViewerPage = {
  items: AuditViewerItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
};

export type AuditViewerRawSnapshot = NonNullable<AuditLog["before"]>;
