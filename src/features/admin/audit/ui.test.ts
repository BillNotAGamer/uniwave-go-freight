import { describe, expect, it } from "vitest";

import { encodeAuditViewerCursor } from "./cursor";
import {
  AUDIT_VIEWER_ACTION_OPTIONS,
  AUDIT_VIEWER_ENTITY_TYPE_OPTIONS,
  buildAuditViewerFilterHref,
  buildAuditViewerHref,
  parseAuditViewerPageSearchParams,
} from "./ui";

const uuid = "00000000-0000-4000-8000-000000000001";

describe("audit viewer UI helpers", () => {
  it("exports action and entity filter options from the Phase 10A catalog", () => {
    expect(AUDIT_VIEWER_ACTION_OPTIONS).toContainEqual({
      value: "user.role_change",
      label: "User role changed",
    });
    expect(AUDIT_VIEWER_ENTITY_TYPE_OPTIONS).toContainEqual({
      value: "shipping_note_export",
      label: "Shipping Note Export",
    });
  });

  it("parses structured query filters and maps date-only filters to Asia/Ho_Chi_Minh UTC boundaries", () => {
    const parsed = parseAuditViewerPageSearchParams({
      action: "shipping_note.approve",
      entityType: "shipping_note",
      entityId: uuid,
      actorId: uuid,
      from: "2026-08-24",
      to: "2026-08-24",
    });

    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      return;
    }

    expect(parsed.filters).toMatchObject({
      action: "shipping_note.approve",
      entityType: "shipping_note",
      entityId: uuid,
      actorId: uuid,
    });
    expect(parsed.filters.from?.toISOString()).toBe("2026-08-23T17:00:00.000Z");
    expect(parsed.filters.to?.toISOString()).toBe("2026-08-24T16:59:59.999Z");
  });

  it("rejects malformed filters through the Phase 10A validator", () => {
    expect(parseAuditViewerPageSearchParams({
      entityType: "audit_logs;drop",
    }).success).toBe(false);
    expect(parseAuditViewerPageSearchParams({
      actorId: "not-a-uuid",
    }).success).toBe(false);
    expect(parseAuditViewerPageSearchParams({
      from: "2026-99-99",
    }).success).toBe(false);
  });

  it("preserves filters for next-page links without decoding the opaque cursor", () => {
    const cursor = encodeAuditViewerCursor({
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      id: uuid,
    });
    const href = buildAuditViewerHref({
      formValues: {
        action: "user.role_change",
        entityType: "user",
        entityId: uuid,
        actorId: uuid,
        from: "2026-08-24",
        to: "2026-08-25",
      },
      cursor,
    });

    expect(href).toContain("action=user.role_change");
    expect(href).toContain("entityType=user");
    expect(href).toContain(`entityId=${uuid}`);
    expect(href).toContain(`actorId=${uuid}`);
    expect(href).toContain("from=2026-08-24");
    expect(href).toContain("to=2026-08-25");
    expect(href).toContain(`cursor=${encodeURIComponent(cursor)}`);
  });

  it("clears cursor when building a filter-submit href", () => {
    const href = buildAuditViewerFilterHref({
      action: "user.role_change",
      entityType: "user",
    });

    expect(href).toBe("/admin/audit?action=user.role_change&entityType=user");
    expect(href).not.toContain("cursor=");
  });
});
