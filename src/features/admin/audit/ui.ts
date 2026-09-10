import {
  AUDIT_VIEWER_ACTION_CATALOG,
} from "./presentation";
import {
  AUDIT_VIEWER_ENTITY_TYPES,
  AUDIT_VIEWER_KNOWN_ACTIONS,
  type AuditViewerEntityType,
} from "./types";
import {
  auditViewerFilterSchema,
  type AuditViewerFilters,
} from "./validators";

export type AuditViewerSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type AuditViewerFilterFormValues = {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
};

export const AUDIT_VIEWER_ACTION_OPTIONS = AUDIT_VIEWER_KNOWN_ACTIONS.map(
  (action) => ({
    value: action,
    label: AUDIT_VIEWER_ACTION_CATALOG[action].label,
  }),
);

export const AUDIT_VIEWER_ENTITY_TYPE_OPTIONS = AUDIT_VIEWER_ENTITY_TYPES.map(
  (entityType) => ({
    value: entityType,
    label: formatEntityTypeLabel(entityType),
  }),
);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function formatEntityTypeLabel(entityType: AuditViewerEntityType): string {
  return entityType
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function parseDateOnly(value: string | undefined): {
  year: number;
  monthIndex: number;
  day: number;
} | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    monthIndex: month - 1,
    day,
  };
}

function auditDateStartUtc(value: string | undefined): string | undefined {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return value ? "invalid-date" : undefined;
  }

  return new Date(
    Date.UTC(parsed.year, parsed.monthIndex, parsed.day, -7, 0, 0, 0),
  ).toISOString();
}

function auditDateEndUtc(value: string | undefined): string | undefined {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return value ? "invalid-date" : undefined;
  }

  return new Date(
    Date.UTC(parsed.year, parsed.monthIndex, parsed.day + 1, -7, 0, 0, -1),
  ).toISOString();
}

export function parseAuditViewerPageSearchParams(
  searchParams: AuditViewerSearchParams,
): {
  success: true;
  filters: AuditViewerFilters;
  formValues: AuditViewerFilterFormValues;
} | {
  success: false;
} {
  const formValues = {
    action: normalizeOptionalText(firstValue(searchParams.action)),
    entityType: normalizeOptionalText(firstValue(searchParams.entityType)),
    entityId: normalizeOptionalText(firstValue(searchParams.entityId)),
    actorId: normalizeOptionalText(firstValue(searchParams.actorId)),
    from: normalizeOptionalText(firstValue(searchParams.from)),
    to: normalizeOptionalText(firstValue(searchParams.to)),
  };
  const parsed = auditViewerFilterSchema.safeParse({
    action: formValues.action,
    entityType: formValues.entityType,
    entityId: formValues.entityId,
    actorId: formValues.actorId,
    from: auditDateStartUtc(formValues.from),
    to: auditDateEndUtc(formValues.to),
    cursor: firstValue(searchParams.cursor),
  });

  if (!parsed.success) {
    return { success: false };
  }

  return {
    success: true,
    filters: parsed.data,
    formValues,
  };
}

export function buildAuditViewerHref(input: {
  formValues: AuditViewerFilterFormValues;
  cursor?: string | null;
}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input.formValues)) {
    const normalized = normalizeOptionalText(value);

    if (normalized) {
      params.set(key, normalized);
    }
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  const query = params.toString();

  return query ? `/admin/audit?${query}` : "/admin/audit";
}

export function buildAuditViewerFilterHref(
  formValues: AuditViewerFilterFormValues,
): string {
  return buildAuditViewerHref({ formValues });
}
