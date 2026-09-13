import { describe, expect, it } from "vitest";

import {
  buildContentDisposition,
  isSameOriginRequestMetadata,
  type ExportRequestOriginMetadata,
} from "./http";

function originMetadata(
  metadata: Partial<ExportRequestOriginMetadata>,
): ExportRequestOriginMetadata {
  return {
    requestOrigin: "https://app.example.test",
    originHeader: null,
    secFetchSite: null,
    trustedOrigin: "https://app.example.test",
    nodeEnv: "production",
    ...metadata,
  };
}

describe("internal XLSX HTTP export safeguards", () => {
  it("accepts the configured public HTTPS origin through an internal proxy URL", () => {
    expect(isSameOriginRequestMetadata(originMetadata({
      requestOrigin: "http://railway-internal:8080",
      originHeader: "https://uniwave-go-freight-production-8da8.up.railway.app",
      trustedOrigin: "https://uniwave-go-freight-production-8da8.up.railway.app",
      secFetchSite: "cross-site",
    }))).toBe(true);
  });

  it("rejects foreign, scheme-downgraded, prefix, suffix, and malformed origin headers", () => {
    expect(isSameOriginRequestMetadata(originMetadata({
      originHeader: "https://evil.example.test",
    }))).toBe(false);
    expect(isSameOriginRequestMetadata(originMetadata({
      originHeader: "http://app.example.test",
    }))).toBe(false);
    expect(isSameOriginRequestMetadata(originMetadata({
      originHeader: "https://app.example.test.evil.example",
    }))).toBe(false);
    expect(isSameOriginRequestMetadata(originMetadata({
      originHeader: "https://evil-app.example.test",
    }))).toBe(false);
    expect(isSameOriginRequestMetadata(originMetadata({
      originHeader: "not a url",
    }))).toBe(false);
  });

  it("falls back to sec-fetch-site when origin is absent", () => {
    expect(isSameOriginRequestMetadata(originMetadata({
      secFetchSite: "same-origin",
    }))).toBe(true);
    expect(isSameOriginRequestMetadata(originMetadata({
      secFetchSite: "none",
    }))).toBe(true);
    expect(isSameOriginRequestMetadata(originMetadata({
      secFetchSite: "cross-site",
    }))).toBe(false);
    expect(isSameOriginRequestMetadata(originMetadata({}))).toBe(false);
  });

  it("fails closed in production when AUTH_URL is missing or malformed", () => {
    expect(isSameOriginRequestMetadata(originMetadata({
      trustedOrigin: null,
      originHeader: "https://app.example.test",
    }))).toBe(false);
    expect(isSameOriginRequestMetadata(originMetadata({
      trustedOrigin: "not a valid url",
      originHeader: "https://app.example.test",
    }))).toBe(false);
    expect(isSameOriginRequestMetadata(originMetadata({
      trustedOrigin: null,
      originHeader: null,
      secFetchSite: "same-origin",
    }))).toBe(false);
  });

  it("preserves local development origin comparison when no canonical URL is configured", () => {
    expect(isSameOriginRequestMetadata(originMetadata({
      requestOrigin: "http://localhost:3000",
      trustedOrigin: null,
      nodeEnv: "development",
      originHeader: "http://localhost:3000",
    }))).toBe(true);
  });

  it("builds attachment content disposition with ASCII fallback and UTF-8 filename", () => {
    expect(buildContentDisposition("ShippingNote_A\"B.xlsx")).toBe(
      "attachment; filename=\"ShippingNote_A_B.xlsx\"; filename*=UTF-8''ShippingNote_A%22B.xlsx",
    );
    expect(buildContentDisposition("ShippingNote_Don.xlsx")).toBe(
      "attachment; filename=\"ShippingNote_Don.xlsx\"; filename*=UTF-8''ShippingNote_Don.xlsx",
    );
  });
});
