import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  shippingNoteCharges,
  taxRules,
  type User as DbUser,
} from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/permissions/require-permission";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";

import type { TaxRuleDetail } from "./types";
import type {
  CreateTaxRuleInput,
  HardDeleteTaxRuleInput,
  UpdateTaxRuleInput,
} from "./validators";
import { hardDeleteTaxRuleInputSchema } from "./validators";

const taxRuleReturnColumns = {
  id: taxRules.id,
  code: taxRules.code,
  name: taxRules.name,
  description: taxRules.description,
  shippingMode: taxRules.shippingMode,
  chargeSection: taxRules.chargeSection,
  chargeNamePattern: taxRules.chargeNamePattern,
  taxTreatment: taxRules.taxTreatment,
  vatPercent: taxRules.vatPercent,
  isActive: taxRules.isActive,
  effectiveFrom: taxRules.effectiveFrom,
  effectiveTo: taxRules.effectiveTo,
  createdAt: taxRules.createdAt,
  updatedAt: taxRules.updatedAt,
} as const;

function requireActiveActor(user: DbUser): void {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }
}

async function assertTaxRuleCodeIsUnique(
  code: string,
  excludeId?: string,
): Promise<void> {
  const conditions = [eq(taxRules.code, code)];

  if (excludeId) {
    conditions.push(ne(taxRules.id, excludeId));
  }

  const existing = await db
    .select({ id: taxRules.id })
    .from(taxRules)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Tax rule code already exists.");
  }
}

export async function createTaxRule(
  input: CreateTaxRuleInput,
  user: DbUser,
): Promise<TaxRuleDetail> {
  requireActiveActor(user);
  requirePermission(user.role, PERMISSIONS.TAX_RULES_MANAGE);
  await assertTaxRuleCodeIsUnique(input.code);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(taxRules)
      .values({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        shippingMode: input.shippingMode,
        chargeSection: input.chargeSection,
        chargeNamePattern: input.chargeNamePattern,
        taxTreatment: input.taxTreatment,
        vatPercent: input.vatPercent,
        isActive: true,
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        createdById: user.id,
      })
      .returning(taxRuleReturnColumns);

    if (!created) {
      throw new Error("Failed to create tax rule.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "tax_rule.create",
      entityType: "tax_rule",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

export async function updateTaxRule(
  id: string,
  input: UpdateTaxRuleInput,
  user: DbUser,
): Promise<TaxRuleDetail> {
  requireActiveActor(user);
  requirePermission(user.role, PERMISSIONS.TAX_RULES_MANAGE);
  await assertTaxRuleCodeIsUnique(input.code, id);

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(taxRuleReturnColumns)
      .from(taxRules)
      .where(eq(taxRules.id, id))
      .limit(1);

    if (!current) {
      throw new Error("Tax rule was not found.");
    }

    const [updated] = await tx
      .update(taxRules)
      .set({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        shippingMode: input.shippingMode,
        chargeSection: input.chargeSection,
        chargeNamePattern: input.chargeNamePattern,
        taxTreatment: input.taxTreatment,
        vatPercent: input.vatPercent,
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
      })
      .where(eq(taxRules.id, id))
      .returning(taxRuleReturnColumns);

    if (!updated) {
      throw new Error("Failed to update tax rule.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "tax_rule.update",
      entityType: "tax_rule",
      entityId: updated.id,
      before: current,
      after: updated,
    });

    return updated;
  });
}

export async function deactivateTaxRule(
  id: string,
  user: DbUser,
): Promise<TaxRuleDetail> {
  requireActiveActor(user);
  requirePermission(user.role, PERMISSIONS.TAX_RULES_MANAGE);

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(taxRuleReturnColumns)
      .from(taxRules)
      .where(eq(taxRules.id, id))
      .limit(1);

    if (!current) {
      throw new Error("Tax rule was not found.");
    }

    const [updated] = await tx
      .update(taxRules)
      .set({ isActive: false })
      .where(eq(taxRules.id, id))
      .returning(taxRuleReturnColumns);

    if (!updated) {
      throw new Error("Failed to deactivate tax rule.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "tax_rule.deactivate",
      entityType: "tax_rule",
      entityId: updated.id,
      before: current,
      after: updated,
    });

    return updated;
  });
}

/**
 * Tax charge snapshots preserve historical tax values. The nullable FK is
 * cleared before deleting the master rule so PostgreSQL's restrict constraint
 * cannot prevent the requested hard delete.
 */
export async function hardDeleteTaxRule(
  input: HardDeleteTaxRuleInput,
  user: DbUser,
): Promise<void> {
  requireActiveActor(user);
  requirePermission(user.role, PERMISSIONS.TAX_RULES_MANAGE);
  const normalized = hardDeleteTaxRuleInputSchema.parse(input);

  try {
    await db.transaction(async (tx) => {
    const [current] = await tx
      .select(taxRuleReturnColumns)
      .from(taxRules)
      .where(eq(taxRules.id, normalized.id))
      .limit(1);

    if (!current) {
      throw new Error("Tax rule was not found.");
    }

    await tx
      .update(shippingNoteCharges)
      .set({ taxRuleId: null })
      .where(eq(shippingNoteCharges.taxRuleId, current.id));

    const [deleted] = await tx
      .delete(taxRules)
      .where(eq(taxRules.id, current.id))
      .returning({ id: taxRules.id });

    if (!deleted) {
      throw new Error("Failed to delete tax rule.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "tax_rule.hard_delete",
      entityType: "tax_rule",
      entityId: deleted.id,
      before: { code: current.code, name: current.name },
      reason: normalized.reason,
    });
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }
    throw new Error("Tax Rule deletion failed.");
  }
}
