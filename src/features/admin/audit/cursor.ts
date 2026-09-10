import { z } from "zod";

export type AuditViewerCursor = {
  createdAt: Date;
  id: string;
};

const cursorPayloadSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
}).strict();

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeAuditViewerCursor(cursor: AuditViewerCursor): string {
  return encodeBase64Url(JSON.stringify({
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  }));
}

export function decodeAuditViewerCursor(value: string): AuditViewerCursor {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(decodeBase64Url(value));
  } catch {
    throw new Error("Invalid audit cursor.");
  }

  const parsed = cursorPayloadSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new Error("Invalid audit cursor.");
  }

  const createdAt = new Date(parsed.data.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("Invalid audit cursor.");
  }

  return {
    createdAt,
    id: parsed.data.id,
  };
}
