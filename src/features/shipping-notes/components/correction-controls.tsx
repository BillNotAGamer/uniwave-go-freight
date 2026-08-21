"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ShippingNoteStatus } from "../constants";
import {
  reopenShippingNoteForCorrectionAction,
  type ShippingNoteActionResult,
} from "../actions";

const initialState: ShippingNoteActionResult = { ok: true };

type CorrectionControlsProps = {
  noteId: string;
  status: Extract<ShippingNoteStatus, "checked" | "approved">;
};

function ReopenSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      disabled={pending}
      type="submit"
    >
      {pending ? "Reopening..." : "Reopen for Correction"}
    </button>
  );
}

export function CorrectionControls({
  noteId,
  status,
}: CorrectionControlsProps) {
  const [state, action] = useActionState(
    reopenShippingNoteForCorrectionAction,
    initialState,
  );

  return (
    <section className="grid gap-4 border-t border-amber-100 pt-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Accounting Correction
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          Reopen for Accounting Correction
        </h2>
        <p className="text-sm text-slate-600">
          Reopening moves this Shipping Note back to Accounting Reviewing.
          Current Checked or Approved finalization will be cleared. Historical
          exports and audit history will be preserved.
        </p>
      </div>

      <form action={action} className="grid max-w-xl gap-3">
        <input name="id" type="hidden" value={noteId} />
        <input name="expectedStatus" type="hidden" value={status} />
        <label
          className="flex flex-col gap-1 text-sm font-medium text-slate-700"
          htmlFor="reopenReason"
        >
          Correction reason
          <textarea
            className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm"
            id="reopenReason"
            name="reason"
            placeholder="Required"
            required
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
            name="reopenConfirmation"
            required
            type="checkbox"
            value="confirmed"
          />
          <span>
            Confirm this Shipping Note should return to Accounting Reviewing
            for correction.
          </span>
        </label>
        <ReopenSubmitButton />
        {!state.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
