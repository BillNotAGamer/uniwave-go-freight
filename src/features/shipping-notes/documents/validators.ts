import { z } from "zod";

import {
  SHIPPING_NOTE_DOCUMENT_STORAGE_PROVIDERS,
  SHIPPING_NOTE_DOCUMENT_TYPES,
} from "./constants";

export const registerShippingNoteDocumentInputSchema = z.object({
  shippingNoteId: z.string().trim().min(1, "Shipping note ID is required"),
  documentType: z.enum(SHIPPING_NOTE_DOCUMENT_TYPES),
  originalFileName: z
    .string()
    .trim()
    .min(1, "Original file name is required")
    .max(255, "Original file name is too long"),
  storageProvider: z.enum(SHIPPING_NOTE_DOCUMENT_STORAGE_PROVIDERS),
  storageKey: z
    .string()
    .trim()
    .min(1, "Storage key is required")
    .max(1024, "Storage key is too long")
    .refine(
      (val) => !val.includes(".."),
      "Storage key cannot contain directory traversal",
    ),
  mimeType: z
    .string()
    .trim()
    .min(1, "MIME type is required")
    .max(128, "MIME type is too long"),
  sizeBytes: z
    .number()
    .int("File size must be an integer")
    .min(0, "File size must be non-negative"),
});

export type RegisterShippingNoteDocumentInput = z.infer<
  typeof registerShippingNoteDocumentInputSchema
>;

export const removeShippingNoteDocumentInputSchema = z.object({
  id: z.string().trim().min(1, "Document ID is required"),
  shippingNoteId: z.string().trim().min(1, "Shipping note ID is required"),
});

export type RemoveShippingNoteDocumentInput = z.infer<
  typeof removeShippingNoteDocumentInputSchema
>;
