"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";

import {
  SHIPPING_NOTE_DOCUMENT_TYPES,
  SHIPPING_NOTE_DOCUMENT_TYPE_LABELS,
  type ShippingNoteDocumentType,
} from "../constants";
import { removeShippingNoteDocumentAction } from "../actions";
import type { ShippingNoteDocumentListItem } from "../types";

type ShippingNoteDocumentsPanelProps = {
  shippingNoteId: string;
  documents: ShippingNoteDocumentListItem[];
  canMutate: boolean;
  storageAvailable: boolean;
};

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
}: ShippingNoteDocumentsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [documentType, setDocumentType] =
    useState<ShippingNoteDocumentType>("pre_alert_hbl");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("documentType", documentType);
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
        throw new Error(data.error || "Failed to upload document.");
      }

      // Reset form and refresh server state
      setSelectedFile(null);
      const fileInput = document.getElementById(
        "document-file-input",
      ) as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Document upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove(documentId: string, fileName: string) {
    if (!confirm(`Are you sure you want to remove "${fileName}"?`)) {
      return;
    }

    setRemoveError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", documentId);
      formData.append("shippingNoteId", shippingNoteId);

      const result = await removeShippingNoteDocumentAction(formData);
      if (!result.ok) {
        setRemoveError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <section className="grid gap-6 border-t border-border pt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Documents & Pre-alerts
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Attached Documents
          </h2>
        </div>
        <div className="text-xs text-muted-foreground">
          {documents.length} {documents.length === 1 ? "document" : "documents"} attached
        </div>
      </div>

      {uploadError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {uploadError}
        </div>
      ) : null}

      {removeError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {removeError}
        </div>
      ) : null}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No documents attached to this shipping note.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">File Name</th>
                <th className="px-4 py-2.5">Size</th>
                <th className="px-4 py-2.5">Uploaded</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {SHIPPING_NOTE_DOCUMENT_TYPE_LABELS[doc.documentType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 max-w-[240px] sm:max-w-md truncate">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-foreground" title={doc.originalFileName}>
                        {doc.originalFileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatFileSize(doc.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/shipping-note-documents/${doc.id}/download`}
                        download={doc.originalFileName}
                        className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                      {canMutate ? (
                        <button
                          type="button"
                          onClick={() => handleRemove(doc.id, doc.originalFileName)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-background px-2.5 py-1 text-xs font-medium text-destructive shadow-sm hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Form or Immutability Notice */}
      {canMutate ? (
        storageAvailable ? (
          <form
            onSubmit={handleUploadSubmit}
            className="flex flex-col gap-4 rounded-md border border-border bg-muted/20 p-4"
          >
            <div className="text-sm font-medium text-foreground">Upload Document</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="document-type-select"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Document Category
                </label>
                <select
                  id="document-type-select"
                  value={documentType}
                  onChange={(e) =>
                    setDocumentType(e.target.value as ShippingNoteDocumentType)
                  }
                  disabled={isUploading}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SHIPPING_NOTE_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SHIPPING_NOTE_DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="document-file-input"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  File (PDF, Word, Excel, Image — max 15 MB)
                </label>
                <input
                  id="document-file-input"
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  disabled={isUploading}
                  className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {isUploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            Document storage is currently unavailable (no storage provider configured).
          </div>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Document uploads and removal are disabled because this shipping note is closed or cancelled.
        </p>
      )}
    </section>
  );
}
