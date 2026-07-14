"use client";

import { useActionState } from "react";

import {
  startAccountingReviewAction,
  markShippingNoteCheckedAction,
  type ShippingNoteActionResult,
} from "../actions";

const initialState: ShippingNoteActionResult = { ok: true };

type AccountingReviewControlsProps = {
  noteId: string;
  status: string;
  canStartReview: boolean;
  canMarkChecked: boolean;
};

export function AccountingReviewControls({
  noteId,
  status,
  canStartReview,
  canMarkChecked,
}: AccountingReviewControlsProps) {
  const [startReviewState, startReviewAction] = useActionState(
    startAccountingReviewAction,
    initialState,
  );
  const [markCheckedState, markCheckedAction] = useActionState(
    markShippingNoteCheckedAction,
    initialState,
  );

  let statusLabel = status;
  if (status === "submitted") statusLabel = "Submitted";
  else if (status === "accounting_reviewing") statusLabel = "Accounting Reviewing";
  else if (status === "checked") statusLabel = "Checked";

  const showStartReview = status === "submitted" && canStartReview;
  const showMarkChecked = status === "accounting_reviewing" && canMarkChecked;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Accounting Review</h3>
        <p className="text-sm text-slate-700">Current status: {statusLabel}</p>
      </div>

      {showStartReview && (
        <form action={startReviewAction} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="id" value={noteId} />
          <button
            className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            type="submit"
          >
            Start Accounting Review
          </button>
          {!startReviewState.ok && (
            <p className="text-sm text-red-700" role="alert">
              {startReviewState.error}
            </p>
          )}
        </form>
      )}

      {showMarkChecked && (
        <form action={markCheckedAction} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="id" value={noteId} />
          <button
            className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            type="submit"
          >
            Mark Checked
          </button>
          {!markCheckedState.ok && (
            <p className="text-sm text-red-700" role="alert">
              {markCheckedState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
