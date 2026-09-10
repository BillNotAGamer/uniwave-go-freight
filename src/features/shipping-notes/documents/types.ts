import type {
  ShippingNoteDocumentStorageProvider,
  ShippingNoteDocumentType,
} from "./constants";

export type ShippingNoteDocumentListItem = {
  id: string;
  shippingNoteId: string;
  documentType: ShippingNoteDocumentType;
  originalFileName: string;
  storageProvider: ShippingNoteDocumentStorageProvider;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: Date;
};

export type ShippingNoteDocumentDetail = ShippingNoteDocumentListItem & {
  storageKey: string;
  updatedAt: Date;
};

export type DocumentLibraryItem = ShippingNoteDocumentListItem & {
  jobsheetNo: string;
  noteStatus: string;
};
