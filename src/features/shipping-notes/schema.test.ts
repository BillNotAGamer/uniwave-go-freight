import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

type InlineForeignKey = {
  onDelete: string;
  reference: () => {
    foreignTable: unknown;
    columns: Array<{ name: string }>;
  };
};

function getInlineForeignKeys(table: unknown): InlineForeignKey[] {
  const record = table as Record<symbol, unknown>;
  const foreignKeys = record[Symbol.for("drizzle:PgInlineForeignKeys")];
  return (Array.isArray(foreignKeys) ? foreignKeys : []) as InlineForeignKey[];
}

import {
  businessPartners,
  businessPartnersRelations,
  serviceCatalogItems,
  shippingNoteCharges,
  shippingNoteCustomsDeclarations,
  shippingNotes,
  shippingNotesRelations,
} from "@/lib/db/schema";

const partnerIdColumns = [
  shippingNotes.shipperPartnerId,
  shippingNotes.consigneePartnerId,
  shippingNotes.customerPartnerId,
  shippingNotes.agentPartnerId,
];

describe("C4 Shipping Note schema contract", () => {
  it("defines the explicit nullable routing, document, and transport columns", () => {
    for (const column of [
      shippingNotes.domesticOrigin,
      shippingNotes.domesticDestination,
      shippingNotes.aol,
      shippingNotes.aod,
      shippingNotes.portOfLoading,
      shippingNotes.portOfDischarge,
      shippingNotes.finalDestination,
      shippingNotes.mawbNo,
      shippingNotes.hawbNo,
      shippingNotes.mblNo,
      shippingNotes.hblNo,
      shippingNotes.flightNo,
      shippingNotes.vesselName,
      shippingNotes.voyageNo,
    ]) {
      expect(column).toBeDefined();
      expect(column.notNull).toBe(false);
    }

    expect(shippingNotes.mawbHawbNo).toBeDefined();
  });

  it("defines four nullable, non-unique Partner references with lookup indexes", () => {
    const config = getTableConfig(shippingNotes);
    const uniqueColumns = new Set(
      config.indexes
        .filter((item) => item.config.unique)
        .flatMap((item) => item.config.columns)
        .flatMap((column) => "name" in column ? [column.name as string] : []),
    );

    for (const column of partnerIdColumns) {
      expect(column.notNull).toBe(false);
      expect(uniqueColumns.has(column.name)).toBe(false);
    }

    expect(config.indexes.map((item) => item.config.name)).toEqual(
      expect.arrayContaining([
        "shipping_notes_shipper_partner_id_idx",
        "shipping_notes_consignee_partner_id_idx",
        "shipping_notes_customer_partner_id_idx",
        "shipping_notes_agent_partner_id_idx",
      ]),
    );
  });

  it("sets all Partner hard-delete actions to SET NULL instead of cascading", () => {
    const partnerForeignKeys = getInlineForeignKeys(shippingNotes).filter((key) =>
      key.reference().foreignTable === businessPartners,
    );

    expect(partnerForeignKeys).toHaveLength(4);
    expect(partnerForeignKeys.map((key) => key.onDelete)).toEqual([
      "set null",
      "set null",
      "set null",
      "set null",
    ]);
  });

  it("defines unambiguous Shipping Note-to-Partner relations", () => {
    expect(shippingNotesRelations.table).toBe(shippingNotes);
    expect(businessPartnersRelations.table).toBe(businessPartners);
  });
});

describe("C8A Accounting schema contract", () => {
  it("defines nullable catalog provenance and constrained nullable VAT override", () => {
    const config = getTableConfig(shippingNoteCharges);
    const [catalogForeignKey] = getInlineForeignKeys(shippingNoteCharges).filter(
      (key) => key.reference().foreignTable === serviceCatalogItems,
    );

    expect(shippingNoteCharges.serviceCatalogItemId.notNull).toBe(false);
    expect(catalogForeignKey?.onDelete).toBe("set null");
    expect(shippingNoteCharges.catalogCodeSnapshot.notNull).toBe(false);
    expect(shippingNoteCharges.catalogNameSnapshot.notNull).toBe(false);
    expect(shippingNoteCharges.catalogUnitSnapshot.notNull).toBe(false);
    expect(shippingNoteCharges.catalogVatRateSnapshot.notNull).toBe(false);
    expect(shippingNoteCharges.vatOverrideRate.notNull).toBe(false);
    expect(config.indexes.find((index) =>
      index.config.name === "shipping_note_charges_service_catalog_item_id_idx"
    )?.config.unique).toBe(false);
    expect(config.checks.map((check) => check.name)).toContain(
      "shipping_note_charges_vat_override_rate_check",
    );
  });

  it("defines declarations as owned, soft-deletable Shipping Note children", () => {
    const config = getTableConfig(shippingNoteCustomsDeclarations);
    const [noteForeignKey] = getInlineForeignKeys(
      shippingNoteCustomsDeclarations,
    ).filter((key) => key.reference().foreignTable === shippingNotes);

    expect(shippingNoteCustomsDeclarations.shippingNoteId.notNull).toBe(true);
    expect(shippingNoteCustomsDeclarations.declarationNo.notNull).toBe(true);
    expect(shippingNoteCustomsDeclarations.deletedAt.notNull).toBe(false);
    expect(noteForeignKey?.onDelete).toBe("cascade");
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "shipping_note_customs_declarations_shipping_note_id_idx",
        "shipping_note_customs_declarations_active_note_number_uidx",
      ]),
    );
  });
});
