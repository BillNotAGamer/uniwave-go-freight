"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, ExternalLink, RefreshCw, UploadCloud } from "lucide-react";

import type { Role } from "@/lib/permissions/roles";
import type { ExportHistoryItem } from "../export/history";
import {
  canDownloadHistoricalArtifact,
  getDriveHistoryAction,
} from "../export/history-ui-policy";

type ExportHistoryPanelProps = {
  rows: ExportHistoryItem[];
  viewerRole: Role;
};

function formatDateTime(value: Date | string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatType(type: ExportHistoryItem["exportType"]): string {
  return type === "excel" ? "XLSX" : "PDF";
}

function formatSize(sizeBytes: number | null): string {
  if (sizeBytes === null) {
    return "-";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function shortChecksum(checksum: string | null): string {
  return checksum ? checksum.slice(0, 10) : "-";
}

function generationStatusLabel(row: ExportHistoryItem): string {
  if (row.status === "generated" && !row.artifactAvailable) {
    return "Generated - artifact not retained";
  }

  if (row.status === "generated") {
    return "Generated";
  }

  return row.status === "pending" ? "Pending" : "Generation failed";
}

function driveStatusLabel(row: ExportHistoryItem, viewerRole: Role): string {
  if (row.driveUploadStatus === "uploaded" && row.driveUrl) {
    return "Uploaded";
  }

  if (row.driveUploadStatus === "upload_failed") {
    return viewerRole === "admin" && row.driveErrorCode
      ? `Upload failed (${row.driveErrorCode})`
      : "Upload failed";
  }

  if (row.driveUploadStatus === "uploading") {
    return row.isDriveUploadStale ? "Upload stale" : "Uploading";
  }

  return "Not uploaded";
}

export function ExportHistoryPanel({
  rows,
  viewerRole,
}: ExportHistoryPanelProps) {
  const router = useRouter();
  const [pendingExportId, setPendingExportId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDriveUpload(exportId: string): Promise<void> {
    setPendingExportId(exportId);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/shipping-note-exports/${encodeURIComponent(exportId)}/drive`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Drive upload failed.");
      }

      setMessage("Drive status updated.");
      router.refresh();
    } catch {
      setMessage("Drive upload could not be completed.");
    } finally {
      setPendingExportId(null);
    }
  }

  return (
    <section className="grid gap-4 border-t border-border pt-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal Artifacts
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Export History</h2>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          No internal export records yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Artifact</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Drive</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row) => {
                const driveAction = getDriveHistoryAction({
                  role: viewerRole,
                  row,
                });
                const driveButtonText =
                  driveAction === "upload"
                    ? "Upload to Drive"
                    : driveAction === "retry"
                      ? "Retry Drive Upload"
                      : driveAction === "recover"
                        ? "Recover Upload"
                        : "Uploading";
                const pending = pendingExportId === row.id;

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">
                        {formatType(row.exportType)} v{row.version}
                      </div>
                      <div className="mt-1 max-w-[28rem] break-words text-muted-foreground">
                        {row.fileName ?? "-"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        SHA {shortChecksum(row.checksum)} - {formatSize(row.artifactSizeBytes)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                      <div>{formatDateTime(row.generatedAt)}</div>
                      {row.generatedByDisplay ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.generatedByDisplay}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                      {generationStatusLabel(row)}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                      {driveStatusLabel(row, viewerRole)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {row.artifactAvailable &&
                        canDownloadHistoricalArtifact(viewerRole) ? (
                          <a
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            href={`/api/shipping-note-exports/${encodeURIComponent(row.id)}/download`}
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Download
                          </a>
                        ) : null}

                        {driveAction === "view" && row.driveUrl ? (
                          <a
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            href={row.driveUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            View in Drive
                          </a>
                        ) : null}

                        {driveAction === "upload" ||
                        driveAction === "retry" ||
                        driveAction === "recover" ? (
                          <button
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:bg-slate-950 dark:disabled:text-slate-600"
                            disabled={pendingExportId !== null}
                            onClick={() => void handleDriveUpload(row.id)}
                            type="button"
                          >
                            {driveAction === "retry" || driveAction === "recover" ? (
                              <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <UploadCloud className="h-4 w-4" aria-hidden="true" />
                            )}
                            {pending ? "Working" : driveButtonText}
                          </button>
                        ) : null}

                        {driveAction === "wait" ? (
                          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                            Uploading
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {message ? (
        <p className="text-sm text-slate-600 dark:text-slate-300" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
