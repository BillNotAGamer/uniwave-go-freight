"use client";

import { useState } from "react";

import { VOLUME_UNITS } from "../constants";
import {
  getEditShipmentModePresentation,
  getShippingModeFromEditSelection,
  type EditShipmentFamily,
  type ShipmentDirection,
} from "../mode-rules";
import type { ShippingNoteDetail } from "../types";
import {
  getShippingNoteLocationApplicability,
  LocationSelector,
} from "./location-selector";

type ShippingNoteDraftFieldValues = Partial<ShippingNoteDetail>;

function formatDatetimeLocalValue(value: Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const controlClassName =
  "mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

function TextField({ defaultValue, label, name, required = false, type = "text" }: {
  defaultValue?: string | number | null;
  label: string;
  name: string;
  required?: boolean;
  type?: "text" | "number";
}) {
  return <label className="text-sm font-medium text-foreground" htmlFor={name}>
    {label}
    <input className={controlClassName} defaultValue={defaultValue ?? ""} id={name}
      min={type === "number" ? "0" : undefined} name={name} required={required}
      step={type === "number" ? "0.001" : undefined} type={type} />
  </label>;
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
  </section>;
}

type ShippingNoteDraftFieldsProps = { values?: ShippingNoteDraftFieldValues; includeJobsheetNo?: boolean };

export function ShippingNoteDraftFields({ values, includeJobsheetNo = true }: ShippingNoteDraftFieldsProps) {
  const initial = getEditShipmentModePresentation(values?.shippingMode ?? "domestic_truck");
  const [shipmentFamily, setShipmentFamily] = useState<EditShipmentFamily>(initial.shipmentFamily);
  const [direction, setDirection] = useState<ShipmentDirection | null>(initial.direction);
  const hasDirection = shipmentFamily === "ocean" || shipmentFamily === "air";
  const shippingMode = getShippingModeFromEditSelection(shipmentFamily, direction);

  function updateShipmentFamily(nextFamily: EditShipmentFamily) {
    setShipmentFamily(nextFamily);
    setDirection(nextFamily === "ocean" || nextFamily === "air" ? direction ?? "export" : null);
  }

  return <>
    <Section title="Shipment">
      {includeJobsheetNo ? <TextField defaultValue={values?.jobsheetNo} label="Jobsheet No" name="jobsheetNo" required /> : null}
      <label className="text-sm font-medium text-foreground" htmlFor="shipmentType">
        Shipment Type
        <select className={controlClassName} id="shipmentType" onChange={(event) => updateShipmentFamily(event.target.value as EditShipmentFamily)} value={shipmentFamily}>
          <option value="ocean">Ocean</option><option value="air">Air</option><option value="domestic">Domestic</option><option value="custom">Custom</option>
        </select>
      </label>
      {hasDirection ? <label className="text-sm font-medium text-foreground" htmlFor="shipmentDirection">
        Direction
        <select className={controlClassName} id="shipmentDirection" onChange={(event) => setDirection(event.target.value as ShipmentDirection)} value={direction ?? "export"}>
          <option value="export">Export</option><option value="import">Import</option>
        </select>
      </label> : null}
      <input name="shippingMode" type="hidden" value={shippingMode} />
    </Section>

    <Section title="Routing">
      {shipmentFamily === "ocean" ? <>
        <LocationSelector applicability={getShippingNoteLocationApplicability("ocean", "portOfLoading")} initialValue={values?.portOfLoading} label="POL" name="portOfLoading" required />
        <LocationSelector applicability={getShippingNoteLocationApplicability("ocean", "portOfDischarge")} initialValue={values?.portOfDischarge} label="POD" name="portOfDischarge" required />
        <div className="sm:col-span-2"><LocationSelector applicability={getShippingNoteLocationApplicability("ocean", "finalDestination")} initialValue={values?.finalDestination} label="Final Destination" name="finalDestination" required /></div>
      </> : null}
      {shipmentFamily === "air" ? <>
        <LocationSelector applicability={getShippingNoteLocationApplicability("air", "aol")} initialValue={values?.aol} label="AOL" name="aol" required />
        <LocationSelector applicability={getShippingNoteLocationApplicability("air", "aod")} initialValue={values?.aod} label="AOD" name="aod" required />
        <div className="sm:col-span-2"><LocationSelector applicability={getShippingNoteLocationApplicability("air", "finalDestination")} initialValue={values?.finalDestination} label="Final Destination" name="finalDestination" required /></div>
      </> : null}
      {shipmentFamily === "domestic" ? <>
        <LocationSelector applicability={getShippingNoteLocationApplicability("domestic", "domesticOrigin")} initialValue={values?.domesticOrigin} label="From" name="domesticOrigin" required />
        <LocationSelector applicability={getShippingNoteLocationApplicability("domestic", "domesticDestination")} initialValue={values?.domesticDestination} label="To" name="domesticDestination" required />
      </> : null}
      {shipmentFamily === "custom" ? <>
        <div className="sm:col-span-2"><TextField defaultValue={values?.customModeName} label="Mode" name="customModeName" required /></div>
        <LocationSelector applicability={getShippingNoteLocationApplicability("custom", "customOrigin")} initialValue={values?.customOrigin} label="From" name="customOrigin" />
        <LocationSelector applicability={getShippingNoteLocationApplicability("custom", "customDestination")} initialValue={values?.customDestination} label="To" name="customDestination" />
      </> : null}
    </Section>

    {shipmentFamily === "ocean" ? <Section title="Ocean Freight">
      <TextField defaultValue={values?.mblNo} label="MBL" name="mblNo" required />
      <TextField defaultValue={values?.hblNo} label="HBL" name="hblNo" required />
      <TextField defaultValue={values?.vesselName} label="Vessel" name="vesselName" required />
      <TextField defaultValue={values?.voyageNo} label="Voyage" name="voyageNo" required />
    </Section> : null}
    {shipmentFamily === "air" ? <Section title="Air Freight">
      <TextField defaultValue={values?.mawbNo} label="MAWB" name="mawbNo" required />
      <TextField defaultValue={values?.hawbNo} label="HAWB" name="hawbNo" required />
      <TextField defaultValue={values?.flightNo} label="Flight No" name="flightNo" required />
    </Section> : null}

    <Section title="Schedule">
      <label className="text-sm font-medium text-foreground" htmlFor="etd">ETD
        <input className={controlClassName} defaultValue={formatDatetimeLocalValue(values?.etd)} id="etd" name="etd" required={hasDirection} type="datetime-local" />
      </label>
      <label className="text-sm font-medium text-foreground" htmlFor="eta">ETA
        <input className={controlClassName} defaultValue={formatDatetimeLocalValue(values?.eta)} id="eta" name="eta" required={hasDirection} type="datetime-local" />
      </label>
    </Section>

    <Section title="Parties">
      <TextField defaultValue={values?.shipperText} label="Shipper" name="shipperText" />
      <TextField defaultValue={values?.consigneeText} label="Consignee" name="consigneeText" />
      <TextField defaultValue={values?.customerText} label="Customer" name="customerText" />
      <TextField defaultValue={values?.agentText} label="Agent" name="agentText" />
    </Section>

    <Section title="Shipment Details">
      <TextField defaultValue={values?.mawbHawbNo} label="Shipment Reference" name="mawbHawbNo" />
      <TextField defaultValue={values?.volumeValue} label="Volume Value" name="volumeValue" type="number" />
      <label className="text-sm font-medium text-foreground" htmlFor="volumeUnit">Volume Unit
        <select className={controlClassName} defaultValue={values?.volumeUnit ?? ""} id="volumeUnit" name="volumeUnit">
          <option value="">Select volume unit</option>
          {VOLUME_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-foreground" htmlFor="exchangeRate">Exchange Rate
        <input className={controlClassName} defaultValue={values?.exchangeRate ?? "1"} id="exchangeRate" min="0" name="exchangeRate" step="0.000001" type="number" />
      </label>
    </Section>
  </>;
}
