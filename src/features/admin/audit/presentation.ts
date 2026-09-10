import type {
  AuditViewerActor,
  AuditViewerCategory,
  AuditViewerChange,
  AuditViewerEntityLabel,
  AuditViewerItem,
  AuditViewerKnownAction,
} from "./types";
import {
  AUDIT_VIEWER_KNOWN_ACTIONS,
} from "./types";
import { formatAuditViewerDateTime } from "./timezone";

type Snapshot = Record<string, unknown> | null;

type AuditPresentationSource = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Snapshot;
  after: Snapshot;
  reason: string | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

type KnownActionConfig = {
  label: string;
  category: AuditViewerCategory;
  fields: readonly FieldConfig[];
};

type FieldConfig = {
  field: string;
  label: string;
  beforeKey?: string;
  afterKey?: string;
  fixedBefore?: string | null;
  fixedAfter?: string | null;
};

const shippingNoteStateFields = [
  { field: "status", label: "Status" },
  { field: "jobsheetNo", label: "Jobsheet No." },
  { field: "shippingMode", label: "Shipping mode" },
  { field: "checkedById", label: "Checked by" },
  { field: "checkedAt", label: "Checked at" },
  { field: "approvedById", label: "Approved by" },
  { field: "approvedAt", label: "Approved at" },
] as const satisfies readonly FieldConfig[];

const shippingNoteDraftFields = [
  { field: "jobsheetNo", label: "Jobsheet No." },
  { field: "status", label: "Status" },
  { field: "shippingMode", label: "Shipping mode" },
  { field: "mawbHawbNo", label: "MAWB/HAWB No." },
  { field: "customerText", label: "Customer" },
  { field: "shipperText", label: "Shipper" },
  { field: "consigneeText", label: "Consignee" },
  { field: "agentText", label: "Agent" },
  { field: "aol", label: "AOL" },
  { field: "aod", label: "AOD" },
  { field: "finalDestination", label: "Final destination" },
  { field: "exchangeRate", label: "Exchange rate" },
] as const satisfies readonly FieldConfig[];

const lockFields = [
  { field: "status", label: "Status" },
  { field: "lockedById", label: "Locked by" },
  { field: "lockedAt", label: "Locked at" },
  { field: "lockReason", label: "Lock reason" },
] as const satisfies readonly FieldConfig[];

const cancelFields = [
  { field: "status", label: "Status" },
  { field: "cancelledById", label: "Cancelled by" },
  { field: "cancelledAt", label: "Cancelled at" },
  { field: "cancelReason", label: "Cancel reason" },
] as const satisfies readonly FieldConfig[];

const reopenFields = [
  { field: "status", label: "Status" },
  { field: "checkedById", label: "Checked by" },
  { field: "checkedAt", label: "Checked at" },
  { field: "approvedById", label: "Approved by" },
  { field: "approvedAt", label: "Approved at" },
] as const satisfies readonly FieldConfig[];

const chargeFields = [
  { field: "chargeName", label: "Charge name" },
  { field: "section", label: "Section" },
  { field: "quantity", label: "Quantity" },
  { field: "unit", label: "Unit" },
  { field: "unitPrice", label: "Unit price" },
  { field: "currency", label: "Currency" },
  { field: "amountOriginal", label: "Amount original" },
  { field: "amountVnd", label: "Amount VND" },
  { field: "vendorOrAgentText", label: "Vendor/agent" },
] as const satisfies readonly FieldConfig[];

const taxFields = [
  { field: "taxRuleCodeSnapshot", label: "Tax rule code" },
  { field: "taxRuleNameSnapshot", label: "Tax rule name" },
  { field: "taxTreatmentSnapshot", label: "Tax treatment" },
  { field: "vatPercent", label: "VAT percent" },
  { field: "vatAmount", label: "VAT amount" },
  { field: "isOverride", label: "Override" },
  { field: "overrideReason", label: "Override reason" },
] as const satisfies readonly FieldConfig[];

const taxRuleFields = [
  { field: "code", label: "Code" },
  { field: "name", label: "Name" },
  { field: "description", label: "Description" },
  { field: "shippingMode", label: "Shipping mode" },
  { field: "chargeSection", label: "Charge section" },
  { field: "chargeNamePattern", label: "Charge name pattern" },
  { field: "taxTreatment", label: "Tax treatment" },
  { field: "vatPercent", label: "VAT percent" },
  { field: "isActive", label: "Active" },
] as const satisfies readonly FieldConfig[];

const exportGeneratedFields = [
  { field: "format", label: "Format" },
  { field: "templateVersion", label: "Template version" },
  { field: "metadataVersion", label: "Metadata version" },
  { field: "layoutVersion", label: "Layout version" },
  { field: "fileName", label: "File name" },
  { field: "checksum", label: "Checksum" },
  { field: "artifactSizeBytes", label: "Artifact size bytes" },
  { field: "artifactMimeType", label: "Artifact MIME type" },
  { field: "sellingChargeCount", label: "Selling charge count" },
  { field: "buyingChargeCount", label: "Buying charge count" },
] as const satisfies readonly FieldConfig[];

const exportFailedFields = [
  { field: "format", label: "Format" },
  { field: "templateVersion", label: "Template version" },
  { field: "metadataVersion", label: "Metadata version" },
  { field: "layoutVersion", label: "Layout version" },
  { field: "errorCode", label: "Error code" },
] as const satisfies readonly FieldConfig[];

const driveFields = [
  { field: "exportType", label: "Export type" },
  { field: "version", label: "Version" },
  { field: "checksum", label: "Checksum" },
  { field: "driveUploadStatus", label: "Drive upload status" },
  { field: "driveErrorMessage", label: "Drive error code" },
  { field: "currentShippingNoteStatus", label: "Current Shipping Note status" },
  { field: "reconciledFromDrive", label: "Reconciled from Drive" },
  { field: "retryCount", label: "Retry count" },
] as const satisfies readonly FieldConfig[];

const userFields = [
  { field: "name", label: "Name" },
  { field: "email", label: "Email" },
  { field: "role", label: "Role" },
  { field: "isActive", label: "Active" },
  { field: "deletedAt", label: "Deleted at" },
] as const satisfies readonly FieldConfig[];

const userLifecycleFields = [
  { field: "role", label: "Role" },
  { field: "isActive", label: "Active" },
  { field: "deletedAt", label: "Deleted at" },
  { field: "revokedSessionCount", label: "Revoked session count" },
] as const satisfies readonly FieldConfig[];

const actionCatalog: Record<AuditViewerKnownAction, KnownActionConfig> = {
  "shipping_note.create_draft": {
    label: "Shipping Note draft created",
    category: "shipping_note",
    fields: shippingNoteDraftFields,
  },
  "shipping_note.update_draft": {
    label: "Shipping Note draft updated",
    category: "shipping_note",
    fields: shippingNoteDraftFields,
  },
  "shipping_note.submit": {
    label: "Shipping Note submitted",
    category: "shipping_note",
    fields: shippingNoteStateFields,
  },
  "shipping_note.accounting_review.start": {
    label: "Accounting review started",
    category: "shipping_note",
    fields: shippingNoteStateFields,
  },
  "shipping_note.accounting_review.checked": {
    label: "Shipping Note checked",
    category: "shipping_note",
    fields: shippingNoteStateFields,
  },
  "shipping_note.approve": {
    label: "Shipping Note approved",
    category: "shipping_note",
    fields: [
      { field: "status", label: "Status" },
      { field: "approvedById", label: "Approved by" },
      { field: "approvedAt", label: "Approved at" },
    ],
  },
  "shipping_note.lock": {
    label: "Shipping Note locked",
    category: "shipping_note",
    fields: lockFields,
  },
  "shipping_note.unlock": {
    label: "Shipping Note unlocked",
    category: "shipping_note",
    fields: lockFields,
  },
  "shipping_note.cancel": {
    label: "Shipping Note cancelled",
    category: "shipping_note",
    fields: cancelFields,
  },
  "shipping_note.reopen_for_correction": {
    label: "Shipping Note reopened for correction",
    category: "shipping_note",
    fields: reopenFields,
  },
  "shipping_note_charge.create": {
    label: "Selling charge created",
    category: "charge",
    fields: chargeFields,
  },
  "shipping_note_charge.update": {
    label: "Selling charge updated",
    category: "charge",
    fields: chargeFields,
  },
  "shipping_note_charge.delete": {
    label: "Selling charge deleted",
    category: "charge",
    fields: chargeFields,
  },
  "shipping_note_charge.buying.create": {
    label: "Buying charge created",
    category: "charge",
    fields: chargeFields,
  },
  "shipping_note_charge.buying.update": {
    label: "Buying charge updated",
    category: "charge",
    fields: chargeFields,
  },
  "shipping_note_charge.buying.delete": {
    label: "Buying charge deleted",
    category: "charge",
    fields: chargeFields,
  },
  "shipping_note_charge.tax_assign": {
    label: "Charge tax rule assigned",
    category: "tax",
    fields: taxFields,
  },
  "shipping_note_charge.tax_override": {
    label: "Charge VAT overridden",
    category: "tax",
    fields: taxFields,
  },
  "tax_rule.create": {
    label: "Tax rule created",
    category: "tax",
    fields: taxRuleFields,
  },
  "tax_rule.update": {
    label: "Tax rule updated",
    category: "tax",
    fields: taxRuleFields,
  },
  "tax_rule.deactivate": {
    label: "Tax rule deactivated",
    category: "tax",
    fields: taxRuleFields,
  },
  "shipping_note.export.xlsx.generated": {
    label: "Internal XLSX export generated",
    category: "export",
    fields: exportGeneratedFields,
  },
  "shipping_note.export.xlsx.failed": {
    label: "Internal XLSX export failed",
    category: "export",
    fields: exportFailedFields,
  },
  "shipping_note.export.pdf.generated": {
    label: "Internal PDF export generated",
    category: "export",
    fields: exportGeneratedFields,
  },
  "shipping_note.export.pdf.failed": {
    label: "Internal PDF export failed",
    category: "export",
    fields: exportFailedFields,
  },
  "shipping_note.export.drive.uploaded": {
    label: "Export uploaded to Drive",
    category: "export",
    fields: driveFields,
  },
  "shipping_note.export.drive.failed": {
    label: "Export Drive upload failed",
    category: "export",
    fields: driveFields,
  },
  "user.create": {
    label: "User created",
    category: "user",
    fields: userFields,
  },
  "user.role_change": {
    label: "User role changed",
    category: "user",
    fields: userLifecycleFields,
  },
  "user.deactivate": {
    label: "User deactivated",
    category: "user",
    fields: userLifecycleFields,
  },
  "user.reactivate": {
    label: "User reactivated",
    category: "user",
    fields: userLifecycleFields,
  },
  "user.soft_delete": {
    label: "User soft-deleted",
    category: "user",
    fields: userLifecycleFields,
  },
  "user.sessions_revoked": {
    label: "User sessions revoked",
    category: "user",
    fields: [
      { field: "revokedSessionCount", label: "Revoked session count" },
    ],
  },
  "user.password_set_by_admin": {
    label: "Temporary password set by Admin",
    category: "user",
    fields: [
      {
        field: "adminPasswordEvent",
        label: "Administrative event",
        fixedBefore: null,
        fixedAfter: "Temporary password updated",
      },
      { field: "revokedSessionCount", label: "Revoked session count" },
    ],
  },
};

const sensitiveKeyFamilies = [
  "password",
  "passphrase",
  "passwordhash",
  "token",
  "sessiontoken",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "privatekey",
  "secret",
  "clientsecret",
  "credential",
  "databaseurl",
  "connectionstring",
  "artifactstoragekey",
  "authorization",
  "cookie",
] as const;

export const AUDIT_VIEWER_ACTION_CATALOG = actionCatalog;

export function isKnownAuditViewerAction(
  action: string,
): action is AuditViewerKnownAction {
  return AUDIT_VIEWER_KNOWN_ACTIONS.some((knownAction) => knownAction === action);
}

function normalizeSensitiveKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(value: string): boolean {
  const normalized = normalizeSensitiveKey(value);
  return sensitiveKeyFamilies.some((family) => normalized.includes(family));
}

export function sanitizeAuditPresentationValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAuditPresentationValue(item))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        continue;
      }

      const safeNestedValue = sanitizeAuditPresentationValue(nestedValue);

      if (safeNestedValue !== undefined) {
        sanitized[key] = safeNestedValue;
      }
    }

    return sanitized;
  }

  return value;
}

function snapshotValue(snapshot: Snapshot, key: string): unknown {
  if (!snapshot || typeof snapshot !== "object") {
    return undefined;
  }

  return snapshot[key];
}

function formatSnapshotValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function buildChange(
  fieldConfig: FieldConfig,
  before: Snapshot,
  after: Snapshot,
): AuditViewerChange | null {
  const beforeValue = fieldConfig.fixedBefore !== undefined
    ? fieldConfig.fixedBefore
    : formatSnapshotValue(snapshotValue(before, fieldConfig.beforeKey ?? fieldConfig.field));
  const afterValue = fieldConfig.fixedAfter !== undefined
    ? fieldConfig.fixedAfter
    : formatSnapshotValue(snapshotValue(after, fieldConfig.afterKey ?? fieldConfig.field));

  if (beforeValue === null && afterValue === null) {
    return null;
  }

  if (beforeValue === afterValue) {
    return null;
  }

  return {
    field: fieldConfig.field,
    label: fieldConfig.label,
    before: beforeValue,
    after: afterValue,
  };
}

function sanitizeChanges(changes: AuditViewerChange[]): AuditViewerChange[] {
  const sanitized = sanitizeAuditPresentationValue(changes);

  if (!Array.isArray(sanitized)) {
    return [];
  }

  return sanitized.filter((change): change is AuditViewerChange => {
    if (!change || typeof change !== "object") {
      return false;
    }

    const candidate = change as Partial<AuditViewerChange>;

    return typeof candidate.field === "string" &&
      typeof candidate.label === "string" &&
      (typeof candidate.before === "string" || candidate.before === null) &&
      (typeof candidate.after === "string" || candidate.after === null);
  });
}

export function getAuditActionPresentation(action: string): {
  actionLabel: string;
  category: AuditViewerCategory;
  known: boolean;
} {
  if (!isKnownAuditViewerAction(action)) {
    return {
      actionLabel: action,
      category: "unknown",
      known: false,
    };
  }

  const config = actionCatalog[action];

  return {
    actionLabel: config.label,
    category: config.category,
    known: true,
  };
}

export function presentAuditChanges(input: {
  action: string;
  before: Snapshot;
  after: Snapshot;
}): {
  detailsAvailable: boolean;
  changes: AuditViewerChange[];
} {
  if (!isKnownAuditViewerAction(input.action)) {
    return {
      detailsAvailable: false,
      changes: [],
    };
  }

  const changes = actionCatalog[input.action].fields
    .map((field) => buildChange(field, input.before, input.after))
    .filter((change): change is AuditViewerChange => Boolean(change));
  const safeChanges = sanitizeChanges(changes);

  return {
    detailsAvailable: safeChanges.length > 0,
    changes: safeChanges,
  };
}

export function buildAuditViewerActor(input: {
  actorUserId: string | null;
  name: string | null;
  email: string | null;
}): AuditViewerActor {
  return {
    id: input.actorUserId,
    name: input.name,
    email: input.email,
    display: input.name || input.email || "Unknown actor",
  };
}

export function buildAuditViewerItem(input: {
  row: AuditPresentationSource;
  entityLabel?: AuditViewerEntityLabel;
}): AuditViewerItem {
  const action = getAuditActionPresentation(input.row.action);
  const details = presentAuditChanges({
    action: input.row.action,
    before: input.row.before,
    after: input.row.after,
  });

  return {
    id: input.row.id,
    action: input.row.action,
    actionLabel: action.actionLabel,
    category: action.category,
    entityType: input.row.entityType,
    entityId: input.row.entityId,
    entityLabel: input.entityLabel?.label ?? null,
    entityHref: input.entityLabel?.href ?? null,
    actor: buildAuditViewerActor({
      actorUserId: input.row.actorUserId,
      name: input.row.actorName,
      email: input.row.actorEmail,
    }),
    reason: input.row.reason,
    createdAt: input.row.createdAt,
    createdAtDisplay: formatAuditViewerDateTime(input.row.createdAt),
    detailsAvailable: details.detailsAvailable,
    changes: details.changes,
  };
}
