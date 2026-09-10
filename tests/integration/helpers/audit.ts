import { and, eq, inArray, sql } from "drizzle-orm";

import { auditLogs, type AuditLog } from "@/lib/db/schema";

import { db } from "../setup/database";

export async function listAuditLogsForEntity(
  entityType: string,
  entityId: string,
): Promise<AuditLog[]> {
  return db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId),
      ),
    );
}

export async function countAuditLogsForActions(
  actions: readonly string[],
): Promise<number> {
  if (actions.length === 0) {
    return 0;
  }

  const rows = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(inArray(auditLogs.action, [...actions]));

  return rows.length;
}

export async function countAuditLogsForRunAction(
  runId: string,
  action: string,
): Promise<number> {
  const rows = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, action),
        sql`(
          coalesce(${auditLogs.before}::text, '') like ${`%${runId}%`}
          or coalesce(${auditLogs.after}::text, '') like ${`%${runId}%`}
        )`,
      ),
    );

  return rows.length;
}
