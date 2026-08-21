"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ShippingNoteStatus } from "../constants";
import {
  cancelFinalizedShippingNoteAction,
  cancelShippingNoteAction,
  type ShippingNoteActionResult,
} from "../actions";

const initialState: ShippingNoteActionResult = { ok: true };

type CancellationControlsProps = {
  noteId: string;
  status: ShippingNoteStatus;
  canCancelNormal: boolean;
  canCancelFinalized: boolean;
  reasonRequired: boolean;
  showLockedGuidance: boolean;
};

function CancellationSubmitButton({
  label,
}: Readonly<{
  label: string;
}>) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center justify-center rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      disabled={pending}
      type="submit"
    >
      {pending ? "Cancelling..." : label}
    </button>
  );
}

export function CancellationControls({
  noteId,
  status,
  canCancelNormal,
  canCancelFinalized,
  reasonRequired,
  showLockedGuidance,
}: CancellationControlsProps) {
  const [normalState, normalAction] = useActionState(
    cancelShippingNoteAction,
    initialState,
  );
  const [finalizedState, finalizedAction] = useActionState(
    cancelFinalizedShippingNoteAction,
    initialState,
  );

  const canCancel = canCancelNormal || canCancelFinalized;
  const action = canCancelFinalized ? finalizedAction : normalAction;
  const state = canCancelFinalized ? finalizedState : normalState;
  const buttonLabel = status === "draft" ? "Cancel Draft" : "Cancel Shipping Note";

  return (
    <section className="grid gap-4 border-t border-red-100 pt-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
          Cancellation
        </p>
        <h2 className="text-lg font-semibold tracking-tight">Cancel Shipping Note</h2>
        {showLockedGuidance ? (
          <p className="text-sm text-slate-600">
            Locked notes must be unlocked before cancellation.
          </p>
        ) : null}
      </div>

      {canCancel ? (
        <form action={action} className="grid max-w-xl gap-3">
          <input name="id" type="hidden" value={noteId} />
          <input name="expectedStatus" type="hidden" value={status} />
          <label
            className="flex flex-col gap-1 text-sm font-medium text-slate-700"
            htmlFor="cancelReason"
          >
            Cancellation reason
            <textarea
              className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm"
              id="cancelReason"
              name="cancelReason"
              placeholder={reasonRequired ? "Required" : "Optional"}
              required={reasonRequired}
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              name="cancelConfirmation"
              required
              type="checkbox"
              value="confirmed"
            />
            <span>
              This will mark the Shipping Note as Cancelled. The record and
              history will be preserved. New internal exports will be blocked.
            </span>
          </label>
          <CancellationSubmitButton label={buttonLabel} />
          {!state.ok ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
