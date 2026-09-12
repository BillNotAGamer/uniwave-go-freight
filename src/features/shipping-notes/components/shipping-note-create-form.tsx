"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plane, Ship, SlidersHorizontal, Truck } from "lucide-react";

import type { ShippingNoteActionResult } from "../actions";
import {
  type ShippingMode,
  VOLUME_UNITS,
} from "../constants";
import {
  SHIPMENT_TYPE_CARDS,
  SHIPPING_MODES_BY_SHIPMENT_TYPE,
  SHIPPING_NOTE_CREATE_INTAKE_COPY,
  type ShipmentType,
} from "./shipping-note-create-intake";
import {
  getShippingNoteCreateModeFieldsForShipmentType,
  SHIPPING_NOTE_PARTY_SELECTOR_FIELDS,
} from "./shipping-note-create-fields";
import {
  getShippingNoteLocationApplicability,
  LocationSelector,
} from "./location-selector";
import { PartnerSelector } from "./partner-selector";

type CreateFormAction = (
  state: ShippingNoteActionResult,
  formData: FormData,
) => Promise<ShippingNoteActionResult>;

const initialState: ShippingNoteActionResult = { ok: true };
const controlClassName =
  "mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function TextField({ name, label }: { name: string; label: string }) {
  return (
    <label className="text-sm font-medium text-foreground" htmlFor={name}>
      {label}
      <input className={controlClassName} id={name} name={name} type="text" />
    </label>
  );
}

const shipmentTypeIcons = {
  ocean: Ship,
  air: Plane,
  domestic: Truck,
  custom: SlidersHorizontal,
} as const;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Creating…" : "Create Shipping Note"}
    </button>
  );
}

export function ShippingNoteCreateForm({ action }: { action: CreateFormAction }) {
  const [state, formAction] = useActionState(action, initialState);
  const [shipmentType, setShipmentType] = useState<ShipmentType | null>(null);
  const [mode, setMode] = useState<ShippingMode | "">("");
  const modeFields = shipmentType
    ? getShippingNoteCreateModeFieldsForShipmentType(shipmentType)
    : null;

  function selectShipmentType(type: ShipmentType) {
    setShipmentType(type);
    setMode(type === "domestic" ? "domestic_truck" : type === "custom" ? "custom" : "");
  }

  return (
    <form action={formAction} className="grid gap-5">
      <section aria-labelledby="shipment-type-heading" className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground" id="shipment-type-heading">
            {SHIPPING_NOTE_CREATE_INTAKE_COPY.prompt}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Select the transport type for this shipment.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SHIPMENT_TYPE_CARDS.map((card) => {
            const Icon = shipmentTypeIcons[card.type];
            const isSelected = shipmentType === card.type;

            return (
              <button
                aria-pressed={isSelected}
                className={`flex min-h-28 items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/40 hover:bg-muted/40"}`}
                data-selected={isSelected ? "true" : "false"}
                disabled={!card.available}
                key={card.type}
                onClick={() => selectShipmentType(card.type)}
                type="button"
              >
                <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{card.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{card.description}</span>
                  {isSelected ? <span className="mt-2 block text-xs font-medium text-foreground">Selected</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {shipmentType ? <>
      <Section title="General">
        <label className="text-sm font-medium text-foreground" htmlFor="jobsheetNo">
          Jobsheet No
          <input className={controlClassName} id="jobsheetNo" name="jobsheetNo" required type="text" />
        </label>
        {shipmentType === "domestic" || shipmentType === "custom" ? <input name="shippingMode" type="hidden" value={mode} /> : (
        <label className="text-sm font-medium text-foreground" htmlFor="shippingMode">
          Shipment direction
          <select
            className={controlClassName}
            id="shippingMode"
            name="shippingMode"
            onChange={(event) => setMode(event.target.value as ShippingMode)}
            required
            value={mode}
          >
            <option value="">Select direction</option>
            {SHIPPING_MODES_BY_SHIPMENT_TYPE[shipmentType].map((shippingMode) => (
              <option key={shippingMode} value={shippingMode}>
                {shippingMode.endsWith("_export") ? "Export" : "Import"}
              </option>
            ))}
          </select>
        </label>
        )}
      </Section>

      {shipmentType === "custom" ? <Section title="Custom Mode">
        <TextField name="customModeName" label="Mode" />
      </Section> : null}

      <Section title="Parties">
        {SHIPPING_NOTE_PARTY_SELECTOR_FIELDS.map((field) => (
          <PartnerSelector key={field.partnerFieldName} {...field} />
        ))}
      </Section>

      {modeFields ? <Section title="Routing">
        {modeFields.routing.map((field) => (
          <LocationSelector
            applicability={getShippingNoteLocationApplicability(shipmentType!, field.name)}
            key={field.name}
            label={field.label}
            name={field.name}
            required
          />
        ))}
      </Section> : null}

      {modeFields && modeFields.transport.length > 0 ? (
        <Section title="Transport Documents">
          {modeFields.transport.map((field) => <TextField key={field.name} {...field} />)}
        </Section>
      ) : null}

      <Section title="Schedule & Cargo">
        <label className="text-sm font-medium text-foreground" htmlFor="etd">
          ETD
          <input className={controlClassName} id="etd" name="etd" type="datetime-local" />
        </label>
        <label className="text-sm font-medium text-foreground" htmlFor="eta">
          ETA
          <input className={controlClassName} id="eta" name="eta" type="datetime-local" />
        </label>
        <label className="text-sm font-medium text-foreground" htmlFor="volumeValue">
          Volume Value
          <input className={controlClassName} id="volumeValue" min="0" name="volumeValue" step="0.001" type="number" />
        </label>
        <label className="text-sm font-medium text-foreground" htmlFor="volumeUnit">
          Volume Unit
          <select className={controlClassName} id="volumeUnit" name="volumeUnit" defaultValue="">
            <option value="">Select volume unit</option>
            {VOLUME_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>
      </Section>

      <Section title="Financial">
        <label className="text-sm font-medium text-foreground" htmlFor="exchangeRate">
          Exchange Rate
          <input className={controlClassName} defaultValue="1" id="exchangeRate" min="0" name="exchangeRate" step="0.000001" type="number" />
        </label>
      </Section>

      {state.ok ? null : <p className="text-sm text-red-700 dark:text-red-400" role="alert">{state.error}</p>}

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Link className="inline-flex h-10 items-center px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/shipping-notes">
          Cancel
        </Link>
        <SubmitButton />
      </div>
      </> : null}
    </form>
  );
}
