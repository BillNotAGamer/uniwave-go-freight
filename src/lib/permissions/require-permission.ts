import "server-only";

import type { Role } from "./roles";
import { hasPermission, type Permission } from "./permissions";

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requirePermission(
  role: Role | null | undefined,
  required: Permission | readonly Permission[],
): void {
  if (!role) {
    throw new AuthorizationError();
  }

  const requiredPermissions = Array.isArray(required) ? required : [required];

  if (requiredPermissions.some((permission) => hasPermission(role, permission))) {
    return;
  }

  throw new AuthorizationError();
}
