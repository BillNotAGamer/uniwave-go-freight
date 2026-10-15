"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  duplicateShippingNoteAction,
  type ShippingNoteActionResult,
} from "../actions";

const initialState: ShippingNoteActionResult = { ok: true };

function DuplicateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      type="submit"
      disabled={pending}
    >
      {pending ? "Duplicating..." : "Create Draft copy"}
    </button>
  );
}

export function DuplicateShippingNoteControls({
  sourceId,
  sourceJobsheetNo,
}: {
  sourceId: string;
  sourceJobsheetNo: string;
}) {
  const [state, formAction] = useActionState(
    duplicateShippingNoteAction,
    initialState,
  );

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          type="button"
        >
          Duplicate
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-card p-5 shadow-xl">
          <div className="space-y-2">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Duplicate Shipping Note
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Create a new Draft from {sourceJobsheetNo}. Enter a unique Jobsheet No.
            </Dialog.Description>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Operational shipment details are copied. Charges, documents, exports,
            approvals, workflow history, and audit history are not copied. The new
            Draft uses the standard exchange-rate default, so review it before use.
          </div>

          <form action={formAction} className="grid gap-4">
            <input name="sourceId" type="hidden" value={sourceId} />
            <label
              className="grid gap-1 text-sm font-medium text-foreground"
              htmlFor="duplicate-shipping-note-jobsheet"
            >
              New Jobsheet No.
              <input
                id="duplicate-shipping-note-jobsheet"
                name="newJobsheetNo"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
                required
                autoComplete="off"
              />
            </label>

            {!state.ok ? (
              <p className="text-sm text-red-700 dark:text-red-400" role="alert">
                {state.error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                  type="button"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <DuplicateSubmitButton />
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
