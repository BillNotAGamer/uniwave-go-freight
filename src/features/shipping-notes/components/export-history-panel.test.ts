import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExportHistoryPanel } from "./export-history-panel";
import type { ExportHistoryItem } from "../export/history";

const row: ExportHistoryItem = {
  id: "export-1",
  exportType: "excel",
  version: 2,
  status: "generated",
  fileName: "ShippingNote_TEST.xlsx",
  checksum: "a".repeat(64),
  generatedAt: new Date("2026-09-13T00:00:00.000Z"),
  generatedByDisplay: "Accountant",
  artifactAvailable: true,
  artifactSizeBytes: 1024,
  createdAt: new Date("2026-09-13T00:00:00.000Z"),
  updatedAt: new Date("2026-09-13T00:00:00.000Z"),
};

describe("ExportHistoryPanel", () => {
  it("renders retained artifacts without any Google Drive column, status, or action", () => {
    const html = renderToStaticMarkup(
      createElement(ExportHistoryPanel, {
        rows: [row],
        viewerRole: "admin",
      }),
    );

    expect(html).toContain("Artifact");
    expect(html).toContain("Generated");
    expect(html).toContain("State");
    expect(html).toContain("Download");
    expect(html).not.toMatch(/Drive/i);
    expect(html).not.toContain("Not uploaded");
  });
});
