import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { CreatePartnerForm } from "@/features/partners/components/admin-partner-forms";
import { canMutatePartners } from "@/features/partners/permissions";
import { listPartnerCategories } from "@/features/partners/queries";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export default async function NewPartnerPage() {
  const { user } = await requireAuthenticatedUser();
  if (!canMutatePartners(user)) notFound();
  const categories = await listPartnerCategories(user);

  return <PageContainer><PageHeader title="New Partner" description="Create an official reusable Partner Master record."><Link className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted" href="/admin/master-data/partners">Back to Partners</Link></PageHeader><CreatePartnerForm categories={categories} /></PageContainer>;
}
