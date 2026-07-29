import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { taxRules, type User as DbUser } from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  requirePermission,
  requireAllPermissions,
} from "@/lib/permissions/require-permission";

import type { TaxRuleDetail } from "./types";

const taxRuleColumns = {
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

export async function listTaxRulesForUser(
  user: DbUser,
  options: { activeOnly?: boolean } = {},
): Promise<TaxRuleDetail[]> {
  const activeOnly = options.activeOnly ?? true;

  if (activeOnly) {
    requirePermission(user.role, PERMISSIONS.TAX_RULES_READ);
  } else {
    requireAllPermissions(user.role, [
      PERMISSIONS.TAX_RULES_READ,
      PERMISSIONS.TAX_RULES_MANAGE,
    ]);
  }

  const conditions = activeOnly ? [eq(taxRules.isActive, true)] : [];

  return db
    .select(taxRuleColumns)
    .from(taxRules)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      asc(taxRules.chargeSection),
      asc(taxRules.shippingMode),
      asc(taxRules.code),
    );
}
