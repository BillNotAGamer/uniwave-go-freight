"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FileText, Printer } from "lucide-react";

type ExportKind = "xlsx" | "pdf";

type InternalExportActionsProps = {
  noteId: string;
  printHref: string;
};

function extractFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallback;
    }
  }

  const asciiMatch = /filename="([^"]+)"/i.exec(contentDisposition);
  return asciiMatch?.[1] ?? fallback;
}

async function downloadExport(noteId: string, kind: ExportKind): Promise<void> {
  const response = await fetch(
    `/api/shipping-notes/${encodeURIComponent(noteId)}/exports/internal-${kind}`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Internal export failed.");
  }

  const blob = await response.blob();
  const fileName = extractFilename(
    response.headers.get("content-disposition"),
    kind === "pdf" ? "shipping-note.pdf" : "shipping-note.xlsx",
  );
  const url = window.URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.URL.revokeObjectURL(url);
  }
}

export function InternalExportActions({
  noteId,
  printHref,
}: InternalExportActionsProps) {
  const [pendingKind, setPendingKind] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(kind: ExportKind): Promise<void> {
    setPendingKind(kind);
    setError(null);

    try {
      await downloadExport(noteId, kind);
    } catch {
      setError("Internal export failed. Try again or contact an administrator.");
    } finally {
      setPendingKind(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:bg-slate-950 dark:disabled:text-slate-600"
        disabled={pendingKind !== null}
        onClick={() => void handleDownload("xlsx")}
        type="button"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {pendingKind === "xlsx" ? "Exporting XLSX" : "Export XLSX"}
      </button>
      <button
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:bg-slate-950 dark:disabled:text-slate-600"
        disabled={pendingKind !== null}
        onClick={() => void handleDownload("pdf")}
        type="button"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        {pendingKind === "pdf" ? "Exporting PDF" : "Export PDF"}
      </button>
      <Link
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        href={printHref}
        prefetch={false}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print
      </Link>
      {error ? (
        <p className="w-full text-sm text-red-700 dark:text-red-400" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
