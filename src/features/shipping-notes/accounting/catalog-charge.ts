export type ChargeCatalogSelection = {
  serviceCatalogItemId?: string;
  chargeName: string;
  unit: string;
};

export type SelectableCatalogItem = {
  id: string;
  code: string;
  name: string;
  primaryUnit: string | null;
  vatRate: string | null;
  isActive: boolean;
  deletedAt: Date | null;
};

export type ChargeCatalogPersistence = {
  serviceCatalogItemId: string | null;
  catalogCodeSnapshot: string | null;
  catalogNameSnapshot: string | null;
  catalogUnitSnapshot: string | null;
  catalogVatRateSnapshot: string | null;
  chargeName: string;
  unit: string;
};

export function resolveChargeCatalogPersistence(
  input: ChargeCatalogSelection,
  catalogItem: SelectableCatalogItem | null,
): ChargeCatalogPersistence {
  if (!input.serviceCatalogItemId) {
    return {
      serviceCatalogItemId: null,
      catalogCodeSnapshot: null,
      catalogNameSnapshot: null,
      catalogUnitSnapshot: null,
      catalogVatRateSnapshot: null,
      chargeName: input.chargeName,
      unit: input.unit,
    };
  }

  if (
    !catalogItem ||
    catalogItem.id !== input.serviceCatalogItemId ||
    !catalogItem.isActive ||
    catalogItem.deletedAt !== null
  ) {
    throw new Error("Selected Service Catalog item is unavailable.");
  }

  return {
    serviceCatalogItemId: catalogItem.id,
    catalogCodeSnapshot: catalogItem.code,
    catalogNameSnapshot: catalogItem.name,
    catalogUnitSnapshot: catalogItem.primaryUnit,
    catalogVatRateSnapshot: catalogItem.vatRate,
    chargeName: catalogItem.name,
    unit: catalogItem.primaryUnit ?? input.unit,
  };
}

