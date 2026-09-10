import {
  getShippingModeFieldRulesForFamily,
  type ShippingModeFamily,
} from "../mode-rules";

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
