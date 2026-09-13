import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { isSameOriginRequestMetadata } from "@/features/shipping-notes/export/http";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  SHIPPING_NOTE_DOCUMENT_TYPES,
  type ShippingNoteDocumentType,
} from "@/features/shipping-notes/documents/constants";
import { listShippingNoteDocumentsForUser } from "@/features/shipping-notes/documents/queries";
import {
  removeShippingNoteDocument,
  uploadShippingNoteDocument,
} from "@/features/shipping-notes/documents/service";
import { removeShippingNoteDocumentInputSchema } from "@/features/shipping-notes/documents/validators";

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
function isSameOriginRequest(request: NextRequest): boolean {
  return isSameOriginRequestMetadata({
    requestOrigin: request.nextUrl.origin,
    originHeader: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
}
export async function POST(
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

  const { id: shippingNoteId } = await context.params;
  if (!shippingNoteId) {
    return NextResponse.json(
      { error: "Shipping note ID is required." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const rawDocumentType = formData.get("documentType")?.toString();
  const file = formData.get("file");

  if (!rawDocumentType || !SHIPPING_NOTE_DOCUMENT_TYPES.includes(rawDocumentType as ShippingNoteDocumentType)) {
    return NextResponse.json(
      { error: "Valid document type is required." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!file || typeof file === "string" || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "A file must be uploaded." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    const document = await uploadShippingNoteDocument(
      {
        shippingNoteId,
        documentType: rawDocumentType as ShippingNoteDocumentType,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          bytes,
        },
      },
      session.user,
    );

    return NextResponse.json(
      { ok: true, document },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || "Forbidden." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    const message = error instanceof Error ? error.message : "Document upload failed.";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: noStoreHeaders() },
    );
  }
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

  const { id: shippingNoteId } = await context.params;
  if (!shippingNoteId) {
    return NextResponse.json(
      { error: "Shipping note ID is required." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const documents = await listShippingNoteDocumentsForUser(
      shippingNoteId,
      session.user,
    );

    return NextResponse.json(
      { ok: true, documents },
      { status: 200, headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || "Forbidden." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to retrieve documents.";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(
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

  const { id: shippingNoteId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid document deletion request." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const parsed = removeShippingNoteDocumentInputSchema.safeParse({
    id: typeof body === "object" && body !== null && "documentId" in body
      ? body.documentId
      : undefined,
    shippingNoteId,
    reason: typeof body === "object" && body !== null && "reason" in body
      ? body.reason
      : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid document deletion request." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    await removeShippingNoteDocument(
      {
        documentId: parsed.data.id,
        shippingNoteId: parsed.data.shippingNoteId,
        reason: parsed.data.reason,
      },
      session.user,
    );
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    const message = error instanceof Error &&
      error.message === "Document metadata was deleted, but private artifact cleanup failed. An audit event was recorded."
      ? error.message
      : "Document deletion failed.";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: noStoreHeaders() },
    );
  }
}
