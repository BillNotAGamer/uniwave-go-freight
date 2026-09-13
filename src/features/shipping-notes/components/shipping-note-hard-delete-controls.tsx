"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  hardDeleteShippingNoteAction,
  type ShippingNoteActionResult,
} from "../actions";

const initialState: ShippingNoteActionResult = { ok: true };

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      type="submit"
      disabled={pending}
    >
      {pending ? "Deleting..." : "Delete permanently"}
    </button>
  );
}

export function ShippingNoteHardDeleteControls({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    hardDeleteShippingNoteAction,
    initialState,
  );

  return (
    <section className="grid gap-3 border-t border-red-200 pt-6 dark:border-red-950/70">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-400">
          Danger Zone
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Delete Shipping Note</h2>
        <p className="text-sm text-muted-foreground">
          This Admin-only action permanently removes the Shipping Note, its dependent data, and private document/export artifacts.
        </p>
      </div>
      <div>
        <button
          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          type="button"
          onClick={() => setOpen(true)}
        >
          Delete permanently
        </button>
      </div>
      {open ? (
        <div
          aria-labelledby="hard-delete-shipping-note-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
        >
          <form action={formAction} className="grid w-full max-w-md gap-4 rounded-lg border border-red-300 bg-card p-5 shadow-xl dark:border-red-900/70">
            <input name="id" type="hidden" value={noteId} />
            <div className="space-y-2">
              <h3 id="hard-delete-shipping-note-title" className="text-base font-semibold text-foreground">
                Permanently delete this Shipping Note?
              </h3>
              <p className="text-sm text-muted-foreground">
                This cannot be undone. Charges, document/export metadata, and the corresponding private artifacts will be removed. Audit history remains.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-foreground" htmlFor="hard-delete-shipping-note-reason">
              Delete reason
              <textarea
                id="hard-delete-shipping-note-reason"
                name="reason"
                required
                maxLength={500}
                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
              />
            </label>
            {!state.ok ? <p className="text-sm text-red-700 dark:text-red-400" role="alert">{state.error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-1.5 text-sm"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <ConfirmDeleteButton />
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
