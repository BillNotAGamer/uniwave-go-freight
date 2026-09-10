import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { DRIVE_ERROR_CODES, DriveError, type DriveErrorCode } from "@/lib/drive/errors";
import { isSameOriginRequestMetadata } from "@/features/shipping-notes/export/http";
import { uploadShippingNoteExportToDrive } from "@/features/shipping-notes/export/drive/service";

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

function jsonError(code: DriveErrorCode, status: number): NextResponse {
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

function toDriveError(error: unknown): DriveError {
  if (error instanceof DriveError) {
    return error;
  }

  if (error instanceof AuthorizationError) {
    return new DriveError(
      DRIVE_ERROR_CODES.PERMISSION_DENIED,
      403,
      "You do not have permission to upload this export.",
    );
  }

  return new DriveError(
    DRIVE_ERROR_CODES.UPLOAD_FAILED,
    500,
    "Drive upload failed.",
  );
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonError(DRIVE_ERROR_CODES.PERMISSION_DENIED, 403);
  }

  const currentSession = await getCurrentSession();

  if (!currentSession) {
    return jsonError(DRIVE_ERROR_CODES.AUTH_FAILED, 401);
  }

  const { exportId: rawExportId } = await context.params;
  const parsedExportId = exportIdSchema.safeParse(rawExportId);

  if (!parsedExportId.success) {
    return jsonError(DRIVE_ERROR_CODES.INVALID_EXPORT_ID, 400);
  }

  try {
    const result = await uploadShippingNoteExportToDrive(
      parsedExportId.data,
      currentSession.user,
    );

    return NextResponse.json(
      {
        exportId: result.exportId,
        driveUploadStatus: result.driveUploadStatus,
        driveFileId: result.driveFileId,
        driveUrl: result.driveUrl,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  } catch (error) {
    const driveError = toDriveError(error);
    return jsonError(driveError.code, driveError.status);
  }
}
