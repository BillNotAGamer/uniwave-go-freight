import type { ShippingMode } from "../constants";

export type ShipmentType = "ocean" | "air" | "domestic" | "custom";

export const SHIPPING_NOTE_CREATE_INTAKE_COPY = {
  title: "Create Shipment",
  description: "Choose a shipment type to begin an operational draft.",
  prompt: "Choose shipment type",
} as const;

export const SHIPMENT_TYPE_CARDS: ReadonlyArray<{
  type: ShipmentType;
  label: string;
  description: string;
  available: boolean;
}> = [
  { type: "ocean", label: "Ocean", description: "Sea freight", available: true },
  { type: "air", label: "Air", description: "Air freight", available: true },
  { type: "domestic", label: "Domestic", description: "Domestic transport", available: true },
  { type: "custom", label: "Custom", description: "Other shipment configuration", available: true },
];

export const SHIPPING_MODES_BY_SHIPMENT_TYPE: Record<
  Exclude<ShipmentType, "custom">,
  readonly ShippingMode[]
> = {
  ocean: ["sea_export", "sea_import"],
  air: ["air_export", "air_import"],
  domestic: ["domestic_truck"],
};
