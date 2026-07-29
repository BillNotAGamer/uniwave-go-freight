import { z } from "zod";

import { normalizeVatPercent } from "./calculations";

export const assignChargeTaxRuleInputSchema = z.object({
  chargeId: z.string().trim().min(1),
  taxRuleId: z.string().trim().min(1),
});

export const overrideChargeVatPercentInputSchema = z.object({
  chargeId: z.string().trim().min(1),
  vatPercent: z.preprocess((value) => {
    if (typeof value === "string") {
      return value.trim();
    }

    return value;
  }, z.string().transform((value) => normalizeVatPercent(value))),
  reason: z.string().trim().min(1).max(500),
});

export type AssignChargeTaxRuleInput = z.infer<
  typeof assignChargeTaxRuleInputSchema
>;

export type OverrideChargeVatPercentInput = z.infer<
  typeof overrideChargeVatPercentInputSchema
>;
