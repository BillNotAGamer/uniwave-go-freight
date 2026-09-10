import { describe, expect, it } from "vitest";

import {
  getAdminUserRowActionPolicy,
} from "./ui-policy";
import type { AdminUserListItem } from "./types";

const baseItem: AdminUserListItem = {
  id: "target-1",
  name: "Target",
  email: "target@example.test",
  role: "sale",
  isActive: true,
  deletedAt: null,
  createdAt: new Date("2026-08-24T00:00:00.000Z"),
  updatedAt: new Date("2026-08-24T00:00:00.000Z"),
  accountStatus: "active",
  activeSessionCount: 1,
};

function policy(item: AdminUserListItem, viewerUserId = "admin-1") {
  return getAdminUserRowActionPolicy({
    viewerCanManageUsers: true,
    viewerUserId,
    item,
  });
}

describe("admin user row UI policy", () => {
  it("enables expected actions for active non-self users", () => {
    expect(policy(baseItem)).toMatchObject({
      canChangeRole: true,
      canDeactivate: true,
      canReactivate: false,
      canSoftDelete: true,
      canRevokeSessions: true,
      canSetTemporaryPassword: true,
      isReadOnlyDeleted: false,
    });
  });

  it("enables expected actions for inactive non-self users", () => {
    expect(policy({
      ...baseItem,
      isActive: false,
      accountStatus: "inactive",
    })).toMatchObject({
      canChangeRole: true,
      canDeactivate: false,
      canReactivate: true,
      canSoftDelete: true,
      canRevokeSessions: true,
      canSetTemporaryPassword: true,
    });
  });

  it("keeps deleted users read-only", () => {
    expect(policy({
      ...baseItem,
      isActive: false,
      deletedAt: new Date("2026-08-24T01:00:00.000Z"),
      accountStatus: "deleted",
    })).toMatchObject({
      canChangeRole: false,
      canDeactivate: false,
      canReactivate: false,
      canSoftDelete: false,
      canRevokeSessions: false,
      canSetTemporaryPassword: false,
      isReadOnlyDeleted: true,
    });
  });

  it("hides destructive self-actions for Admin self rows", () => {
    expect(policy({
      ...baseItem,
      id: "admin-1",
      role: "admin",
    }, "admin-1")).toMatchObject({
      canChangeRole: false,
      canDeactivate: false,
      canReactivate: false,
      canSoftDelete: false,
      canRevokeSessions: false,
      canSetTemporaryPassword: false,
    });
  });

  it("denies all actions when viewer cannot manage users", () => {
    expect(getAdminUserRowActionPolicy({
      viewerCanManageUsers: false,
      viewerUserId: "sale-1",
      item: baseItem,
    })).toMatchObject({
      canChangeRole: false,
      canDeactivate: false,
      canReactivate: false,
      canSoftDelete: false,
      canRevokeSessions: false,
      canSetTemporaryPassword: false,
    });
  });
});
