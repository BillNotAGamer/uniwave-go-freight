"use client";

import Link from "next/link";
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
      <ShippingNoteDraftFields values={values} includeJobsheetNo={includeJobsheetNo} />

      {state.ok ? null : (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Link
          className="inline-flex h-10 items-center px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/shipping-notes"
        >
          Cancel
        </Link>
        <button
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
