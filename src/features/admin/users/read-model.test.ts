import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from "@/lib/db/client";
import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import {
  buildAdminUsersListWhere,
  listAdminUsersForUser,
  toAdminUserListItem,
} from "./read-model";
import { adminUsersListQuerySchema } from "./validators";

const mockedDb = vi.mocked(db);
const now = new Date("2026-08-23T00:00:00.000Z");

function user(role: User["role"]): User {
  return {
    id: `${role}-1`,
    email: `${role}@example.test`,
    name: role,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

describe("admin users read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps only safe DTO fields and derives account status", () => {
    const item = toAdminUserListItem({
      id: "user-1",
      name: "User One",
      email: "user@example.test",
      role: "accountant",
      isActive: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      activeSessionCount: 2,
      password: "secret",
      passwordHash: "hash",
      sessionToken: "session-token",
      token: "token",
      accessToken: "access",
      refreshToken: "refresh",
      artifactStorageKey: "r2-key",
      googleCredentials: "google",
    } as never);

    expect(item).toMatchObject({
      id: "user-1",
      name: "User One",
      email: "user@example.test",
      role: "accountant",
      isActive: false,
      deletedAt: null,
      accountStatus: "inactive",
      activeSessionCount: 2,
    });
    expect(item).not.toHaveProperty("password");
    expect(item).not.toHaveProperty("passwordHash");
    expect(item).not.toHaveProperty("sessionToken");
    expect(item).not.toHaveProperty("token");
    expect(item).not.toHaveProperty("accessToken");
    expect(item).not.toHaveProperty("refreshToken");
    expect(item).not.toHaveProperty("artifactStorageKey");
    expect(item).not.toHaveProperty("googleCredentials");
  });

  it("denies Sale and Accountant before querying users", async () => {
    await expect(listAdminUsersForUser(user("sale"))).rejects
      .toBeInstanceOf(AuthorizationError);
    await expect(listAdminUsersForUser(user("accountant"))).rejects
      .toBeInstanceOf(AuthorizationError);
    expect(mockedDb.select).not.toHaveBeenCalled();
  });

  it("allows Admin and returns bounded paginated metadata", async () => {
    const totalWhere = vi.fn().mockResolvedValue([{ total: 1 }]);
    const totalFrom = vi.fn(() => ({ where: totalWhere }));

    const offset = vi.fn().mockResolvedValue([
      {
        id: "admin-2",
        name: "Admin Two",
        email: "admin2@example.test",
        role: "admin",
        isActive: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        activeSessionCount: 1,
      },
    ]);
    const limit = vi.fn(() => ({ offset }));
    const orderBy = vi.fn(() => ({ limit }));
    const itemWhere = vi.fn(() => ({ orderBy }));
    const itemFrom = vi.fn(() => ({ where: itemWhere }));

    mockedDb.select
      .mockReturnValueOnce({ from: totalFrom } as never)
      .mockReturnValueOnce({ from: itemFrom } as never);

    await expect(listAdminUsersForUser(user("admin"), {
      role: "admin",
      search: " Admin ",
      page: 2,
      limit: 10,
    })).resolves.toMatchObject({
      total: 1,
      limit: 10,
      offset: 10,
      items: [
        {
          id: "admin-2",
          accountStatus: "active",
          activeSessionCount: 1,
        },
      ],
    });
    expect(totalWhere).toHaveBeenCalled();
    expect(itemWhere).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(10);
    expect(offset).toHaveBeenCalledWith(10);
  });

  it("defines status filters and default non-deleted filtering", () => {
    expect(buildAdminUsersListWhere(
      adminUsersListQuerySchema.parse({}),
    )).toBeDefined();
    expect(buildAdminUsersListWhere(
      adminUsersListQuerySchema.parse({ status: "active" }),
    )).toBeDefined();
    expect(buildAdminUsersListWhere(
      adminUsersListQuerySchema.parse({ status: "inactive" }),
    )).toBeDefined();
    expect(buildAdminUsersListWhere(
      adminUsersListQuerySchema.parse({ status: "deleted" }),
    )).toBeDefined();
    expect(buildAdminUsersListWhere(
      adminUsersListQuerySchema.parse({ status: "all" }),
    )).toBeUndefined();
    expect(buildAdminUsersListWhere(
      adminUsersListQuerySchema.parse({ status: "all", search: "alice" }),
    )).toBeDefined();
  });
});
