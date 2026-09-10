import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import type { User as DbUser } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

export function canReadPartners(user: DbUser | null | undefined): boolean {
  const activeUser = rejectInactiveOrSoftDeletedUsers(user);
  if (!activeUser) {
    return false;
  }

  return (
    activeUser.role === "admin" ||
    activeUser.role === "accountant" ||
    activeUser.role === "sale"
  );
}

export function canMutatePartners(user: DbUser | null | undefined): boolean {
  const activeUser = rejectInactiveOrSoftDeletedUsers(user);
  if (!activeUser) {
    return false;
  }

  return activeUser.role === "admin";
}

export function assertCanReadPartners(
  user: DbUser | null | undefined,
): asserts user is DbUser {
  if (!canReadPartners(user)) {
    throw new AuthorizationError("You do not have permission to view partners.");
  }
}

export function assertCanMutatePartners(
  user: DbUser | null | undefined,
): asserts user is DbUser {
  if (!canMutatePartners(user)) {
    throw new AuthorizationError("You do not have permission to modify partners.");
  }
}
