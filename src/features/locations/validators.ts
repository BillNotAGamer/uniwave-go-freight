import { z } from "zod";

import {
  ROUTING_LOCATION_APPLICABILITIES,
  ROUTING_LOCATION_LIFECYCLE_STATUSES,
  ROUTING_LOCATION_TYPES,
} from "./constants";

function optionalNormalizedText(maxLength: number, normalize?: (value: string) => string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? normalize ? normalize(trimmed) : trimmed : undefined;
  }, z.string().max(maxLength).optional());
}

const applicabilitySchema = z.array(z.enum(ROUTING_LOCATION_APPLICABILITIES))
  .min(1, "At least one routing applicability is required.")
  .superRefine((values, ctx) => {
    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate routing applicability values are not allowed." });
    }
  });

const locationFieldsSchema = z.object({
  code: z.string().trim().min(1, "Location code is required.").max(50).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Location name is required.").max(255),
  type: z.enum(ROUTING_LOCATION_TYPES),
  countryCode: optionalNormalizedText(32, (value) => value.toUpperCase()),
  subdivision: optionalNormalizedText(255),
  applicabilities: applicabilitySchema,
});

export const createRoutingLocationInputSchema = locationFieldsSchema;

export const updateRoutingLocationInputSchema = locationFieldsSchema.extend({
  id: z.string().trim().min(1, "Location ID is required."),
});

export const routingLocationIdInputSchema = z.object({
  id: z.string().trim().min(1, "Location ID is required."),
});

export const listRoutingLocationsFilterSchema = z.object({
  search: optionalNormalizedText(100),
  type: z.enum(ROUTING_LOCATION_TYPES).optional(),
  status: z.enum(ROUTING_LOCATION_LIFECYCLE_STATUSES).optional().default("active"),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const searchRoutingLocationsInputSchema = z.object({
  search: z.string().trim().min(1).max(100),
  applicability: z.enum(ROUTING_LOCATION_APPLICABILITIES).optional(),
  type: z.enum(ROUTING_LOCATION_TYPES).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreateRoutingLocationInput = z.input<typeof createRoutingLocationInputSchema>;
export type UpdateRoutingLocationInput = z.input<typeof updateRoutingLocationInputSchema>;
