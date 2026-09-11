import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import type { User as DbUser } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

export function canReadLocations(user: DbUser | null | undefined): boolean {
  const activeUser = rejectInactiveOrSoftDeletedUsers(user);
  return Boolean(activeUser && ["admin", "accountant", "sale"].includes(activeUser.role));
}

export function canMutateLocations(user: DbUser | null | undefined): boolean {
  return rejectInactiveOrSoftDeletedUsers(user)?.role === "admin";
}

export function assertCanReadLocations(user: DbUser | null | undefined): asserts user is DbUser {
  if (!canReadLocations(user)) throw new AuthorizationError("You do not have permission to view Locations.");
}

export function assertCanMutateLocations(user: DbUser | null | undefined): asserts user is DbUser {
  if (!canMutateLocations(user)) throw new AuthorizationError("You do not have permission to modify Locations.");
}
