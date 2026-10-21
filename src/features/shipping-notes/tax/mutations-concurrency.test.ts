import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tax mutation concurrency contract", () => {
  const source = readFileSync(new URL("./mutations.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function loadActiveChargeForTax");
  const end = source.indexOf("export async function assignChargeTaxRule", start);
  const loader = source.slice(start, end);

  it("locks the Shipping Note before locking and reloading the charge", () => {
    const noteLock = loader.indexOf(".select({ status: shippingNotes.status })");
    const chargeLock = loader.indexOf(".select(activeChargeColumns)");

    expect(noteLock).toBeGreaterThan(-1);
    expect(chargeLock).toBeGreaterThan(noteLock);
    expect(loader.match(/\.for\("update"\)/g)).toHaveLength(2);
  });

  it("revalidates note and charge deletion state inside the locking transaction", () => {
    expect(loader).toContain("isNull(shippingNotes.deletedAt)");
    expect(loader).toContain("isNull(shippingNoteCharges.deletedAt)");
    expect(loader).toContain("eq(shippingNoteCharges.shippingNoteId, identity.shippingNoteId)");
  });
});
