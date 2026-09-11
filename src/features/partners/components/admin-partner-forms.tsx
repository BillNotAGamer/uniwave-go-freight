"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import type { PartnerCategoryDetail, BusinessPartnerDetail } from "../types";
import {
  addPartnerContactAdminAction,
  createPartnerAdminAction,
  deactivatePartnerAdminAction,
  reactivatePartnerAdminAction,
  removePartnerContactAdminAction,
  setPartnerCategoriesAdminAction,
  updatePartnerAdminAction,
  updatePartnerContactAdminAction,
  type PartnerAdminActionResult,
} from "../actions";

const initialActionState: PartnerAdminActionResult = { ok: true };

const inputClassName = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20";

function SubmitButton({
  children,
  pendingLabel,
  tone = "secondary",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const className = {
    primary: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500",
    secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    danger: "border-red-600 bg-red-600 text-white hover:bg-red-500",
  }[tone];

  return (
    <button
      className={`inline-flex w-fit items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function ActionMessage({ state }: { state: PartnerAdminActionResult }) {
  if (!state.ok) {
    return <p className="mt-3 text-sm text-red-700 dark:text-red-400" role="alert">{state.error}</p>;
  }

  return state.message
    ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">{state.message}</p>
    : null;
}

function PartnerFields({ partner }: { partner?: BusinessPartnerDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
        Company Name
        <input className={inputClassName} defaultValue={partner?.companyName} name="companyName" required />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Vendor Code
        <input className={inputClassName} defaultValue={partner?.vendorCode ?? ""} name="vendorCode" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Tax ID / MST
        <input className={inputClassName} defaultValue={partner?.taxId ?? ""} name="taxId" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
        Address
        <textarea className={inputClassName} defaultValue={partner?.address ?? ""} name="address" rows={3} />
      </label>
    </div>
  );
}

function CategoryChoices({
  categories,
  assignedCodes = [],
}: {
  categories: PartnerCategoryDetail[];
  assignedCodes?: string[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {categories.map((category) => (
        <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm" key={category.id}>
          <input defaultChecked={assignedCodes.includes(category.code)} name="categoryCodes" type="checkbox" value={category.code} />
          <span>
            <span className="block font-medium text-foreground">{category.name}</span>
            {category.description ? <span className="block text-xs text-muted-foreground">{category.description}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function CreatePartnerForm({ categories }: { categories: PartnerCategoryDetail[] }) {
  const router = useRouter();
  const [state, action] = useActionState(createPartnerAdminAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.partnerId) router.push(`/admin/master-data/partners/${state.partnerId}`);
  }, [router, state.ok, state.partnerId]);

  return (
    <form action={action} className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm">
      <PartnerFields />
      {categories.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Operational categories</legend>
          <CategoryChoices categories={categories} />
        </fieldset>
      ) : null}
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Creating..." tone="primary">Create Partner</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function EditPartnerForm({ partner }: { partner: BusinessPartnerDetail }) {
  const [state, action] = useActionState(updatePartnerAdminAction, initialActionState);
  return (
    <form action={action} className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
      <input name="id" type="hidden" value={partner.id} />
      <PartnerFields partner={partner} />
      <SubmitButton pendingLabel="Saving..." tone="primary">Save Partner Details</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

export function PartnerCategoriesForm({
  categories,
  partner,
}: {
  categories: PartnerCategoryDetail[];
  partner: BusinessPartnerDetail;
}) {
  const [state, action] = useActionState(setPartnerCategoriesAdminAction, initialActionState);
  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
      <input name="partnerId" type="hidden" value={partner.id} />
      <div>
        <h2 className="font-semibold text-foreground">Operational categories</h2>
        <p className="mt-1 text-sm text-muted-foreground">Assign existing categories only.</p>
      </div>
      <CategoryChoices categories={categories} assignedCodes={partner.categories.map((category) => category.code)} />
      <SubmitButton pendingLabel="Saving...">Save Categories</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

function AddContactForm({ partnerId }: { partnerId: string }) {
  const [state, action] = useActionState(addPartnerContactAdminAction, initialActionState);
  return (
    <form action={action} className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-4 md:items-end">
      <input name="partnerId" type="hidden" value={partnerId} />
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">PIC name<input className={inputClassName} name="picName" /></label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Email<input className={inputClassName} name="email" type="email" /></label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Phone<input className={inputClassName} name="phone" /></label>
      <SubmitButton pendingLabel="Adding...">Add Contact</SubmitButton>
      <div className="md:col-span-4"><ActionMessage state={state} /></div>
    </form>
  );
}

function ContactRow({ contact, partnerId }: { contact: BusinessPartnerDetail["contacts"][number]; partnerId: string }) {
  const [updateState, updateAction] = useActionState(updatePartnerContactAdminAction, initialActionState);
  const [removeState, removeAction] = useActionState(removePartnerContactAdminAction, initialActionState);
  return (
    <div className="rounded-md border border-border p-4">
      <form action={updateAction} className="grid gap-3 md:grid-cols-4 md:items-end">
        <input name="id" type="hidden" value={contact.id} />
        <input name="partnerId" type="hidden" value={partnerId} />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">PIC name<input className={inputClassName} defaultValue={contact.picName ?? ""} name="picName" /></label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Email<input className={inputClassName} defaultValue={contact.email ?? ""} name="email" type="email" /></label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Phone<input className={inputClassName} defaultValue={contact.phone ?? ""} name="phone" /></label>
        <SubmitButton pendingLabel="Saving...">Save Contact</SubmitButton>
      </form>
      <form action={removeAction} className="mt-3 flex items-center gap-3">
        <input name="id" type="hidden" value={contact.id} />
        <input name="partnerId" type="hidden" value={partnerId} />
        <SubmitButton pendingLabel="Removing..." tone="danger">Remove Contact</SubmitButton>
      </form>
      <ActionMessage state={updateState} />
      <ActionMessage state={removeState} />
    </div>
  );
}

export function PartnerContactsPanel({ partner }: { partner: BusinessPartnerDetail }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="font-semibold text-foreground">Contacts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage active contact records for this Partner.</p>
      </div>
      {partner.contacts.map((contact) => <ContactRow contact={contact} key={contact.id} partnerId={partner.id} />)}
      <AddContactForm partnerId={partner.id} />
    </section>
  );
}

export function PartnerLifecycleControls({ partner }: { partner: BusinessPartnerDetail }) {
  const isDeactivated = !partner.isActive || partner.deletedAt !== null;
  const [deactivateState, deactivateAction] = useActionState(deactivatePartnerAdminAction, initialActionState);
  const [reactivateState, reactivateAction] = useActionState(reactivatePartnerAdminAction, initialActionState);

  if (isDeactivated) {
    return (
      <form action={reactivateAction} className="rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
        <input name="id" type="hidden" value={partner.id} />
        <h2 className="font-semibold text-foreground">Partner is deactivated</h2>
        <p className="mt-1 text-sm text-muted-foreground">Reactivating makes this Partner available to normal Partner search again.</p>
        <div className="mt-4"><SubmitButton pendingLabel="Reactivating..." tone="primary">Reactivate Partner</SubmitButton></div>
        <ActionMessage state={reactivateState} />
      </form>
    );
  }

  return (
    <form action={deactivateAction} className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/30">
      <input name="id" type="hidden" value={partner.id} />
      <h2 className="font-semibold text-foreground">Deactivate Partner</h2>
      <p className="mt-1 text-sm text-muted-foreground">This soft-deactivates the Partner. Historical Shipping Notes are not changed.</p>
      <label className="mt-4 flex items-center gap-2 text-sm text-foreground"><input name="confirmation" type="checkbox" value="confirmed" /> I understand this Partner will no longer appear in Shipping Note Partner lookup.</label>
      <div className="mt-4"><SubmitButton pendingLabel="Deactivating..." tone="danger">Deactivate Partner</SubmitButton></div>
      <ActionMessage state={deactivateState} />
    </form>
  );
}
