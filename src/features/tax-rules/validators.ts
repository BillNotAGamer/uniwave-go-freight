import { z } from "zod";

import {
  CHARGE_SECTIONS,
  SHIPPING_MODES,
  TAX_TREATMENTS,
} from "@/features/shipping-notes/constants";
import {
  assertTaxTreatmentPercentConsistency,
  normalizeVatPercent,
} from "@/features/shipping-notes/tax/calculations";

function optionalTrimmedText(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().trim().max(maxLength).optional());
}

function optionalDatetime() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed;
    }

    return value;
  }, z.date().optional());
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

const taxRuleBaseSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform(normalizeCode)
      .refine((value) => /^[A-Z0-9][A-Z0-9_-]*$/.test(value), {
        message:
          "Tax rule code may contain uppercase letters, numbers, underscores, and hyphens.",
      }),
    name: z.string().trim().min(1).max(120),
    description: optionalTrimmedText(500),
    shippingMode: z.enum(SHIPPING_MODES),
    chargeSection: z.enum(CHARGE_SECTIONS),
    chargeNamePattern: z.string().trim().min(1).max(120),
    taxTreatment: z.enum(TAX_TREATMENTS),
    vatPercent: z.preprocess((value) => {
      if (typeof value === "string") {
        return value.trim();
      }

      return value;
    }, z.string().transform((value) => normalizeVatPercent(value))),
    effectiveFrom: optionalDatetime(),
    effectiveTo: optionalDatetime(),
  })
  .superRefine((value, ctx) => {
    try {
      assertTaxTreatmentPercentConsistency(value.taxTreatment, value.vatPercent);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["vatPercent"],
        message:
          error instanceof Error
            ? error.message
            : "Invalid VAT percentage for tax treatment.",
      });
    }

    if (
      value.effectiveFrom &&
      value.effectiveTo &&
      value.effectiveTo < value.effectiveFrom
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective To must be on or after Effective From.",
      });
    }
  });

export const createTaxRuleInputSchema = taxRuleBaseSchema;

export const updateTaxRuleInputSchema = taxRuleBaseSchema.extend({
  id: z.string().trim().min(1),
});

export const deactivateTaxRuleInputSchema = z.object({
  id: z.string().trim().min(1),
});

export type CreateTaxRuleInput = z.infer<typeof createTaxRuleInputSchema>;
export type UpdateTaxRuleInput = z.infer<typeof updateTaxRuleInputSchema>;
export type DeactivateTaxRuleInput = z.infer<typeof deactivateTaxRuleInputSchema>;
