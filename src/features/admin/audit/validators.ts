import { z } from "zod";

import {
  AUDIT_VIEWER_ENTITY_TYPES,
  AUDIT_VIEWER_KNOWN_ACTIONS,
} from "./types";
import {
  decodeAuditViewerCursor,
  type AuditViewerCursor,
} from "./cursor";

export const AUDIT_VIEWER_DEFAULT_LIMIT = 50;
export const AUDIT_VIEWER_MAX_LIMIT = 100;

function optionalUuid() {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().uuid().optional());
}

const dateTimeFilterSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}, z.date().optional());

const limitSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return AUDIT_VIEWER_DEFAULT_LIMIT;
  }

  return typeof value === "string" || typeof value === "number"
    ? Number(value)
    : value;
}, z.number().int().min(1).max(AUDIT_VIEWER_MAX_LIMIT))
  .default(AUDIT_VIEWER_DEFAULT_LIMIT);

const cursorSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return decodeAuditViewerCursor(value.trim());
}, z.custom<AuditViewerCursor>((value) => {
  return Boolean(
    value &&
    typeof value === "object" &&
    "createdAt" in value &&
    value.createdAt instanceof Date &&
    "id" in value &&
    typeof value.id === "string",
  );
}).optional());

export const auditViewerFilterSchema = z.object({
  action: z.enum(AUDIT_VIEWER_KNOWN_ACTIONS).optional(),
  entityType: z.enum(AUDIT_VIEWER_ENTITY_TYPES).optional(),
  entityId: optionalUuid(),
  actorId: optionalUuid(),
  from: dateTimeFilterSchema,
  to: dateTimeFilterSchema,
  cursor: cursorSchema,
  limit: limitSchema,
}).strict().refine((value) => {
  if (!value.from || !value.to) {
    return true;
  }

  return value.from.getTime() <= value.to.getTime();
}, {
  message: "`from` must be before or equal to `to`.",
  path: ["from"],
});

export type AuditViewerFilterInput = z.input<typeof auditViewerFilterSchema>;
export type AuditViewerFilters = z.output<typeof auditViewerFilterSchema>;
