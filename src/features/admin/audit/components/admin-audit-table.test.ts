import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";

import type { AuditViewerItem } from "../types";

import { AdminAuditTable } from "./admin-audit-table";

const baseItem: AuditViewerItem = {
  id: "00000000-0000-4000-8000-000000000001",
  action: "user.role_change",
  actionLabel: "User role changed",
  category: "user",
  entityType: "user",
  entityId: "00000000-0000-4000-8000-000000000002",
  entityLabel: "Sale User <sale@example.test> (active)",
  entityHref: "/admin/users?search=sale%40example.test",
  actor: {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Admin User",
    email: "admin@example.test",
    display: "Admin User",
  },
  reason: "Role update",
  createdAt: new Date("2026-08-24T00:00:00.000Z"),
  createdAtDisplay: "24 Aug 2026, 07:00:00",
  detailsAvailable: true,
  changes: [
    {
      field: "role",
      label: "Role",
      before: "accountant",
      after: "sale",
    },
  ],
};

function render(items: AuditViewerItem[], nextHref: string | null = null): string {
  return renderToStaticMarkup(
    createElement(AdminAuditTable, {
      items,
      nextHref,
    }),
  );
}

describe("AdminAuditTable", () => {
  it("renders safe known-action details without raw JSON affordances", () => {
    const html = render([baseItem]);

    expect(html).toContain("User role changed");
    expect(html).toContain("user.role_change");
    expect(html).toContain("Role");
    expect(html).toContain("accountant");
    expect(html).toContain("sale");
    expect(html).not.toContain("Raw JSON");
    expect(html).not.toContain("View source");
    expect(html).not.toContain("Copy JSON");
  });

  it("renders unknown actions without a details toggle", () => {
    const html = render([{
      ...baseItem,
      action: "future.secret_action",
      actionLabel: "future.secret_action",
      category: "unknown",
      detailsAvailable: false,
      changes: [],
    }]);

    expect(html).toContain("future.secret_action");
    expect(html).toContain("No additional safe details available.");
    expect(html).not.toContain("<summary");
  });

  it("renders reasons as escaped plain text", () => {
    const html = render([{
      ...baseItem,
      reason: "<script>alert(1)</script>",
    }]);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("uses safe server-provided entity links and text fallbacks", () => {
    const html = render([
      baseItem,
      {
        ...baseItem,
        id: "00000000-0000-4000-8000-000000000004",
        entityLabel: null,
        entityHref: null,
        entityType: "future_entity",
        entityId: "00000000-0000-4000-8000-000000000005",
      },
    ]);

    expect(html).toContain('href="/admin/users?search=sale%40example.test"');
    expect(html).toContain("future_entity 00000000-000");
  });

  it("shows next navigation only when a safe opaque cursor href is supplied", () => {
    expect(render([baseItem])).not.toContain('href="/admin/audit?cursor=');
    expect(render([baseItem], "/admin/audit?cursor=opaque-token"))
      .toContain('href="/admin/audit?cursor=opaque-token"');
  });
});
