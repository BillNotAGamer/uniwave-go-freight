import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Admin User server action boundary", () => {
  it("keeps every runtime export in the top-level use-server module async", () => {
    const source = readFileSync(
      new URL("./actions.ts", import.meta.url),
      "utf8",
    );

    expect(source.trimStart().startsWith('"use server";')).toBe(true);
    expect(source).not.toMatch(/export\s+(const|let|var|class)\s+/);
    expect(source).not.toMatch(/export\s+function\s+/);
    expect([...source.matchAll(/export\s+async\s+function\s+/g)].length)
      .toBeGreaterThan(0);
  });
});
