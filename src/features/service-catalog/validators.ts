import { z } from "zod";

import {
  CONVERSION_OPERATIONS,
  SERVICE_CATALOG_NATURES,
  SERVICE_CATALOG_SOURCE_VAT_RATES,
  SERVICE_CATALOG_VAT_RATES,
} from "./constants";

const nullableTrimmedText = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value !== "string") return value;
      const normalized = value.trim().replace(/\s+/g, " ");
      return normalized || null;
    },
    z.string().max(maxLength).nullable(),
  );

export const serviceCatalogVatRateSchema = z
  .number()
  .refine(
    (value) =>
      SERVICE_CATALOG_VAT_RATES.includes(
        value as (typeof SERVICE_CATALOG_VAT_RATES)[number],
      ),
    "VAT rate is outside the supported application domain.",
  )
  .nullable();

export const sourceCatalogVatRateSchema = z
  .number()
  .refine(
    (value) =>
      SERVICE_CATALOG_SOURCE_VAT_RATES.includes(
        value as (typeof SERVICE_CATALOG_SOURCE_VAT_RATES)[number],
      ),
    "VAT rate is not accepted by the Service Catalog source contract.",
  )
  .nullable();

export const canonicalServiceCatalogItemSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(255),
  nature: z.enum(SERVICE_CATALOG_NATURES),
  primaryUnit: nullableTrimmedText(80),
  vatRate: sourceCatalogVatRateSchema,
  isActive: z.literal(true),
  sourceRows: z.array(z.number().int().positive()).min(1),
});

export const canonicalUnitConversionSchema = z.object({
  itemCode: z.string().trim().min(1).max(80),
  convertedUnit: z.string().trim().min(1).max(80),
  conversionFactor: z
    .string()
    .regex(/^\d+(?:\.\d+)?$/)
    .refine((value) => Number(value) > 0, "Conversion factor must be positive."),
  operation: z.enum(CONVERSION_OPERATIONS),
  sourceDescription: nullableTrimmedText(500),
  sourceRows: z.array(z.number().int().positive()).min(1),
});
