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
      <ShippingNoteDraftFields values={values} includeJobsheetNo={includeJobsheetNo} />

      {state.ok ? null : (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
