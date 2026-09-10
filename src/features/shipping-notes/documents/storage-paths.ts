import { randomUUID } from "node:crypto";

export function sanitizeFileNameForStorage(fileName: string): string {
  // Normalize and preserve safe base name and extension
  const trimmed = fileName.trim();
  // Strip dangerous characters, keep alphanumeric, dots, hyphens, and underscores
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Prevent leading dot or multiple consecutive dots that could look like traversal
  const safeName = sanitized.replace(/^\.+/, "").replace(/\.{2,}/g, ".");
  return safeName.slice(0, 100) || "document";
}

export function sanitizeSegmentForStorage(segment: string): string {
  const sanitized = segment.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized.slice(0, 100) || "shipment";
}

export function buildDocumentR2Key(input: {
  shippingNoteId: string;
  originalFileName: string;
  now?: Date;
  uniqueId?: string;
}): string {
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear().toString();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const unique = input.uniqueId ?? randomUUID();
  const safeFileName = sanitizeFileNameForStorage(input.originalFileName);
  const safeNoteId = sanitizeSegmentForStorage(input.shippingNoteId);

  const key = `shipping-note-documents/${year}/${month}/${safeNoteId}/${unique}-${safeFileName}`;

  if (key.includes("..")) {
    throw new Error("Generated storage key contains invalid directory traversal sequences.");
  }

  if (key.length > 1024) {
    throw new Error("Generated storage key exceeds maximum permitted length.");
  }

  return key;
}

export function getDocumentYearMonth(now: Date = new Date()): {
  year: string;
  month: string;
} {
  return {
    year: now.getUTCFullYear().toString(),
    month: String(now.getUTCMonth() + 1).padStart(2, "0"),
  };
}
