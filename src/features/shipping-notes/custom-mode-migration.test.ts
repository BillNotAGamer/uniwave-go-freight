import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Custom shipping mode migration", () => {
  it("is additive and preserves the existing PostgreSQL enum", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "drizzle/0011_fresh_radioactive_man.sql"),
      "utf8",
    );

    expect(sql).toContain('ALTER TYPE "public"."shipping_mode" ADD VALUE \'custom\'');
    expect(sql).toContain('ADD COLUMN "custom_mode_name" text');
    expect(sql).toContain('ADD COLUMN "custom_origin" text');
    expect(sql).toContain('ADD COLUMN "custom_destination" text');
    expect(sql).not.toMatch(/DROP|DELETE|TRUNCATE|RENAME|CREATE TYPE/i);
  });
});
