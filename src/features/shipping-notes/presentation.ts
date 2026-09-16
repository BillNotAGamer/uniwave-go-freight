type MawbHawbValues = {
  mawbNo?: string | null;
  hawbNo?: string | null;
  mawbHawbNo?: string | null;
};

function formatPresentValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatMawbHawb({
  mawbNo,
  hawbNo,
  mawbHawbNo,
}: MawbHawbValues): string {
  const modernValues = [
    formatPresentValue(mawbNo),
    formatPresentValue(hawbNo),
  ].filter((value): value is string => value !== null);

  return modernValues.join(" / ") || formatPresentValue(mawbHawbNo) || "-";
}

export function formatDetailValue(value: string | number | null | undefined): string {
  return value === null || value === undefined || (typeof value === "string" && !value.trim())
    ? "-"
    : String(value);
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatDetailDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) {
    return "-";
  }

  // Drizzle maps timestamp-without-time-zone fields into UTC-backed Dates.
  // Read those components directly; host-local getters would shift the stored wall clock.
  const date = typeof value === "string"
    ? new Date(/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(value)
      ? `${value.replace(" ", "T")}Z`
      : value)
    : value;
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = SHORT_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}
