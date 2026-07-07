import { z } from "zod";
import {
  type DecimalMinimum,
  validateDecimalString,
} from "@/lib/calculations/decimal";

import {
  CURRENCY_CODES,
  SHIPPING_MODES,
  VOLUME_UNITS,
} from "./constants";

function optionalTrimmedText() {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().trim().min(1));
}

function optionalTrimmedTextWithMax(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().trim().min(1).max(maxLength));
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

function optionalPositiveNumber() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return typeof value === "string" || typeof value === "number"
      ? Number(value)
      : value;
  }, z.number().positive().optional());
}

type ChargeDecimalFieldOptions = {
  scale: number;
  maxIntegerDigits: number;
  minimum: DecimalMinimum;
};

function chargeDecimalStringField(options: ChargeDecimalFieldOptions) {
  return z.preprocess((value) => {
    if (typeof value === "string") {
      return value.trim();
    }

    return value;
  }, z.string().superRefine((value, ctx) => {
    try {
      validateDecimalString(value, options);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message:
          error instanceof Error ? error.message : "Invalid decimal value.",
      });
    }
  }).transform((value) => validateDecimalString(value, options)));
}

function optionalChargeDecimalStringField(options: ChargeDecimalFieldOptions) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    return value;
  }, chargeDecimalStringField(options).optional());
}

const chargeQuantitySchema = chargeDecimalStringField({
  scale: 3,
  maxIntegerDigits: 15,
  minimum: "positive",
});
const chargeUnitPriceSchema = chargeDecimalStringField({
  scale: 4,
  maxIntegerDigits: 14,
  minimum: "nonNegative",
});
const chargeExchangeRateSchema = optionalChargeDecimalStringField({
  scale: 6,
  maxIntegerDigits: 12,
  minimum: "positive",
});

function normalizeJobsheetNo(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

const shippingModeSchema = z.enum(SHIPPING_MODES);
const volumeUnitSchema = z.enum(VOLUME_UNITS);
export const shippingNoteDraftInputSchema = z.object({
  jobsheetNo: z.string().trim().min(1).transform(normalizeJobsheetNo),
  shippingMode: shippingModeSchema,
  mawbHawbNo: optionalTrimmedText().optional(),
  shipperText: optionalTrimmedText().optional(),
  consigneeText: optionalTrimmedText().optional(),
  customerText: optionalTrimmedText().optional(),
  agentText: optionalTrimmedText().optional(),
  aol: optionalTrimmedText().optional(),
  aod: optionalTrimmedText().optional(),
  finalDestination: optionalTrimmedText().optional(),
  etd: optionalDatetime().optional(),
  eta: optionalDatetime().optional(),
  volumeValue: optionalPositiveNumber().optional(),
  volumeUnit: volumeUnitSchema.optional(),
  exchangeRate: optionalPositiveNumber().optional(),
});

export const createShippingNoteDraftInputSchema = shippingNoteDraftInputSchema;

export const updateShippingNoteDraftInputSchema =
  shippingNoteDraftInputSchema.extend({
    id: z.string().trim().min(1),
  });

export const submitShippingNoteInputSchema = z.object({
  id: z.string().trim().min(1),
});

export type ShippingNoteDraftInput = z.infer<typeof shippingNoteDraftInputSchema>;
export type CreateShippingNoteDraftInput = z.infer<
  typeof createShippingNoteDraftInputSchema
>;
export type UpdateShippingNoteDraftInput = z.infer<
  typeof updateShippingNoteDraftInputSchema
>;
export type SubmitShippingNoteInput = z.infer<typeof submitShippingNoteInputSchema>;

// ---------------------------------------------------------------------------
// Selling charge validators
// ---------------------------------------------------------------------------

const currencySchema = z.enum(CURRENCY_CODES);

export const createSellingChargeInputSchema = z
  .object({
    shippingNoteId: z.string().trim().min(1),
    chargeName: z.string().trim().min(1),
    description: optionalTrimmedText().optional(),
    quantity: chargeQuantitySchema,
    unit: z.string().trim().min(1),
    unitPrice: chargeUnitPriceSchema,
    currency: currencySchema,
    exchangeRate: chargeExchangeRateSchema,
  })
  .refine(
    (data) =>
      data.currency !== "USD" ||
      data.exchangeRate !== undefined,
    {
      message:
        "Exchange rate is required and must be a positive decimal value for USD charges.",
      path: ["exchangeRate"],
    },
  );

export const updateSellingChargeInputSchema = z
  .object({
    id: z.string().trim().min(1),
    chargeName: z.string().trim().min(1),
    description: optionalTrimmedText().optional(),
    quantity: chargeQuantitySchema,
    unit: z.string().trim().min(1),
    unitPrice: chargeUnitPriceSchema,
    currency: currencySchema,
    exchangeRate: chargeExchangeRateSchema,
  })
  .refine(
    (data) =>
      data.currency !== "USD" ||
      data.exchangeRate !== undefined,
    {
      message:
        "Exchange rate is required and must be a positive decimal value for USD charges.",
      path: ["exchangeRate"],
    },
  );

export const deleteSellingChargeInputSchema = z.object({
  id: z.string().trim().min(1),
  shippingNoteId: z.string().trim().min(1),
});

export type CreateSellingChargeInput = z.infer<typeof createSellingChargeInputSchema>;
export type UpdateSellingChargeInput = z.infer<typeof updateSellingChargeInputSchema>;
export type DeleteSellingChargeInput = z.infer<typeof deleteSellingChargeInputSchema>;

// ---------------------------------------------------------------------------
// Buying charge validators
// ---------------------------------------------------------------------------

const vendorOrAgentTextSchema = optionalTrimmedTextWithMax(200).optional();

const buyingChargeBaseInputSchema = z
  .object({
    chargeName: z.string().trim().min(1),
    description: optionalTrimmedText().optional(),
    quantity: chargeQuantitySchema,
    unit: z.string().trim().min(1),
    unitPrice: chargeUnitPriceSchema,
    currency: currencySchema,
    exchangeRate: chargeExchangeRateSchema,
    vendorOrAgentText: vendorOrAgentTextSchema,
  })
  .refine(
    (data) =>
      data.currency !== "USD" ||
      data.exchangeRate !== undefined,
    {
      message:
        "Exchange rate is required and must be a positive decimal value for USD charges.",
      path: ["exchangeRate"],
    },
  );

export const createBuyingChargeInputSchema = buyingChargeBaseInputSchema.extend({
  shippingNoteId: z.string().trim().min(1),
});

export const updateBuyingChargeInputSchema = buyingChargeBaseInputSchema.extend({
  id: z.string().trim().min(1),
});

export const deleteBuyingChargeInputSchema = z.object({
  id: z.string().trim().min(1),
});

export type CreateBuyingChargeInput = z.infer<typeof createBuyingChargeInputSchema>;
export type UpdateBuyingChargeInput = z.infer<typeof updateBuyingChargeInputSchema>;
export type DeleteBuyingChargeInput = z.infer<typeof deleteBuyingChargeInputSchema>;
