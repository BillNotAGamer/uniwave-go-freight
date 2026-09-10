import "server-only";

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  auditLogs,
  shippingNoteCharges,
  shippingNoteExports,
  shippingNotes,
  taxRules,
  users,
  type User,
} from "@/lib/db/schema";

import { encodeAuditViewerCursor } from "./cursor";
import { buildAuditViewerItem } from "./presentation";
import { requireAuditViewerAccess } from "./policy";
import type {
  AuditViewerEntityLabel,
  AuditViewerEntityType,
  AuditViewerPage,
} from "./types";
import {
  auditViewerFilterSchema,
  type AuditViewerFilterInput,
  type AuditViewerFilters,
} from "./validators";

type AuditViewerQueryRow = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function buildAuditViewerWhere(
  filters: AuditViewerFilters,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }

  if (filters.entityType) {
    conditions.push(eq(auditLogs.entityType, filters.entityType));
  }

  if (filters.entityId) {
    conditions.push(eq(auditLogs.entityId, filters.entityId));
  }

  if (filters.actorId) {
    conditions.push(eq(auditLogs.actorUserId, filters.actorId));
  }

  if (filters.from) {
    conditions.push(gte(auditLogs.createdAt, filters.from));
  }

  if (filters.to) {
    conditions.push(lte(auditLogs.createdAt, filters.to));
  }

  if (filters.cursor) {
    const cursorCondition = or(
      lt(auditLogs.createdAt, filters.cursor.createdAt),
      and(
        eq(auditLogs.createdAt, filters.cursor.createdAt),
        lt(auditLogs.id, filters.cursor.id),
      ),
    );

    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function groupEntityIds(rows: AuditViewerQueryRow[]) {
  const grouped: Record<AuditViewerEntityType, string[]> = {
    shipping_note: [],
    shipping_note_charge: [],
    shipping_note_export: [],
    tax_rule: [],
    user: [],
  };

  for (const row of rows) {
    if (row.entityType in grouped) {
      grouped[row.entityType as AuditViewerEntityType].push(row.entityId);
    }
  }

  return {
    shipping_note: unique(grouped.shipping_note),
    shipping_note_charge: unique(grouped.shipping_note_charge),
    shipping_note_export: unique(grouped.shipping_note_export),
    tax_rule: unique(grouped.tax_rule),
    user: unique(grouped.user),
  };
}

function addLabel(
  labels: Map<string, AuditViewerEntityLabel>,
  label: AuditViewerEntityLabel,
): void {
  labels.set(entityKey(label.entityType, label.entityId), label);
}

async function resolveAuditViewerEntityLabels(
  rows: AuditViewerQueryRow[],
): Promise<Map<string, AuditViewerEntityLabel>> {
  const ids = groupEntityIds(rows);
  const labels = new Map<string, AuditViewerEntityLabel>();

  if (ids.shipping_note.length > 0) {
    const noteRows = await db
      .select({
        id: shippingNotes.id,
        jobsheetNo: shippingNotes.jobsheetNo,
      })
      .from(shippingNotes)
      .where(inArray(shippingNotes.id, ids.shipping_note));

    for (const note of noteRows) {
      addLabel(labels, {
        entityType: "shipping_note",
        entityId: note.id,
        label: note.jobsheetNo,
        href: `/shipping-notes/${note.id}`,
      });
    }
  }

  if (ids.shipping_note_charge.length > 0) {
    const chargeRows = await db
      .select({
        id: shippingNoteCharges.id,
        section: shippingNoteCharges.section,
        chargeName: shippingNoteCharges.chargeName,
        shippingNoteId: shippingNoteCharges.shippingNoteId,
        jobsheetNo: shippingNotes.jobsheetNo,
      })
      .from(shippingNoteCharges)
      .leftJoin(shippingNotes, eq(shippingNotes.id, shippingNoteCharges.shippingNoteId))
      .where(inArray(shippingNoteCharges.id, ids.shipping_note_charge));

    for (const charge of chargeRows) {
      addLabel(labels, {
        entityType: "shipping_note_charge",
        entityId: charge.id,
        label: `${charge.section} charge: ${charge.chargeName}`,
        href: charge.shippingNoteId ? `/shipping-notes/${charge.shippingNoteId}` : null,
      });
    }
  }

  if (ids.shipping_note_export.length > 0) {
    const exportRows = await db
      .select({
        id: shippingNoteExports.id,
        exportType: shippingNoteExports.exportType,
        version: shippingNoteExports.version,
        fileName: shippingNoteExports.fileName,
        shippingNoteId: shippingNoteExports.shippingNoteId,
        jobsheetNo: shippingNotes.jobsheetNo,
      })
      .from(shippingNoteExports)
      .leftJoin(shippingNotes, eq(shippingNotes.id, shippingNoteExports.shippingNoteId))
      .where(inArray(shippingNoteExports.id, ids.shipping_note_export));

    for (const exportRecord of exportRows) {
      const fileName = exportRecord.fileName ?? "unnamed export";
      addLabel(labels, {
        entityType: "shipping_note_export",
        entityId: exportRecord.id,
        label: `${fileName} (${exportRecord.exportType} v${exportRecord.version})`,
        href: exportRecord.shippingNoteId
          ? `/shipping-notes/${exportRecord.shippingNoteId}`
          : null,
      });
    }
  }

  if (ids.tax_rule.length > 0) {
    const taxRuleRows = await db
      .select({
        id: taxRules.id,
        code: taxRules.code,
        name: taxRules.name,
      })
      .from(taxRules)
      .where(inArray(taxRules.id, ids.tax_rule));

    for (const rule of taxRuleRows) {
      addLabel(labels, {
        entityType: "tax_rule",
        entityId: rule.id,
        label: `${rule.code} - ${rule.name}`,
        href: "/tax-rules",
      });
    }
  }

  if (ids.user.length > 0) {
    const userRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(inArray(users.id, ids.user));

    for (const user of userRows) {
      const status = user.deletedAt ? "deleted" : user.isActive ? "active" : "inactive";
      addLabel(labels, {
        entityType: "user",
        entityId: user.id,
        label: `${user.name} <${user.email}> (${status})`,
        href: `/admin/users?search=${encodeURIComponent(user.email)}`,
      });
    }
  }

  return labels;
}

export function toAuditViewerItems(input: {
  rows: AuditViewerQueryRow[];
  entityLabels: Map<string, AuditViewerEntityLabel>;
}) {
  return input.rows.map((row) => buildAuditViewerItem({
    row,
    entityLabel: input.entityLabels.get(entityKey(row.entityType, row.entityId)),
  }));
}

export async function listAuditViewerForUser(
  actor: User,
  input: AuditViewerFilterInput = {},
): Promise<AuditViewerPage> {
  requireAuditViewerAccess(actor);

  const filters = auditViewerFilterSchema.parse(input);
  const rows = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      before: auditLogs.before,
      after: auditLogs.after,
      reason: auditLogs.reason,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(buildAuditViewerWhere(filters))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(filters.limit + 1);

  const pageRows = rows.slice(0, filters.limit);
  const entityLabels = await resolveAuditViewerEntityLabels(pageRows);
  const items = toAuditViewerItems({
    rows: pageRows,
    entityLabels,
  });
  const hasNextPage = rows.length > filters.limit;
  const last = pageRows.at(-1);

  return {
    items,
    nextCursor: hasNextPage && last
      ? encodeAuditViewerCursor({ createdAt: last.createdAt, id: last.id })
      : null,
    hasNextPage,
    limit: filters.limit,
  };
}
