import type { Role } from "@/lib/permissions/roles";
import type { User } from "@/lib/db/schema";

export const ADMIN_USER_ACCOUNT_STATUSES = [
  "active",
  "inactive",
  "deleted",
] as const;

export type AdminUserAccountStatus =
  (typeof ADMIN_USER_ACCOUNT_STATUSES)[number];

export const ADMIN_USER_STATUS_FILTERS = [
  ...ADMIN_USER_ACCOUNT_STATUSES,
  "all",
] as const;

export type AdminUserStatusFilter =
  (typeof ADMIN_USER_STATUS_FILTERS)[number];

export type AdminUserListQuery = {
  search?: string;
  role?: Role;
  status?: AdminUserStatusFilter;
  limit: number;
  offset: number;
  page?: number;
};

export type AdminUserListResult = {
  items: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminUserListItem = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "role"
  | "isActive"
  | "deletedAt"
  | "createdAt"
  | "updatedAt"
> & {
  accountStatus: AdminUserAccountStatus;
  activeSessionCount: number;
};

export const ADMIN_USER_OPERATION_TYPES = [
  "create",
  "role_change",
  "deactivate",
  "reactivate",
  "soft_delete",
  "password_reset",
  "manual_revoke_sessions",
] as const;

export type AdminUserOperationType =
  (typeof ADMIN_USER_OPERATION_TYPES)[number];
