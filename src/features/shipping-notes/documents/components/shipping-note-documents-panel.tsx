"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Upload } from "lucide-react";

import {
  GENERAL_SHIPPING_NOTE_DOCUMENT_TYPES,
  SHIPPING_NOTE_DOCUMENT_TYPE_LABELS,
  type ShippingNoteDocumentType,
} from "../constants";
import type { ShippingNoteDocumentListItem } from "../types";

type ShippingNoteDocumentsPanelProps = {
  shippingNoteId: string;
  documents: ShippingNoteDocumentListItem[];
  canMutate: boolean;
  storageAvailable: boolean;
  fixedDocumentType?: ShippingNoteDocumentType;
  sectionTitle?: string;
  sectionEyebrow?: string;
  uploadLabel?: string;
  emptyMessage?: string;
};

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ShippingNoteDocumentsPanel({
  shippingNoteId,
  documents,
  canMutate,
  storageAvailable,
  fixedDocumentType,
  sectionTitle = "Documents",
  sectionEyebrow = "Supporting Materials",
  uploadLabel = "Upload document",
  emptyMessage = "No documents uploaded.",
}: ShippingNoteDocumentsPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const sectionIdPrefix = fixedDocumentType ? "customs" : "general";

  const [documentType, setDocumentType] =
    useState<ShippingNoteDocumentType>(
      fixedDocumentType ?? GENERAL_SHIPPING_NOTE_DOCUMENT_TYPES[0],
    );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadError(null);
    setUploadSuccess(false);

    if (file) {
      const parts = file.name.split(".");
      const ext = (parts.length > 1 ? parts.pop() : "")?.toLowerCase() ?? "";

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        setUploadError("Invalid file format. Allowed formats: PDF, JPG, PNG, WEBP.");
        setSelectedFile(null);
        e.target.value = "";
        return;
      }
    }

    setSelectedFile(file);
  }

  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("documentType", fixedDocumentType ?? documentType);
      formData.append("file", selectedFile);

      const response = await fetch(
        `/api/shipping-notes/${shippingNoteId}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "File rejected. Document upload failed.");
      }

      // Reset form and indicate success
      setSelectedFile(null);
      setUploadSuccess(true);
      const fileInput = document.getElementById(
        `${sectionIdPrefix}-document-file-input`,
      ) as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "File rejected. Document upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section aria-labelledby={`${sectionIdPrefix}-documents-section-title`} className="grid gap-6 border-t border-border pt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {sectionEyebrow}
          </p>
          <h2 id={`${sectionIdPrefix}-documents-section-title`} className="text-lg font-semibold tracking-tight text-foreground">
            {sectionTitle}
          </h2>
        </div>
        <div className="text-xs text-muted-foreground">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </div>
      </div>

      {uploadSuccess ? (
        <div
          role="status"
          className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          Upload successful.
        </div>
      ) : null}

      {uploadError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {uploadError}
        </div>
      ) : null}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5">File Name</th>
                <th scope="col" className="px-4 py-2.5">File Type</th>
                <th scope="col" className="px-4 py-2.5">File Size</th>
                <th scope="col" className="px-4 py-2.5">Uploaded By</th>
                <th scope="col" className="px-4 py-2.5">Uploaded At</th>
                <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2 max-w-[240px] sm:max-w-md truncate">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-foreground" title={doc.originalFileName}>
                        {doc.originalFileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {SHIPPING_NOTE_DOCUMENT_TYPE_LABELS[doc.documentType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatFileSize(doc.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {doc.uploadedByName || "Staff"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <a
                      href={`/api/shipping-notes/${shippingNoteId}/documents/${doc.id}/download`}
                      download={doc.originalFileName}
                      aria-label={`Download ${doc.originalFileName}`}
                      className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Document Form */}
      {canMutate ? (
        storageAvailable ? (
          <form
            onSubmit={handleUploadSubmit}
            aria-label="Upload document form"
            className="flex flex-col gap-4 rounded-md border border-border bg-muted/20 p-4"
          >
            <div className="text-sm font-medium text-foreground">{uploadLabel}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {fixedDocumentType ? null : (
              <div>
                <label
                  htmlFor="general-document-type-select"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Document Category
                </label>
                <select
                  id="general-document-type-select"
                  value={documentType}
                  onChange={(e) =>
                    setDocumentType(e.target.value as ShippingNoteDocumentType)
                  }
                  disabled={isUploading}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {GENERAL_SHIPPING_NOTE_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SHIPPING_NOTE_DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              )}

              <div className={fixedDocumentType ? "sm:col-span-3" : "sm:col-span-2"}>
                <label
                  htmlFor={`${sectionIdPrefix}-document-file-input`}
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  File (Allowed formats: PDF, JPG, PNG, WEBP — max 15 MB)
                </label>
                <input
                  id={`${sectionIdPrefix}-document-file-input`}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileSelection}
                  disabled={isUploading}
                  className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Upload className="h-3.5 w-3.5" />
                {isUploading ? "Uploading..." : uploadLabel}
              </button>
            </div>
          </form>
        ) : (
          <div role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            Document storage is currently unavailable (no storage provider configured).
          </div>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Document uploads are disabled because this shipping note is locked or cancelled.
        </p>
      )}
    </section>
  );
}
