import type { InternalShippingNoteExportDto } from "./types";

export function formatUtcTimestamp(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const second = date.getUTCSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function sanitizeFilenamePart(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.+/g, ".")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_ .-]+|[_ .-]+$/g, "");

  return sanitized.slice(0, 72) || "shipping-note";
}

export function buildInternalXlsxFileName(
  exportData: InternalShippingNoteExportDto,
  generatedAt = new Date(),
): string {
  const jobsheetPart = sanitizeFilenamePart(exportData.note.jobsheetNo);
  const timestampPart = formatUtcTimestamp(generatedAt);

  return `ShippingNote_${jobsheetPart}_${timestampPart}.xlsx`;
}

export function buildInternalPdfFileName(
  exportData: InternalShippingNoteExportDto,
  generatedAt = new Date(),
): string {
  const jobsheetPart = sanitizeFilenamePart(exportData.note.jobsheetNo);
  const timestampPart = formatUtcTimestamp(generatedAt);

  return `ShippingNote_${jobsheetPart}_${timestampPart}.pdf`;
}
