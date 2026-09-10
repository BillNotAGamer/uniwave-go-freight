import { z } from "zod";

export const SHIPPING_NOTE_LIST_MAX_JOBSHEET_LENGTH = 120;

export type ShippingNotesListFilters = {
  jobsheet?: string;
  etdFrom?: Date;
  etdToExclusive?: Date;
};

export type ShippingNotesListFilterFormValues = {
  jobsheet?: string;
  etdFrom?: string;
  etdTo?: string;
};

export type ShippingNotesListSearchParams = Record<
  string,
  string | string[] | undefined
>;

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const shippingNotesListFilterSchema = z.object({
  jobsheet: z.string().trim().max(SHIPPING_NOTE_LIST_MAX_JOBSHEET_LENGTH).optional(),
  etdFrom: z.string().regex(dateOnlyPattern).optional(),
  etdTo: z.string().regex(dateOnlyPattern).optional(),
});

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parseDateOnly(value: string): {
  year: number;
  monthIndex: number;
  day: number;
} | null {
  const match = dateOnlyPattern.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[0].slice(0, 4));
  const monthIndex = Number(match[0].slice(5, 7)) - 1;
  const day = Number(match[0].slice(8, 10));
  const candidate = new Date(Date.UTC(year, monthIndex, day));

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== monthIndex
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, monthIndex, day };
}

/**
 * The application already uses Asia/Ho_Chi_Minh (UTC+07) date-only boundaries
 * for URL-driven operational filters. Keep ETD filtering aligned with that
 * convention without changing timestamp persistence.
 */
function dateStartInApplicationTimezone(value: string): Date | null {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return null;
  }

  return new Date(
    Date.UTC(parsed.year, parsed.monthIndex, parsed.day, -7, 0, 0, 0),
  );
}

function dateAfterInApplicationTimezone(value: string): Date | null {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return null;
  }

  return new Date(
    Date.UTC(parsed.year, parsed.monthIndex, parsed.day + 1, -7, 0, 0, 0),
  );
}

export function parseShippingNotesListSearchParams(
  searchParams: ShippingNotesListSearchParams,
): {
  success: true;
  filters: ShippingNotesListFilters;
  formValues: ShippingNotesListFilterFormValues;
} | {
  success: false;
  formValues: ShippingNotesListFilterFormValues;
  error: string;
} {
  const formValues = {
    jobsheet: normalizeOptionalText(firstValue(searchParams.jobsheet)),
    etdFrom: normalizeOptionalText(firstValue(searchParams.etdFrom)),
    etdTo: normalizeOptionalText(firstValue(searchParams.etdTo)),
  };
  const parsed = shippingNotesListFilterSchema.safeParse(formValues);

  if (!parsed.success) {
    const hasOversizedJobsheet = parsed.error.issues.some(
      (issue) => issue.path[0] === "jobsheet" && issue.code === "too_big",
    );

    return {
      success: false,
      formValues,
      error: hasOversizedJobsheet
        ? `Jobsheet No must be at most ${SHIPPING_NOTE_LIST_MAX_JOBSHEET_LENGTH} characters.`
        : "ETD dates must use YYYY-MM-DD.",
    };
  }

  const etdFrom = parsed.data.etdFrom
    ? dateStartInApplicationTimezone(parsed.data.etdFrom)
    : undefined;
  const etdToExclusive = parsed.data.etdTo
    ? dateAfterInApplicationTimezone(parsed.data.etdTo)
    : undefined;

  if ((parsed.data.etdFrom && !etdFrom) || (parsed.data.etdTo && !etdToExclusive)) {
    return {
      success: false,
      formValues,
      error: "ETD dates must be valid calendar dates.",
    };
  }

  if (etdFrom && etdToExclusive && etdFrom >= etdToExclusive) {
    return {
      success: false,
      formValues,
      error: "ETD From must be on or before ETD To.",
    };
  }

  return {
    success: true,
    filters: {
      jobsheet: parsed.data.jobsheet,
      etdFrom: etdFrom ?? undefined,
      etdToExclusive: etdToExclusive ?? undefined,
    },
    formValues,
  };
}

export function buildShippingNotesListHref(
  formValues: ShippingNotesListFilterFormValues,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(formValues)) {
    const normalized = normalizeOptionalText(value);
    if (normalized) {
      params.set(key, normalized);
    }
  }

  const query = params.toString();
  return query ? `/shipping-notes?${query}` : "/shipping-notes";
}

