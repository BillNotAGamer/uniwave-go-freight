import { z } from "zod";

import { normalizeVatPercent } from "./calculations";
import { parseAccountingVatRate } from "../accounting/vat";

export const assignChargeTaxRuleInputSchema = z.object({
  chargeId: z.string().trim().min(1),
  taxRuleId: z.string().trim().min(1),
});

export const overrideChargeVatPercentInputSchema = z
  .object({
    chargeId: z.string().trim().min(1),
    vatPercent: z.preprocess((value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "" || trimmed === "none") {
          return null;
        }
        return trimmed;
      }
      return value ?? null;
    }, z.union([
      z.null(),
      z.string().transform((value, context) => {
        const normalized = normalizeVatPercent(value);
        try {
          parseAccountingVatRate(normalized);
          return normalized;
        } catch {
          context.addIssue({
            code: "custom",
            message: "VAT override must be one of 0, 5, 8, or 10.",
          });
          return z.NEVER;
        }
      }),
    ])),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.vatPercent !== null &&
      (!data.reason || data.reason.trim().length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Reason is required when overriding VAT percentage.",
      });
    }
  });

export type AssignChargeTaxRuleInput = z.infer<
  typeof assignChargeTaxRuleInputSchema
>;

export type OverrideChargeVatPercentInput = z.infer<
  typeof overrideChargeVatPercentInputSchema
>;
