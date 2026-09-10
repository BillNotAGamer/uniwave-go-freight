import { describe, expect, it } from "vitest";

import { encodeAuditViewerCursor } from "./cursor";
import {
  AUDIT_VIEWER_DEFAULT_LIMIT,
  AUDIT_VIEWER_MAX_LIMIT,
  auditViewerFilterSchema,
} from "./validators";

const id = "00000000-0000-4000-8000-000000000001";

describe("audit viewer validators", () => {
  it("defaults and bounds page size", () => {
    expect(auditViewerFilterSchema.parse({}).limit)
      .toBe(AUDIT_VIEWER_DEFAULT_LIMIT);
    expect(auditViewerFilterSchema.parse({ limit: "100" }).limit)
      .toBe(AUDIT_VIEWER_MAX_LIMIT);
    expect(auditViewerFilterSchema.safeParse({ limit: "101" }).success)
      .toBe(false);
    expect(auditViewerFilterSchema.safeParse({ limit: "0" }).success)
      .toBe(false);
  });

  it("validates structured filters and rejects unknown query keys", () => {
    const cursor = encodeAuditViewerCursor({
      createdAt: new Date("2026-08-24T04:00:00.000Z"),
      id,
    });
    const parsed = auditViewerFilterSchema.parse({
      action: "user.role_change",
      entityType: "user",
      entityId: id,
      actorId: id,
      from: "2026-08-24T00:00:00.000Z",
      to: "2026-08-24T23:59:59.999Z",
      cursor,
      limit: "50",
    });

    expect(parsed).toMatchObject({
      action: "user.role_change",
      entityType: "user",
      entityId: id,
      actorId: id,
      limit: 50,
    });
    expect(parsed.cursor).toMatchObject({ id });
    expect(auditViewerFilterSchema.safeParse({ search: "deferred" }).success)
      .toBe(false);
  });

  it("rejects invalid filters", () => {
    expect(auditViewerFilterSchema.safeParse({ action: "unknown.action" }).success)
      .toBe(false);
    expect(auditViewerFilterSchema.safeParse({ entityType: "account" }).success)
      .toBe(false);
    expect(auditViewerFilterSchema.safeParse({ entityId: "not-a-uuid" }).success)
      .toBe(false);
    expect(auditViewerFilterSchema.safeParse({ actorId: "not-a-uuid" }).success)
      .toBe(false);
    expect(auditViewerFilterSchema.safeParse({ from: "bad-date" }).success)
      .toBe(false);
    expect(auditViewerFilterSchema.safeParse({
      from: "2026-08-25T00:00:00.000Z",
      to: "2026-08-24T00:00:00.000Z",
    }).success).toBe(false);
  });
});
