import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { EditLocationForm, LocationLifecycleControls } from "@/features/locations/components/admin-location-form";
import { canMutateLocations } from "@/features/locations/permissions";
import { getRoutingLocationByIdForAdmin } from "@/features/locations/queries";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type LocationDetailPageProps = { params: Promise<{ id: string }> };
export default async function LocationDetailPage({ params }: LocationDetailPageProps) { const { user } = await requireAuthenticatedUser(); if (!canMutateLocations(user)) notFound(); const { id } = await params; const location = await getRoutingLocationByIdForAdmin(id, user); if (!location) notFound(); const deleted = location.deletedAt !== null; return <><PageHeader title={`${location.code} — ${location.name}`} description={deleted ? "This Location is deactivated. Reactivate it to make it available for future operational selection." : "Manage Location identity and explicit Shipping Note usage contexts."}><Link className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted" href="/admin/master-data/locations">Back to Locations</Link></PageHeader><div className="mt-6 space-y-6">{!deleted ? <EditLocationForm location={location} /> : null}<LocationLifecycleControls location={location} /></div></>; }
