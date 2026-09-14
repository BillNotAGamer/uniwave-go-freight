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
