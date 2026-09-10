"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  approveShippingNoteAction,
  lockShippingNoteAction,
  startAccountingReviewAction,
  markShippingNoteCheckedAction,
  unlockShippingNoteAction,
  type ShippingNoteActionResult,
} from "../actions";

const initialState: ShippingNoteActionResult = { ok: true };

type AccountingReviewControlsProps = {
  noteId: string;
  status: string;
  canStartReview: boolean;
  canMarkChecked: boolean;
  canApprove: boolean;
  canLock: boolean;
  canUnlock: boolean;
  markCheckedDisabledReason?: string | null;
};

function SubmitButton({
  children,
  pendingLabel,
  disabled,
  describedBy,
}: Readonly<{
  children: ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  describedBy?: string;
}>) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:bg-slate-950 dark:disabled:text-slate-600"
      type="submit"
      disabled={disabled || pending}
      aria-describedby={describedBy}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function AccountingReviewControls({
  noteId,
  status,
  canStartReview,
  canMarkChecked,
  canApprove,
  canLock,
  canUnlock,
  markCheckedDisabledReason,
}: AccountingReviewControlsProps) {
  const [startReviewState, startReviewAction] = useActionState(
    startAccountingReviewAction,
    initialState,
  );
  const [markCheckedState, markCheckedAction] = useActionState(
    markShippingNoteCheckedAction,
    initialState,
  );
  const [approveState, approveAction] = useActionState(
    approveShippingNoteAction,
    initialState,
  );
  const [lockState, lockAction] = useActionState(
    lockShippingNoteAction,
    initialState,
  );
  const [unlockState, unlockAction] = useActionState(
    unlockShippingNoteAction,
    initialState,
  );

  let statusLabel = status;
  if (status === "submitted") statusLabel = "Submitted";
  else if (status === "accounting_reviewing") statusLabel = "Accounting Reviewing";
  else if (status === "checked") statusLabel = "Checked";
  else if (status === "approved") statusLabel = "Approved";
  else if (status === "locked") statusLabel = "Closed";

  const showStartReview = status === "submitted" && canStartReview;
  const showMarkChecked = status === "accounting_reviewing" && canMarkChecked;
  const showApprove = status === "checked" && canApprove;
  const showClose = (status === "checked" || status === "approved") && canLock;
  const showUnlock = status === "locked" && canUnlock;
  const markCheckedDisabled = Boolean(markCheckedDisabledReason);

  return (
    <div className="rounded-md border border-border bg-muted/40 p-4">
      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Accounting Review</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300">Current status: {statusLabel}</p>
      </div>

      {showStartReview && (
        <form action={startReviewAction} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="id" value={noteId} />
          <SubmitButton pendingLabel="Starting...">
            Start Accounting Review
          </SubmitButton>
          {!startReviewState.ok && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {startReviewState.error}
            </p>
          )}
        </form>
      )}

      {showMarkChecked && (
        <form action={markCheckedAction} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="id" value={noteId} />
          <SubmitButton
            disabled={markCheckedDisabled}
            describedBy={markCheckedDisabled ? "mark-checked-disabled-reason" : undefined}
            pendingLabel="Marking..."
          >
            Mark Checked
          </SubmitButton>
          {markCheckedDisabledReason ? (
            <p
              id="mark-checked-disabled-reason"
              className="text-sm text-amber-800 dark:text-amber-300"
            >
              {markCheckedDisabledReason}
            </p>
          ) : null}
          {!markCheckedState.ok && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {markCheckedState.error}
            </p>
          )}
        </form>
      )}

      {showApprove && (
        <form action={approveAction} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="id" value={noteId} />
          <SubmitButton pendingLabel="Approving...">
            Approve
          </SubmitButton>
          {!approveState.ok && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {approveState.error}
            </p>
          )}
        </form>
      )}

      {showClose && (
        <form action={lockAction} className="mt-4 flex flex-col gap-3 rounded-md border border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <input type="hidden" name="id" value={noteId} />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Close Shipping Note
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Close this Shipping Note? After closing, it can no longer be edited.
            </p>
          </div>
          <label
            className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200"
            htmlFor="lockReason"
          >
            Close reason (optional)
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              id="lockReason"
              name="lockReason"
              placeholder="Optional"
              type="text"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
              name="closeConfirmation"
              required
              type="checkbox"
              value="confirmed"
            />
            Confirm close: after closing, this note can no longer be edited
          </label>
          <SubmitButton pendingLabel="Closing...">
            Close Shipping Note
          </SubmitButton>
          {!lockState.ok && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {lockState.error}
            </p>
          )}
        </form>
      )}

      {showUnlock && (
        <form action={unlockAction} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="id" value={noteId} />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Unlock is a privileged override. Confirm the reason before submitting.
          </p>
          <label
            className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200"
            htmlFor="unlockReason"
          >
            Unlock reason
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              id="unlockReason"
              name="unlockReason"
              required
              type="text"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
              name="unlockConfirmation"
              required
              type="checkbox"
              value="confirmed"
            />
            Confirm unlock
          </label>
          <SubmitButton pendingLabel="Unlocking...">
            Unlock
          </SubmitButton>
          {!unlockState.ok && (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {unlockState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
