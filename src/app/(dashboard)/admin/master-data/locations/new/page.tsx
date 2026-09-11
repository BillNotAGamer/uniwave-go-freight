import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { CreateLocationForm } from "@/features/locations/components/admin-location-form";
import { canMutateLocations } from "@/features/locations/permissions";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export default async function NewLocationPage() { const { user } = await requireAuthenticatedUser(); if (!canMutateLocations(user)) notFound(); return <><PageHeader title="New Location" description="Create an official routing Location with explicit Shipping Note usage."><Link className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted" href="/admin/master-data/locations">Back to Locations</Link></PageHeader><div className="mt-6"><CreateLocationForm /></div></>; }
