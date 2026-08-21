import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("Next.js production asset tracing", () => {
  it("includes only required internal export runtime assets for each export route", () => {
    expect(nextConfig.outputFileTracingIncludes).toEqual({
      "/api/shipping-notes/[id]/exports/internal-xlsx": [
        "./assets/export-templates/shipping-note/internal-v2.xlsx",
      ],
      "/api/shipping-notes/[id]/exports/internal-pdf": [
        "./assets/fonts/noto-sans/NotoSans-Regular.ttf",
        "./assets/fonts/noto-sans/NotoSans-Bold.ttf",
      ],
    });
  });
});
