import { describe, expect, it } from "vitest";

import {
  decodeAuditViewerCursor,
  encodeAuditViewerCursor,
} from "./cursor";

const id = "00000000-0000-4000-8000-000000000001";

describe("audit viewer cursor", () => {
  it("encodes and decodes the createdAt plus id keyset state opaquely", () => {
    const createdAt = new Date("2026-08-24T04:00:00.123Z");
    const encoded = encodeAuditViewerCursor({ createdAt, id });

    expect(encoded).not.toContain(createdAt.toISOString());
    expect(decodeAuditViewerCursor(encoded)).toEqual({
      createdAt,
      id,
    });
  });

  it("preserves same-timestamp descending id tie-breaker data", () => {
    const createdAt = new Date("2026-08-24T04:00:00.000Z");
    const first = decodeAuditViewerCursor(encodeAuditViewerCursor({
      createdAt,
      id: "00000000-0000-4000-8000-000000000002",
    }));
    const second = decodeAuditViewerCursor(encodeAuditViewerCursor({
      createdAt,
      id: "00000000-0000-4000-8000-000000000001",
    }));

    expect(first.createdAt.getTime()).toBe(second.createdAt.getTime());
    expect(first.id > second.id).toBe(true);
  });

  it("rejects invalid cursor payloads", () => {
    expect(() => decodeAuditViewerCursor("not-base64")).toThrow("Invalid audit cursor.");
    expect(() => decodeAuditViewerCursor(Buffer.from("{}").toString("base64url")))
      .toThrow("Invalid audit cursor.");
    expect(() => decodeAuditViewerCursor(Buffer.from(JSON.stringify({
      createdAt: "not-a-date",
      id,
    })).toString("base64url"))).toThrow("Invalid audit cursor.");
    expect(() => decodeAuditViewerCursor(Buffer.from(JSON.stringify({
      createdAt: "2026-08-24T04:00:00.000Z",
      id: "not-a-uuid",
    })).toString("base64url"))).toThrow("Invalid audit cursor.");
  });
});
