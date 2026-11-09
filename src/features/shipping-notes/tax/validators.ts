import { z } from "zod";

import {
  assertTaxTreatmentPercentConsistency,
  normalizeVatPercent,
} from "./calculations";
import { parseAccountingVatRate } from "../accounting/vat";
import {
  INPUT_VAT_INVOICE_STATUSES,
  TAX_TREATMENTS,
} from "../constants";

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.string().max(200).nullable());

const inputVatEvidenceFields = {
  inputVatInvoiceStatus: z.enum(INPUT_VAT_INVOICE_STATUSES).nullable().default(null),
  inputVatInvoiceReference: optionalTrimmedString.default(null),
  inputVatDeductible: z.boolean().nullable().default(null),
};

export const assignChargeTaxRuleInputSchema = z.object({
  chargeId: z.string().trim().min(1),
  taxRuleId: z.string().trim().min(1),
  ...inputVatEvidenceFields,
});

export const manualChargeTaxDecisionInputSchema = z
  .object({
    chargeId: z.string().trim().min(1),
    taxTreatment: z.enum(TAX_TREATMENTS),
    vatPercent: z.string().transform((value, context) => {
      const normalized = normalizeVatPercent(value);
      try {
        parseAccountingVatRate(normalized);
        return normalized;
      } catch {
        context.addIssue({
          code: "custom",
          message: "VAT percentage must be one of 0, 5, 8, or 10.",
        });
        return z.NEVER;
      }
    }),
    reason: z.string().trim().min(1).max(500),
    expectedFinancialRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    ...inputVatEvidenceFields,
  })
  .superRefine((data, context) => {
    try {
      assertTaxTreatmentPercentConsistency(
        data.taxTreatment,
        data.vatPercent,
      );
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["vatPercent"],
        message: error instanceof Error
          ? error.message
          : "Invalid tax treatment and VAT percentage.",
      });
    }
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

const financialRevisionSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const requestMissingInvoiceExceptionInputSchema = z.object({
  chargeId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  expectedFinancialRevision: financialRevisionSchema,
});

export const decideMissingInvoiceExceptionInputSchema = z.object({
  exceptionId: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(1).max(500),
  expectedFinancialRevision: financialRevisionSchema,
});

export const revokeMissingInvoiceExceptionInputSchema = z.object({
  exceptionId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  expectedFinancialRevision: financialRevisionSchema,
});

export type AssignChargeTaxRuleInput = {
  chargeId: string;
  taxRuleId: string;
  inputVatInvoiceStatus?: "available" | "missing" | null;
  inputVatInvoiceReference?: string | null;
  inputVatDeductible?: boolean | null;
};

export type ManualChargeTaxDecisionInput = z.infer<
  typeof manualChargeTaxDecisionInputSchema
>;

export type OverrideChargeVatPercentInput = z.infer<
  typeof overrideChargeVatPercentInputSchema
>;

export type RequestMissingInvoiceExceptionInput = z.infer<
  typeof requestMissingInvoiceExceptionInputSchema
>;

export type DecideMissingInvoiceExceptionInput = z.infer<
  typeof decideMissingInvoiceExceptionInputSchema
>;

export type RevokeMissingInvoiceExceptionInput = z.infer<
  typeof revokeMissingInvoiceExceptionInputSchema
>;
