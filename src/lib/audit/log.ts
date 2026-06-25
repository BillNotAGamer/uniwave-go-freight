import "server-only";

import type { Database } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

type AuditWriteDb = Pick<Database, "insert">;

type AuditSnapshot = Record<string, unknown> | null;

export type AuditLogInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

function toAuditSnapshot(value: unknown): AuditSnapshot {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export async function logAuditEvent(
  db: AuditWriteDb,
  input: AuditLogInput,
): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: toAuditSnapshot(input.before),
    after: toAuditSnapshot(input.after),
    reason: input.reason ?? null,
  });
}
