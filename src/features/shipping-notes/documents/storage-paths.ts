import { randomUUID } from "node:crypto";

import { extractFileExtension } from "./file-security";

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

/**
 * Derives a server-generated R2 object key:
 * `shipping-notes/<shipping-note-id>/documents/<document-id>/<uuid>.<ext>`
 *
 * User original filename is NEVER part of the storage key; only the validated extension is kept.
 */
export function buildDocumentR2Key(input: {
  shippingNoteId: string;
  originalFileName: string;
  documentId?: string;
  uniqueId?: string;
  now?: Date;
}): string {
  const unique = input.uniqueId ?? randomUUID();
  const docId = input.documentId
    ? sanitizeSegmentForStorage(input.documentId)
    : unique;
  const safeNoteId = sanitizeSegmentForStorage(input.shippingNoteId);
  const ext = extractFileExtension(input.originalFileName) || "bin";

  const key = `shipping-notes/${safeNoteId}/documents/${docId}/${unique}.${ext}`;

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
