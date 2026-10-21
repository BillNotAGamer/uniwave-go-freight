"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  issueShippingNoteEditGrantAction,
  revokeShippingNoteEditGrantAction,
  type ShippingNoteActionResult,
} from "../actions";
import type {
  ShippingNoteEditGrantRecipient,
  ShippingNoteEditGrantView,
} from "../types";

const initialState: ShippingNoteActionResult = { ok: true };

function formatAuditTimestamp(value: Date): string {
  return value.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function RevokeGrantForm({ grant }: { grant: ShippingNoteEditGrantView }) {
  const [state, action] = useActionState(revokeShippingNoteEditGrantAction, initialState);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input name="shippingNoteId" type="hidden" value={grant.shippingNoteId} />
      <input name="grantId" type="hidden" value={grant.id} />
      <label className="text-xs font-medium text-muted-foreground">
        Revocation reason (optional)
        <input
          className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
          maxLength={500}
          name="reason"
        />
      </label>
      <div className="self-end">
        <SubmitButton label="Revoke" pendingLabel="Revoking..." />
      </div>
      {!state.ok ? <p className="text-sm text-red-700 sm:col-span-2" role="alert">{state.error}</p> : null}
    </form>
  );
}

export function EditGrantControls({
  shippingNoteId,
  recipients,
  history,
}: {
  shippingNoteId: string;
  recipients: ShippingNoteEditGrantRecipient[];
  history: ShippingNoteEditGrantView[];
}) {
  const [state, action] = useActionState(issueShippingNoteEditGrantAction, initialState);
  const activeGrant = history.find((grant) => grant.status === "active");

  return (
    <section className="grid gap-4 border-t border-border pt-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Delegated access</p>
        <h2 className="text-lg font-semibold text-foreground">Post-submit edit grant</h2>
        <p className="text-sm text-muted-foreground">
          Grants are note-specific, recipient-specific, and cannot edit selling or buying charges.
          They stop being effective when this note is Closed.
        </p>
      </div>

      {activeGrant ? (
        <div className="grid gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-foreground">
            Active for <strong>{activeGrant.recipientName}</strong> ({activeGrant.recipientRole}),
            issued by {activeGrant.grantedByName ?? activeGrant.grantedById ?? "Unknown user"}.
          </p>
          <RevokeGrantForm grant={activeGrant} />
        </div>
      ) : recipients.length > 0 ? (
        <form action={action} className="grid max-w-2xl gap-3 rounded-md border border-border p-4">
          <input name="shippingNoteId" type="hidden" value={shippingNoteId} />
          <label className="text-sm font-medium text-foreground">
            Recipient
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3" name="recipientUserId" required>
              <option value="">Select the note owner</option>
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.name} — {recipient.role} ({recipient.email})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-foreground">
            Grant reason (optional)
            <textarea className="mt-1 min-h-20 w-full rounded-md border border-input bg-card p-3" maxLength={500} name="reason" />
          </label>
          <SubmitButton label="Grant edit access" pendingLabel="Granting..." />
          {!state.ok ? <p className="text-sm text-red-700" role="alert">{state.error}</p> : null}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">No eligible active Sale/OPS owner is available for this note.</p>
      )}

      {history.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Recipient</th><th className="p-3">Granted by</th><th className="p-3">Granted</th><th className="p-3">Status</th><th className="p-3">Revoked by</th></tr>
            </thead>
            <tbody>
              {history.map((grant) => (
                <tr className="border-t border-border" key={grant.id}>
                  <td className="p-3">{grant.recipientName} ({grant.recipientRole})</td>
                  <td className="p-3">{grant.grantedByName ?? grant.grantedById ?? "-"}</td>
                  <td className="p-3">{formatAuditTimestamp(grant.grantedAt)}</td>
                  <td className="p-3">{grant.status}</td>
                  <td className="p-3">{grant.revokedByName ?? grant.revokedById ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
