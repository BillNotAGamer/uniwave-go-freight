import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { getInternalShippingNoteExportDataForUser } from "@/features/shipping-notes/export/queries";
import { buildInternalPdfFileName } from "@/features/shipping-notes/export/filename";
import { generateInternalShippingNotePdf } from "@/features/shipping-notes/export/pdf/generator";
import {
  buildContentDisposition,
  isSameOriginRequestMetadata,
} from "@/features/shipping-notes/export/http";
import {
  createPendingInternalPdfExportRecord,
  markInternalPdfExportFailed,
  markInternalPdfExportGenerated,
} from "@/features/shipping-notes/export/mutations";
import {
  INTERNAL_PDF_MIME_TYPE,
} from "@/features/shipping-notes/export/constants";
import {
  ExportError,
  EXPORT_ERROR_CODES,
  type ExportErrorCode,
} from "@/features/shipping-notes/export/errors";
import type { InternalShippingNoteExportDto } from "@/features/shipping-notes/export/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonError(code: ExportErrorCode, status: number): NextResponse {
  return NextResponse.json(
    { error: { code } },
    {
      status,
      headers: noStoreHeaders(),
    },
  );
}

function isSameOriginRequest(request: NextRequest): boolean {
  return isSameOriginRequestMetadata({
    requestOrigin: request.nextUrl.origin,
    originHeader: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
}

function toExportError(error: unknown): ExportError {
  if (error instanceof ExportError) {
    return error;
  }

  if (error instanceof AuthorizationError) {
    return new ExportError(
      EXPORT_ERROR_CODES.PERMISSION_DENIED,
      403,
      "You do not have permission to export this shipping note.",
    );
  }

  if (
    error instanceof Error &&
    error.message.includes("to be exported")
  ) {
    return new ExportError(
      EXPORT_ERROR_CODES.STATUS_NOT_ELIGIBLE,
      409,
      "Shipping note is not eligible for internal PDF export.",
    );
  }

  return new ExportError(
    EXPORT_ERROR_CODES.GENERATION_FAILED,
    500,
    "Internal PDF export failed.",
  );
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonError(EXPORT_ERROR_CODES.ORIGIN_DENIED, 403);
  }

  const currentSession = await getCurrentSession();

  if (!currentSession) {
    return jsonError(EXPORT_ERROR_CODES.UNAUTHENTICATED, 401);
  }

  const { id } = await context.params;
  let exportData: InternalShippingNoteExportDto | null;

  try {
    exportData = await getInternalShippingNoteExportDataForUser(
      id,
      currentSession.user,
    );
  } catch (error) {
    const exportError = toExportError(error);
    return jsonError(exportError.code, exportError.status);
  }

  if (!exportData) {
    return jsonError(EXPORT_ERROR_CODES.NOTE_NOT_FOUND, 404);
  }

  const generatedAt = new Date();
  const fileName = buildInternalPdfFileName(exportData, generatedAt);
  let exportRecordId: string | null = null;

  try {
    const exportRecord = await createPendingInternalPdfExportRecord({
      shippingNoteId: exportData.note.id,
      fileName,
      user: currentSession.user,
    });
    exportRecordId = exportRecord.id;

    const generated = await generateInternalShippingNotePdf(
      exportData,
      generatedAt,
    );

    await markInternalPdfExportGenerated({
      exportId: exportRecord.id,
      fileName: generated.fileName,
      checksumSha256: generated.checksumSha256,
      sellingChargeCount: exportData.summary.sellingChargeCount,
      buyingChargeCount: exportData.summary.buyingChargeCount,
      generatedAt,
      user: currentSession.user,
    });

    return new Response(new Uint8Array(generated.buffer), {
      status: 200,
      headers: {
        ...noStoreHeaders(),
        "Content-Type": INTERNAL_PDF_MIME_TYPE,
        "Content-Disposition": buildContentDisposition(generated.fileName),
        "Content-Length": generated.buffer.byteLength.toString(),
        "X-Pdf-Layout-Version": generated.layoutVersion,
      },
    });
  } catch (error) {
    const exportError = toExportError(error);

    if (exportRecordId) {
      try {
        await markInternalPdfExportFailed({
          exportId: exportRecordId,
          errorCode: exportError.code,
          fileName,
          user: currentSession.user,
        });
      } catch {
        // Preserve the original sanitized export failure for the API response.
      }
    }

    return jsonError(exportError.code, exportError.status);
  }
}
