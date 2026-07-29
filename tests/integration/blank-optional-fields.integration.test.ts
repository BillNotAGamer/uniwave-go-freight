import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readFormString } from "@/features/shipping-notes/form-data";
import { createShippingNoteDraft } from "@/features/shipping-notes/mutations";
import { shippingNoteDraftInputSchema } from "@/features/shipping-notes/validators";

import { createIntegrationActors, type IntegrationActors } from "./fixtures/users";
import { listAuditLogsForEntity } from "./helpers/audit";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("BLANK");
let actors: IntegrationActors;

describe("blank optional-field production path", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("accepts legitimate blank optional shipping note form values and persists nulls", async () => {
    const formData = new FormData();
    formData.set("jobsheetNo", `${runId}-OPTIONAL-BLANKS`);
    formData.set("shippingMode", "sea_export");
    formData.set("mawbHawbNo", ` ${runId}-MAWB-BLANKS `);
    formData.set("shipperText", "   ");
    formData.set("consigneeText", "");
    formData.set("customerText", "   ");
    formData.set("agentText", "Agent With Spaces");
    formData.set("aol", "SGN");
    formData.set("aod", "   ");
    formData.set("volumeValue", "");
    formData.set("exchangeRate", "0");

    const parsed = shippingNoteDraftInputSchema.parse({
      jobsheetNo: readFormString(formData, "jobsheetNo"),
      shippingMode: readFormString(formData, "shippingMode"),
      mawbHawbNo: readFormString(formData, "mawbHawbNo"),
      shipperText: readFormString(formData, "shipperText"),
      consigneeText: readFormString(formData, "consigneeText"),
      customerText: readFormString(formData, "customerText"),
      agentText: readFormString(formData, "agentText"),
      aol: readFormString(formData, "aol"),
      aod: readFormString(formData, "aod"),
      volumeValue: readFormString(formData, "volumeValue"),
    });

    const created = await createShippingNoteDraft(parsed, actors.saleA);

    expect(created.mawbHawbNo).toBe(`${runId}-MAWB-BLANKS`);
    expect(created.shipperText).toBeNull();
    expect(created.consigneeText).toBeNull();
    expect(created.customerText).toBeNull();
    expect(created.agentText).toBe("Agent With Spaces");
    expect(created.aod).toBeNull();
    expect(created.volumeValue).toBeNull();
    expect(created.exchangeRate).toBe("1.000000");
    expect(await listAuditLogsForEntity("shipping_note", created.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "shipping_note.create_draft" }),
      ]),
    );
  });

  it("continues to reject required blank fields through the same parser boundary", () => {
    const formData = new FormData();
    formData.set("jobsheetNo", "   ");
    formData.set("shippingMode", "sea_export");

    expect(() => shippingNoteDraftInputSchema.parse({
      jobsheetNo: readFormString(formData, "jobsheetNo"),
      shippingMode: readFormString(formData, "shippingMode"),
    })).toThrow();
  });
});
