export const ROLES = ["sale", "accountant", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  sale: "Sale",
  accountant: "Accountant",
  admin: "Admin",
} as const;

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
