import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseServiceCatalogImportArgs } from "../../../../scripts/import-service-catalog";

describe("Service Catalog import CLI", () => {
  it("requires one explicit mode and preserves file arguments", () => {
    expect(
      parseServiceCatalogImportArgs(["--file", "C:/Source Folder/catalog.xlsx"]),
    ).toEqual({
      filePath: "C:/Source Folder/catalog.xlsx",
      mode: null,
      modeConflict: false,
    });
    expect(
      parseServiceCatalogImportArgs([
        "--file",
        "C:/Source Folder/catalog.xlsx",
        "--dry-run",
      ]),
    ).toMatchObject({ mode: "dry-run", modeConflict: false });
    expect(
      parseServiceCatalogImportArgs([
        "--file",
        "C:/Source Folder/catalog.xlsx",
        "--apply",
      ]),
    ).toMatchObject({ mode: "apply", modeConflict: false });
  });

  it("rejects both modes", () => {
    expect(
      parseServiceCatalogImportArgs([
        "--file",
        "catalog.xlsx",
        "--dry-run",
        "--apply",
      ]),
    ).toMatchObject({ modeConflict: true });
  });

  it("keeps database initialization dynamic and inside the apply branch", () => {
    const source = readFileSync(
      path.join(process.cwd(), "scripts", "import-service-catalog.ts"),
      "utf8",
    );
    expect(source).toContain('if (mode === "apply")');
    expect(source).toContain('await import("../src/lib/db/client")');
    expect(
      source.indexOf("const target = validateServiceCatalogApplyAuthorization"),
    ).toBeLessThan(source.indexOf('await import("../src/lib/db/client")'));
    expect(source).not.toMatch(/import\s+\{\s*db\s*\}\s+from\s+["'][^"']*db\/client/);
  });
});
