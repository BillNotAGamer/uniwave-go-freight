import { describe, expect, it } from "vitest";

import { getNavLinks } from "./nav-links";

describe("dashboard navigation links", () => {
  it("shows Master Data only to Admin", () => {
    expect(getNavLinks("admin").map((link) => link.href))
      .toContain("/admin/master-data/partners");
    expect(getNavLinks("accountant").map((link) => link.href))
      .not.toContain("/admin/master-data/partners");
    expect(getNavLinks("sale").map((link) => link.href))
      .not.toContain("/admin/master-data/partners");
  });

  it("shows Admin Users only to roles with user-management capability", () => {
    expect(getNavLinks("admin").map((link) => link.href))
      .toContain("/admin/users");
    expect(getNavLinks("accountant").map((link) => link.href))
      .not.toContain("/admin/users");
    expect(getNavLinks("sale").map((link) => link.href))
      .not.toContain("/admin/users");
  });

  it("shows Audit only to roles with audit-log read capability", () => {
    expect(getNavLinks("admin").map((link) => link.href))
      .toContain("/admin/audit");
    expect(getNavLinks("accountant").map((link) => link.href))
      .not.toContain("/admin/audit");
    expect(getNavLinks("sale").map((link) => link.href))
      .not.toContain("/admin/audit");
  });
});
