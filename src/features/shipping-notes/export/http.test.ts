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
    ...metadata,
  };
}

describe("internal XLSX HTTP export safeguards", () => {
  it("accepts matching origin headers", () => {
    expect(isSameOriginRequestMetadata(originMetadata({
      originHeader: "https://app.example.test",
      secFetchSite: "cross-site",
    }))).toBe(true);
  });

  it("rejects mismatched or malformed origin headers", () => {
    expect(isSameOriginRequestMetadata(originMetadata({
      originHeader: "https://evil.example.test",
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

  it("builds attachment content disposition with ASCII fallback and UTF-8 filename", () => {
    expect(buildContentDisposition("ShippingNote_A\"B.xlsx")).toBe(
      "attachment; filename=\"ShippingNote_A_B.xlsx\"; filename*=UTF-8''ShippingNote_A%22B.xlsx",
    );
    expect(buildContentDisposition("ShippingNote_Don.xlsx")).toBe(
      "attachment; filename=\"ShippingNote_Don.xlsx\"; filename*=UTF-8''ShippingNote_Don.xlsx",
    );
  });
});
