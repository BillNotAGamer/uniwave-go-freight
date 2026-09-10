import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  buildContentDisposition,
  isSameOriginRequestMetadata,
} from "@/features/shipping-notes/export/http";
import {
  EXPORT_ERROR_CODES,
  ExportError,
  type ExportErrorCode,
} from "@/features/shipping-notes/export/errors";
import { getHistoricalExportDownloadForUser } from "@/features/shipping-notes/export/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    exportId: string;
  }>;
};

const exportIdSchema = z.string().uuid();

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
      "You do not have permission to download this export.",
    );
  }

  return new ExportError(
    EXPORT_ERROR_CODES.GENERATION_FAILED,
    500,
    "Historical export download failed.",
  );
}

export async function GET(
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

  const { exportId: rawExportId } = await context.params;
  const parsedExportId = exportIdSchema.safeParse(rawExportId);

  if (!parsedExportId.success) {
    return jsonError(EXPORT_ERROR_CODES.INVALID_DATA, 400);
  }

  try {
    const download = await getHistoricalExportDownloadForUser(
      parsedExportId.data,
      currentSession.user,
    );

    return new Response(new Uint8Array(download.bytes), {
      status: 200,
      headers: {
        ...noStoreHeaders(),
        "Content-Type": download.mimeType,
        "Content-Disposition": buildContentDisposition(download.fileName),
        "Content-Length": download.bytes.byteLength.toString(),
      },
    });
  } catch (error) {
    const exportError = toExportError(error);
    return jsonError(exportError.code, exportError.status);
  }
}
