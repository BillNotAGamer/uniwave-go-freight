import { z } from "zod";

import { PARTNER_CATEGORY_CODES } from "./constants";

function optionalTrimmedText(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().trim().max(maxLength).optional());
}

function optionalEmail(maxLength: number = 255) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : undefined;
  }, z.string().trim().email("Invalid email address.").max(maxLength).optional());
}

function optionalPhone(maxLength: number = 50) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().trim().max(maxLength).optional());
}

export const partnerContactInputSchema = z
  .object({
    picName: optionalTrimmedText(150),
    email: optionalEmail(255),
    phone: optionalPhone(50),
  })
  .refine(
    (data) => Boolean(data.picName || data.email || data.phone),
    {
      message: "At least one contact point (name, email, or phone) must be provided.",
    },
  );

export const createPartnerInputSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(255),
  vendorCode: optionalTrimmedText(100),
  address: optionalTrimmedText(500),
  taxId: optionalTrimmedText(100),
  isActive: z.boolean().optional().default(true),
  categoryCodes: z
    .array(z.enum(PARTNER_CATEGORY_CODES))
    .optional()
    .default([]),
  contacts: z
    .array(partnerContactInputSchema)
    .optional()
    .default([]),
});

export const updatePartnerInputSchema = z.object({
  id: z.string().trim().min(1, "Partner ID is required."),
  companyName: z.string().trim().min(1, "Company name is required.").max(255),
  vendorCode: optionalTrimmedText(100),
  address: optionalTrimmedText(500),
  taxId: optionalTrimmedText(100),
  isActive: z.boolean().optional(),
});

export const setPartnerCategoriesInputSchema = z.object({
  partnerId: z.string().trim().min(1, "Partner ID is required."),
  categoryCodes: z
    .array(z.enum(PARTNER_CATEGORY_CODES))
    .transform((codes) => Array.from(new Set(codes))),
});

export const createPartnerContactInputSchema = partnerContactInputSchema.and(
  z.object({
    partnerId: z.string().trim().min(1, "Partner ID is required."),
  }),
);

export const updatePartnerContactInputSchema = partnerContactInputSchema.and(
  z.object({
    id: z.string().trim().min(1, "Contact ID is required."),
  }),
);

export const softDeletePartnerInputSchema = z.object({
  id: z.string().trim().min(1, "Partner ID is required."),
});

export const restorePartnerInputSchema = z.object({
  id: z.string().trim().min(1, "Partner ID is required."),
});

export const softDeletePartnerContactInputSchema = z.object({
  id: z.string().trim().min(1, "Contact ID is required."),
});

export const listPartnersFilterSchema = z.object({
  activeOnly: z.boolean().optional().default(true),
  categoryCode: z.enum(PARTNER_CATEGORY_CODES).optional(),
  search: optionalTrimmedText(100),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export type PartnerContactInput = z.input<typeof partnerContactInputSchema>;
export type CreatePartnerInput = z.input<typeof createPartnerInputSchema>;
export type UpdatePartnerInput = z.input<typeof updatePartnerInputSchema>;
export type SetPartnerCategoriesInput = z.input<typeof setPartnerCategoriesInputSchema>;
export type CreatePartnerContactInput = z.input<typeof createPartnerContactInputSchema>;
export type UpdatePartnerContactInput = z.input<typeof updatePartnerContactInputSchema>;
export type SoftDeletePartnerInput = z.input<typeof softDeletePartnerInputSchema>;
export type RestorePartnerInput = z.input<typeof restorePartnerInputSchema>;
export type SoftDeletePartnerContactInput = z.input<typeof softDeletePartnerContactInputSchema>;
export type ListPartnersFilterInput = z.input<typeof listPartnersFilterSchema>;
