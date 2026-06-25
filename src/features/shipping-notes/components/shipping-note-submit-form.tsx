"use client";

import { useActionState } from "react";

import type { ShippingNoteActionResult } from "../actions";

type SubmitFormAction = (
  state: ShippingNoteActionResult,
  formData: FormData,
) => Promise<ShippingNoteActionResult>;

type ShippingNoteSubmitFormProps = {
  action: SubmitFormAction;
  noteId: string;
  submitLabel: string;
};

const initialState: ShippingNoteActionResult = { ok: true };

export function ShippingNoteSubmitForm({
  action,
  noteId,
  submitLabel,
}: ShippingNoteSubmitFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form className="flex flex-col gap-3" action={formAction}>
      <input type="hidden" name="id" value={noteId} />
      {state.ok ? null : (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}
