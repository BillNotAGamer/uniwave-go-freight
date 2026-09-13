import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  buildContentDisposition,
  isSameOriginRequestMetadata,
} from "@/features/shipping-notes/export/http";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { downloadShippingNoteDocument } from "@/features/shipping-notes/documents/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    documentId: string;
  }>;
};

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

function isSameOriginRequest(request: NextRequest): boolean {
  return isSameOriginRequestMetadata({
    requestOrigin: request.nextUrl.origin,
    originHeader: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Forbidden cross-origin request." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const { id: shippingNoteId, documentId } = await context.params;
  if (!shippingNoteId || !documentId) {
    return NextResponse.json(
      { error: "Shipping note ID and Document ID are required." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const download = await downloadShippingNoteDocument(documentId, session.user);

    // Verify document belongs to the specified shipping note
    if (download.shippingNoteId !== shippingNoteId) {
      return NextResponse.json(
        { error: "Document not found for this shipping note." },
        { status: 404, headers: noStoreHeaders() },
      );
    }

    return new Response(new Uint8Array(download.bytes), {
      status: 200,
      headers: {
        ...noStoreHeaders(),
        "Content-Type": download.mimeType,
        "Content-Disposition": buildContentDisposition(download.fileName),
        "Content-Length": download.sizeBytes.toString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || "Forbidden." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    const message = error instanceof Error ? error.message : "Document download failed.";
    const isNotFound = message.toLowerCase().includes("not found");

    return NextResponse.json(
      { error: message },
      { status: isNotFound ? 404 : 500, headers: noStoreHeaders() },
    );
  }
}
