import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { users, type User } from "@/lib/db/schema";
import type { Role } from "@/lib/permissions/roles";

import { db } from "../setup/database";
import { toEmailToken } from "../helpers/run-id";

export type IntegrationActors = {
  saleA: User;
  saleB: User;
  accountant: User;
  admin: User;
  inactiveSale: User;
  deletedSale: User;
};

export async function createIntegrationUser(input: {
  runId: string;
  label: string;
  role: Role;
  isActive?: boolean;
  deleted?: boolean;
}): Promise<User> {
  const token = toEmailToken(input.runId);
  const email = `${input.label}.${token}@integration.test`;

  const [created] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email,
      name: `${input.label} ${input.runId}`,
      role: input.role,
      isActive: input.isActive ?? true,
      deletedAt: input.deleted ? new Date() : null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create integration user.");
  }

  return created;
}

export async function createIntegrationActors(
  runId: string,
): Promise<IntegrationActors> {
  const [saleA, saleB, accountant, admin, inactiveSale, deletedSale] =
    await Promise.all([
      createIntegrationUser({ runId, label: "sale-a", role: "sale" }),
      createIntegrationUser({ runId, label: "sale-b", role: "sale" }),
      createIntegrationUser({ runId, label: "accountant", role: "accountant" }),
      createIntegrationUser({ runId, label: "admin", role: "admin" }),
      createIntegrationUser({
        runId,
        label: "inactive-sale",
        role: "sale",
        isActive: false,
      }),
      createIntegrationUser({
        runId,
        label: "deleted-sale",
        role: "sale",
        deleted: true,
      }),
    ]);

  return {
    saleA,
    saleB,
    accountant,
    admin,
    inactiveSale,
    deletedSale,
  };
}

export async function reloadUser(id: string): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  if (!user) {
    throw new Error("Expected integration user to exist.");
  }

  return user;
}
