import { describe, expect, it } from "vitest";

import { ALL_PERMISSIONS, hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "./permissions";
import { isRole, ROLES, type Role } from "./roles";

describe("role and permission matrix", () => {
  it("keeps role identifiers constrained to the supported roles", () => {
    expect(ROLES).toStrictEqual(["sale", "accountant", "admin"]);
    expect(isRole("sale")).toBe(true);
    expect(isRole("accountant")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("manager")).toBe(false);
    expect(isRole("")).toBe(false);
  });

  it("does not contain duplicate permission constants or role entries", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);

    for (const role of ROLES) {
      expect(new Set(ROLE_PERMISSIONS[role]).size).toBe(
        ROLE_PERMISSIONS[role].length,
      );
    }
  });

  it("only assigns permissions from the declared permission catalog", () => {
    const catalog = new Set(ALL_PERMISSIONS);

    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(catalog.has(permission)).toBe(true);
      }
    }
  });

  it("allows sale users to create and edit their own notes only", () => {
    expect(hasPermission("sale", PERMISSIONS.SHIPPING_NOTES_CREATE_OWN)).toBe(true);
    expect(hasPermission("sale", PERMISSIONS.SHIPPING_NOTES_EDIT_OWN)).toBe(true);
    expect(hasPermission("sale", PERMISSIONS.SHIPPING_NOTES_READ_ALL)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.BUYING_CHARGES_READ)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.BUYING_CHARGES_MANAGE)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.FINANCIAL_SUMMARY_READ)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.NET_PROFIT_READ)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.TAX_RULES_READ)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.CHARGE_TAX_ASSIGN)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.CHARGE_TAX_OVERRIDE)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.TAX_SUMMARY_READ)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.AUDIT_LOGS_READ)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.ADMIN_DESTRUCTIVE_ACTIONS)).toBe(false);
    expect(hasPermission("sale", PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL)).toBe(false);
  });

  it("allows accountants to review accounting data without note creation or admin powers", () => {
    expect(hasPermission("accountant", PERMISSIONS.SHIPPING_NOTES_READ_ALL)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.SHIPPING_NOTES_ACCOUNTING_REVIEW)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.SHIPPING_NOTES_MARK_CHECKED)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.ACCOUNTING_READ)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.BUYING_CHARGES_READ)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.BUYING_CHARGES_MANAGE)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.FINANCIAL_SUMMARY_READ)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.NET_PROFIT_READ)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.TAX_RULES_READ)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.TAX_RULES_MANAGE)).toBe(false);
    expect(hasPermission("accountant", PERMISSIONS.CHARGE_TAX_ASSIGN)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.CHARGE_TAX_OVERRIDE)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.TAX_SUMMARY_READ)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.EXPORTS_GENERATE)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL)).toBe(true);
    expect(hasPermission("accountant", PERMISSIONS.SHIPPING_NOTES_CREATE_OWN)).toBe(false);
    expect(hasPermission("accountant", PERMISSIONS.SHIPPING_NOTES_EDIT_OWN)).toBe(false);
    expect(hasPermission("accountant", PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasPermission("accountant", PERMISSIONS.ADMIN_DESTRUCTIVE_ACTIONS)).toBe(false);
    expect(hasPermission("accountant", PERMISSIONS.EXPORTS_UPLOAD)).toBe(false);
  });

  it("grants admin every declared permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission("admin", permission)).toBe(true);
    }
  });

  it("matches getPermissionsForRole admin coverage to all permissions", () => {
    const adminPermissions = new Set(ROLE_PERMISSIONS.admin);

    for (const permission of ALL_PERMISSIONS) {
      expect(adminPermissions.has(permission)).toBe(true);
    }
  });

  it("denies permissions to unchecked role strings once guarded with isRole", () => {
    const rawRole = "manager";
    expect(isRole(rawRole)).toBe(false);

    const result = isRole(rawRole)
      ? hasPermission(rawRole as Role, PERMISSIONS.ACCOUNTING_READ)
      : false;

    expect(result).toBe(false);
  });
});
