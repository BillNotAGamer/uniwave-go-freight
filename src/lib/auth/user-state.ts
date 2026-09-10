import type { User as DbUser } from "@/lib/db/schema";

export function rejectInactiveOrSoftDeletedUsers(
  user: DbUser | null | undefined,
): DbUser | null {
  if (!user || !user.isActive || user.deletedAt) {
    return null;
  }

  return user;
}
