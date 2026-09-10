"use client";

import { useActionState } from "react";

import type { ShippingNoteActionResult } from "../actions";
import { ShippingNoteDraftFields } from "./shipping-note-draft-fields";
import type { ShippingNoteDetail } from "../types";

type DraftFormAction = (
  state: ShippingNoteActionResult,
  formData: FormData,
) => Promise<ShippingNoteActionResult>;

type ShippingNoteDraftFormProps = {
  action: DraftFormAction;
  submitLabel: string;
  values?: Partial<ShippingNoteDetail>;
  includeJobsheetNo?: boolean;
  hiddenId?: string;
};

const initialState: ShippingNoteActionResult = { ok: true };

export function ShippingNoteDraftForm({
  action,
  submitLabel,
  values,
  includeJobsheetNo = true,
  hiddenId,
}: ShippingNoteDraftFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form className="grid gap-4" action={formAction}>
      {hiddenId ? <input type="hidden" name="id" value={hiddenId} /> : null}
      {values?.shipperPartnerId ? (
        <input type="hidden" name="shipperPartnerId" value={values.shipperPartnerId} />
      ) : null}
      {values?.consigneePartnerId ? (
        <input type="hidden" name="consigneePartnerId" value={values.consigneePartnerId} />
      ) : null}
      {values?.customerPartnerId ? (
        <input type="hidden" name="customerPartnerId" value={values.customerPartnerId} />
      ) : null}
      {values?.agentPartnerId ? (
        <input type="hidden" name="agentPartnerId" value={values.agentPartnerId} />
      ) : null}
      {values?.domesticOrigin ? (
        <input type="hidden" name="domesticOrigin" value={values.domesticOrigin} />
      ) : null}
      {values?.domesticDestination ? (
        <input type="hidden" name="domesticDestination" value={values.domesticDestination} />
      ) : null}
      {values?.portOfLoading ? (
        <input type="hidden" name="portOfLoading" value={values.portOfLoading} />
      ) : null}
      {values?.portOfDischarge ? (
        <input type="hidden" name="portOfDischarge" value={values.portOfDischarge} />
      ) : null}
      {values?.mawbNo ? <input type="hidden" name="mawbNo" value={values.mawbNo} /> : null}
      {values?.hawbNo ? <input type="hidden" name="hawbNo" value={values.hawbNo} /> : null}
      {values?.mblNo ? <input type="hidden" name="mblNo" value={values.mblNo} /> : null}
      {values?.hblNo ? <input type="hidden" name="hblNo" value={values.hblNo} /> : null}
      {values?.flightNo ? (
        <input type="hidden" name="flightNo" value={values.flightNo} />
      ) : null}
      {values?.vesselName ? (
        <input type="hidden" name="vesselName" value={values.vesselName} />
      ) : null}
      {values?.voyageNo ? (
        <input type="hidden" name="voyageNo" value={values.voyageNo} />
      ) : null}
      <ShippingNoteDraftFields values={values} includeJobsheetNo={includeJobsheetNo} />

      {state.ok ? null : (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
