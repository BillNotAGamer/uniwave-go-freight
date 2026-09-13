"use client";

import { Download } from "lucide-react";

import type { Role } from "@/lib/permissions/roles";
import type { ExportHistoryItem } from "../export/history";
import {
  canDownloadHistoricalArtifact,
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

export function ExportHistoryPanel({
  rows,
  viewerRole,
}: ExportHistoryPanelProps) {
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
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row) => {
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

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </section>
  );
}
