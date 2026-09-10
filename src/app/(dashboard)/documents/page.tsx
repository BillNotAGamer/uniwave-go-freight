import Link from "next/link";
import { Download, FileText, Search } from "lucide-react";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SHIPPING_NOTE_DOCUMENT_TYPES,
  SHIPPING_NOTE_DOCUMENT_TYPE_LABELS,
  type ShippingNoteDocumentType,
} from "@/features/shipping-notes/documents/constants";
import { searchShippingNoteDocumentsForUser } from "@/features/shipping-notes/documents/queries";
import type { ShippingNoteStatus } from "@/features/shipping-notes/constants";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type SearchParams = Promise<{
  jobsheet?: string;
  type?: string;
}>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentLibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user } = await requireAuthenticatedUser();
  const { jobsheet, type } = await searchParams;

  const validDocumentType =
    type && SHIPPING_NOTE_DOCUMENT_TYPES.includes(type as ShippingNoteDocumentType)
      ? (type as ShippingNoteDocumentType)
      : undefined;

  const documents = await searchShippingNoteDocumentsForUser(
    {
      jobsheet: jobsheet?.trim() || undefined,
      documentType: validDocumentType,
      limit: 50,
    },
    user,
  );

  const hasActiveFilters = Boolean(jobsheet?.trim() || validDocumentType);

  return (
    <PageContainer>
      <PageHeader
        title="Document Library"
        description="Search and retrieve logistics documents across accessible shipments."
      />

      <div className="flex w-full flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Search & Filter Form */}
        <form
          method="GET"
          action="/documents"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="jobsheet-search"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Search by Shipment (Jobsheet No)
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                id="jobsheet-search"
                type="text"
                name="jobsheet"
                defaultValue={jobsheet ?? ""}
                placeholder="e.g. JS-2026-001..."
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="w-full sm:w-48">
            <label
              htmlFor="type-filter"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Document Category
            </label>
            <select
              id="type-filter"
              name="type"
              defaultValue={validDocumentType ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Categories</option>
              {SHIPPING_NOTE_DOCUMENT_TYPES.map((docType) => (
                <option key={docType} value={docType}>
                  {SHIPPING_NOTE_DOCUMENT_TYPE_LABELS[docType]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
            {hasActiveFilters ? (
              <Link
                href="/documents"
                className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {/* Results Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing {documents.length} {documents.length === 1 ? "document" : "documents"}
            {hasActiveFilters ? " matching filters" : ""}
          </div>
          <div>Result limit: 50</div>
        </div>

        {/* Results Table or Empty State */}
        {documents.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <h3 className="text-sm font-semibold text-foreground">
              {hasActiveFilters ? "No documents match current filters" : "No documents available"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your Jobsheet search term or document category filter."
                : "Attached shipment documents will appear here once uploaded."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Jobsheet No</th>
                  <th className="px-4 py-2.5">Shipment Status</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">File Name</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Uploaded</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={`/shipping-notes/${doc.shippingNoteId}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {doc.jobsheetNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.noteStatus as ShippingNoteStatus} />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {SHIPPING_NOTE_DOCUMENT_TYPE_LABELS[doc.documentType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[200px] sm:max-w-xs truncate">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-foreground" title={doc.originalFileName}>
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
                      <a
                        href={`/api/shipping-note-documents/${doc.id}/download`}
                        download={doc.originalFileName}
                        className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
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
      </div>
    </PageContainer>
  );
}
