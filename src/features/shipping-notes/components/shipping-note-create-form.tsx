"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ShippingNoteActionResult } from "../actions";
import {
  SHIPPING_MODES,
  type ShippingMode,
  VOLUME_UNITS,
} from "../constants";
import { getShippingModePresentation } from "../mode-rules";
import {
  getShippingNoteCreateModeFields,
  SHIPPING_NOTE_PARTY_SELECTOR_FIELDS,
} from "./shipping-note-create-fields";
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
  const [mode, setMode] = useState<ShippingMode>(SHIPPING_MODES[0]);
  const presentation = getShippingModePresentation(mode);
  const modeFields = getShippingNoteCreateModeFields(presentation.family);

  return (
    <form action={formAction} className="grid gap-5">
      <Section title="General">
        <label className="text-sm font-medium text-foreground" htmlFor="jobsheetNo">
          Jobsheet No
          <input className={controlClassName} id="jobsheetNo" name="jobsheetNo" required type="text" />
        </label>
        <label className="text-sm font-medium text-foreground" htmlFor="shippingMode">
          Shipping Mode
          <select
            className={controlClassName}
            id="shippingMode"
            name="shippingMode"
            onChange={(event) => setMode(event.target.value as ShippingMode)}
            value={mode}
          >
            {SHIPPING_MODES.map((shippingMode) => (
              <option key={shippingMode} value={shippingMode}>
                {getShippingModePresentation(shippingMode).label}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Parties">
        {SHIPPING_NOTE_PARTY_SELECTOR_FIELDS.map((field) => (
          <PartnerSelector key={field.partnerFieldName} {...field} />
        ))}
      </Section>

      <Section title="Routing">
        {modeFields.routing.map((field) => <TextField key={field.name} {...field} />)}
      </Section>

      {modeFields.transport.length > 0 ? (
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
    </form>
  );
}
