"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  createRoutingLocationAdminAction,
  deactivateRoutingLocationAdminAction,
  restoreRoutingLocationAdminAction,
  updateRoutingLocationAdminAction,
  type LocationAdminActionResult,
} from "../actions";
import {
  ROUTING_LOCATION_APPLICABILITIES,
  ROUTING_LOCATION_TYPES,
  type RoutingLocationApplicability,
} from "../constants";
import type { RoutingLocationDetail } from "../types";

const initialState: LocationAdminActionResult = { ok: true };
const inputClassName = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20";

const typeLabels: Record<(typeof ROUTING_LOCATION_TYPES)[number], string> = {
  airport: "Airport",
  seaport: "Seaport",
  inland: "Inland",
  other: "Other",
};

const applicabilityGroups: Array<{
  label: string;
  options: Array<{ value: RoutingLocationApplicability; label: string }>;
}> = [
  { label: "Ocean", options: [{ value: "sea_pol", label: "POL" }, { value: "sea_pod", label: "POD" }, { value: "sea_final_destination", label: "Final Destination" }] },
  { label: "Air", options: [{ value: "air_aol", label: "AOL" }, { value: "air_aod", label: "AOD" }, { value: "air_final_destination", label: "Final Destination" }] },
  { label: "Domestic", options: [{ value: "domestic_origin", label: "From" }, { value: "domestic_destination", label: "To" }] },
  { label: "Custom", options: [{ value: "custom_origin", label: "From" }, { value: "custom_destination", label: "To" }] },
];

function SubmitButton({ children, pendingLabel, tone = "secondary" }: { children: React.ReactNode; pendingLabel: string; tone?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500",
    secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    danger: "border-red-600 bg-red-600 text-white hover:bg-red-500",
  }[tone];
  return <button className={`inline-flex rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${styles}`} disabled={pending} type="submit">{pending ? pendingLabel : children}</button>;
}

function ActionMessage({ state }: { state: LocationAdminActionResult }) {
  if (!state.ok) return <p className="mt-3 text-sm text-red-700 dark:text-red-400" role="alert">{state.error}</p>;
  return state.message ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">{state.message}</p> : null;
}

function LocationFields({ location }: { location?: RoutingLocationDetail }) {
  return <div className="grid gap-4 md:grid-cols-2">
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Code<input className={inputClassName} defaultValue={location?.code ?? ""} name="code" placeholder="Stored in uppercase" required /></label>
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Location Type<select className={inputClassName} defaultValue={location?.type ?? ""} name="type" required><option disabled value="">Select type</option>{ROUTING_LOCATION_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">Name<input className={inputClassName} defaultValue={location?.name ?? ""} name="name" required /></label>
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Country Code<input className={inputClassName} defaultValue={location?.countryCode ?? ""} name="countryCode" placeholder="Optional; stored in uppercase" /></label>
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Subdivision<input className={inputClassName} defaultValue={location?.subdivision ?? ""} name="subdivision" placeholder="Optional city, province, state, or region" /></label>
  </div>;
}

function ApplicabilityChoices({ selected = [] }: { selected?: RoutingLocationApplicability[] }) {
  return <fieldset className="space-y-3"><legend className="text-sm font-medium text-foreground">Shipping Note usage</legend><p className="text-sm text-muted-foreground">Select every context where this Location may be used. Type does not select these automatically.</p><div className="grid gap-3 md:grid-cols-2">{applicabilityGroups.map((group) => <div className="rounded-md border border-border p-3" key={group.label}><h3 className="text-sm font-semibold text-foreground">{group.label}</h3><div className="mt-2 space-y-2">{group.options.map((option) => <label className="flex items-center gap-2 text-sm text-foreground" key={option.value}><input defaultChecked={selected.includes(option.value)} name="applicabilities" type="checkbox" value={option.value} />{option.label}</label>)}</div></div>)}</div></fieldset>;
}

export function CreateLocationForm() {
  const router = useRouter();
  const [state, action] = useActionState(createRoutingLocationAdminAction, initialState);
  useEffect(() => { if (state.ok && state.locationId) router.push(`/admin/master-data/locations/${state.locationId}`); }, [router, state.locationId, state.ok]);
  return <form action={action} className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm"><LocationFields /><ApplicabilityChoices /><SubmitButton pendingLabel="Creating..." tone="primary">Create Location</SubmitButton><ActionMessage state={state} /></form>;
}

export function EditLocationForm({ location }: { location: RoutingLocationDetail }) {
  const [state, action] = useActionState(updateRoutingLocationAdminAction, initialState);
  return <form action={action} className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm"><input name="id" type="hidden" value={location.id} /><LocationFields location={location} /><ApplicabilityChoices selected={location.applicabilities} /><SubmitButton pendingLabel="Saving..." tone="primary">Save Location</SubmitButton><ActionMessage state={state} /></form>;
}

export function LocationLifecycleControls({ location }: { location: RoutingLocationDetail }) {
  const isDeactivated = !location.isActive || location.deletedAt !== null;
  const [deactivateState, deactivateAction] = useActionState(deactivateRoutingLocationAdminAction, initialState);
  const [restoreState, restoreAction] = useActionState(restoreRoutingLocationAdminAction, initialState);
  if (isDeactivated) return <form action={restoreAction} className="rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30"><input name="id" type="hidden" value={location.id} /><h2 className="font-semibold text-foreground">Location is deactivated</h2><p className="mt-1 text-sm text-muted-foreground">Reactivate this same Location identity for future operational selection.</p><div className="mt-4"><SubmitButton pendingLabel="Reactivating..." tone="primary">Reactivate Location</SubmitButton></div><ActionMessage state={restoreState} /></form>;
  return <form action={deactivateAction} className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/30"><input name="id" type="hidden" value={location.id} /><h2 className="font-semibold text-foreground">Deactivate Location</h2><p className="mt-1 text-sm text-muted-foreground">It will no longer be available for future operational selection. Existing Shipping Notes remain unaffected.</p><label className="mt-4 flex items-center gap-2 text-sm text-foreground"><input name="confirmation" type="checkbox" value="confirmed" /> I understand this Location will be unavailable for future selection.</label><div className="mt-4"><SubmitButton pendingLabel="Deactivating..." tone="danger">Deactivate Location</SubmitButton></div><ActionMessage state={deactivateState} /></form>;
}

export const locationApplicabilityValues = ROUTING_LOCATION_APPLICABILITIES;
