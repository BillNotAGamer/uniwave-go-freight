export const ROLES = ["sale", "ops", "accountant", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  sale: "Sale",
  ops: "OPS",
  accountant: "Accountant",
  admin: "Admin",
} as const;

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
