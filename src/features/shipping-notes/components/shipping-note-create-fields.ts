import {
  getShippingModeFieldRulesForFamily,
  type ShippingModeFamily,
} from "../mode-rules";
import type { ShipmentType } from "./shipping-note-create-intake";

export type CreateField = {
  name: string;
  label: string;
};

export type CreateModeFieldModel = {
  routing: CreateField[];
  transport: CreateField[];
};

export const SHIPPING_NOTE_PARTY_SELECTOR_FIELDS = [
  { label: "Shipper", partnerFieldName: "shipperPartnerId", textFieldName: "shipperText" },
  { label: "Consignee", partnerFieldName: "consigneePartnerId", textFieldName: "consigneeText" },
  { label: "Customer", partnerFieldName: "customerPartnerId", textFieldName: "customerText" },
  { label: "Agent", partnerFieldName: "agentPartnerId", textFieldName: "agentText" },
] as const;

export function getShippingNoteCreateModeFields(
  family: ShippingModeFamily,
): CreateModeFieldModel {
  const rules = getShippingModeFieldRulesForFamily(family);

  return {
    routing: rules.routingFields,
    transport: rules.transportFields,
  };
}

const SHIPPING_MODE_FAMILY_BY_SHIPMENT_TYPE: Record<
  ShipmentType,
  ShippingModeFamily
> = {
  ocean: "sea",
  air: "air",
  domestic: "domestic",
  custom: "custom",
};

/**
 * Create-form visibility is owned by the selected shipment family. Direction
 * only determines the persisted export/import shipping mode.
 */
export function getShippingNoteCreateModeFieldsForShipmentType(
  shipmentType: ShipmentType,
): CreateModeFieldModel {
  return getShippingNoteCreateModeFields(
    SHIPPING_MODE_FAMILY_BY_SHIPMENT_TYPE[shipmentType],
  );
}
